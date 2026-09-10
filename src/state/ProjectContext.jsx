import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createSampleProject, createEmptyProject, SEED_PROJECT_NAMES, defaultTitlePage, defaultDocTypes } from './sampleData.js';
import { DEFAULT_FONT_ID, FONT_BY_ID, fontStack } from './fontOptions.js';
import { generateId } from '../utils/id.js';
import { duplicateMarkdown } from '../utils/markdown.js';
import { emptyDoc, extractSceneRange } from '../editor/docJson.js';

const STORAGE_KEY = 'slate-writer-state';

// Under Electron, `window.slateStorage` (see electron/preload.cjs) backs
// this with a real SQLite file instead of localStorage -- see
// electron/main.cjs for why. The web build (and the Capacitor iOS build)
// has no such bridge, so it keeps using localStorage directly.
function loadPersisted() {
  try {
    if (window.slateStorage) {
      const raw = window.slateStorage.loadSync();
      if (raw) return JSON.parse(raw);
      // First launch under SQLite-backed storage: carry over anything an
      // older, localStorage-backed build of the app already saved to this
      // machine, so switching storage engines doesn't orphan in-progress
      // work. A no-op once the migration has run once (SQLite won't be
      // empty on the next launch).
      const legacyRaw = localStorage.getItem(STORAGE_KEY);
      if (!legacyRaw) return null;
      window.slateStorage.save(legacyRaw);
      return JSON.parse(legacyRaw);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePersisted(json) {
  if (window.slateStorage) {
    window.slateStorage.save(json);
  } else {
    localStorage.setItem(STORAGE_KEY, json);
  }
}

// Each beat card now owns its scene outright (`card.sceneDoc`) instead of
// anchoring into one shared whole-script document (`project.screenplayDoc`
// + `card.sceneId`) — the old shape meant every card opened the *same*
// document just scrolled to a different spot, so an edit made while
// viewing one card was visible from every other card too. A project still
// carrying the old shape gets each card's slice of the old shared document
// extracted into its own sceneDoc here, once, before anything else touches
// the state.
function migrateProjectToPerCardDocs(p) {
  if (!p || !p.screenplayDoc) return p;
  const sharedContent = p.screenplayDoc.content ?? [];
  const acts = p.acts.map((act) => ({
    ...act,
    cards: act.cards.map((card) => {
      const { sceneId, ...rest } = card;
      if (rest.sceneDoc) return rest; // already migrated
      const extracted = sceneId ? extractSceneRange(p.screenplayDoc, sceneId) : null;
      return { ...rest, sceneDoc: extracted?.length ? { type: 'doc', content: extracted } : emptyDoc() };
    }),
  }));
  const { screenplayDoc, ...rest } = p;
  return { ...rest, acts };
}

// Backfills `titlePage` for any project persisted before the Title Page /
// Export PDF feature existed -- a no-op once every project has been saved
// at least once since.
function migrateTitlePage(p) {
  if (p.titlePage) return p;
  return { ...p, titlePage: defaultTitlePage(p.name) };
}

// Character Bible / Notes & Research used to be two hardcoded top-level
// fields (`characterBible`, `notesResearch`); now they're just the two
// document types every project starts with, alongside any custom types a
// user adds -- see DocTypeModal.jsx. A project persisted before custom
// doc types existed gets those two fields folded into a `docTypes` array,
// carrying its existing docs over untouched.
function migrateDocTypes(p) {
  if (p.docTypes) return p;
  const { characterBible, notesResearch, ...rest } = p;
  const [characterType, noteType] = defaultDocTypes();
  return {
    ...rest,
    docTypes: [
      { ...characterType, docs: characterBible ?? [] },
      { ...noteType, docs: notesResearch ?? [] },
    ],
  };
}

// Early versions of the Add/Edit Data Type modal defaulted a blank
// Singular Label to "Add New {plural}", baked into whatever got saved at
// the time. The label is meant to be a bare noun ("Character", not "Add
// New Character") so it composes cleanly wherever it's used (a button's
// title, an empty-state prompt, etc. -- see FileTree.jsx) instead of being
// locked into one fixed phrase. Strips that old convention from anything
// already persisted; a no-op once every doc type has been saved since.
function migrateSingularLabels(p) {
  const ADD_NEW_RE = /^Add New /;
  if (!p.docTypes.some((t) => ADD_NEW_RE.test(t.singularLabel))) return p;
  return {
    ...p,
    docTypes: p.docTypes.map((t) => ({ ...t, singularLabel: t.singularLabel.replace(ADD_NEW_RE, '') })),
  };
}

// Builds the initial `projects` map from whatever was persisted, migrating
// the pre-multi-project shape (a single `project`) if that's what's there,
// or seeding a fresh install with one real project plus empty-template
// projects for the rest of the switcher list. Every project (freshly
// seeded or restored) passes through the per-card-doc migration above,
// which is a no-op for anything already in the current shape.
function buildInitialProjects(persisted) {
  if (persisted?.projects && typeof persisted.projects === 'object') {
    return Object.fromEntries(
      Object.entries(persisted.projects).map(([id, p]) => [
        id,
        migrateSingularLabels(migrateDocTypes(migrateTitlePage(migrateProjectToPerCardDocs(p)))),
      ])
    );
  }
  if (persisted?.project) {
    const legacy = persisted.project;
    const id = legacy.id ?? generateId('project');
    return {
      [id]: migrateSingularLabels(
        migrateDocTypes(
          migrateTitlePage(
            migrateProjectToPerCardDocs({
              ...legacy,
              id,
              screenplayDoc: legacy.screenplayDoc ?? emptyDoc(),
              characterBible: legacy.characterBible ?? [],
              notesResearch: legacy.notesResearch ?? [],
            })
          )
        )
      ),
    };
  }
  const sample = createSampleProject();
  const map = { [sample.id]: sample };
  for (const name of SEED_PROJECT_NAMES.slice(1)) {
    const p = createEmptyProject(name);
    map[p.id] = p;
  }
  return map;
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  // Read persisted state synchronously into each piece of state's lazy
  // initializer (rather than restoring it later in a useEffect) so the very
  // first render already reflects it — see the autosave effect below for
  // why doing this later caused a revert-on-reload bug.
  const [persisted] = useState(() => loadPersisted());

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof persisted?.sidebarCollapsed === 'boolean' ? persisted.sidebarCollapsed : false
  );
  const [theme, setTheme] = useState(() => (persisted?.theme === 'light' ? 'light' : 'dark'));
  const [fontId, setFontId] = useState(() => (FONT_BY_ID[persisted?.fontId] ? persisted.fontId : DEFAULT_FONT_ID));
  const [scriptFontId, setScriptFontId] = useState(() =>
    FONT_BY_ID[persisted?.scriptFontId] ? persisted.scriptFontId : DEFAULT_FONT_ID
  );
  const [projects, setProjects] = useState(() => buildInitialProjects(persisted));
  const [currentProjectId, setCurrentProjectId] = useState(() => {
    if (persisted?.currentProjectId && projects[persisted.currentProjectId]) {
      return persisted.currentProjectId;
    }
    return Object.keys(projects)[0];
  });
  const [lastSavedAt, setLastSavedAt] = useState(() => persisted?.lastSavedAt ?? null);
  const [view, setView] = useState({ name: 'outline', payload: null });
  const [dragState, setDragState] = useState(null); // { cardId, fromActId }
  const [dropPreview, setDropPreview] = useState(null); // { actId, beforeCardId }
  const [cardMenu, setCardMenu] = useState(null); // { actId, cardId, title, x, y }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { actId, cardId, title, x, y }
  const [actMenu, setActMenu] = useState(null); // { actId, title, x, y }
  const [actDeleteConfirm, setActDeleteConfirm] = useState(null); // { actId, title, x, y }
  const [fileMenu, setFileMenu] = useState(null); // { docTypeId, docId, title, x, y }
  const [fileDeleteConfirm, setFileDeleteConfirm] = useState(null); // { docTypeId, docId, title, x, y }
  const [projectMenu, setProjectMenu] = useState(null); // { projectId, name, x, y }
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState(null); // { projectId, name, x, y }
  const [docTypeModal, setDocTypeModal] = useState(null); // { mode: 'add' } | { mode: 'edit', docTypeId, pluralLabel, singularLabel, template }
  const [docTypeMenu, setDocTypeMenu] = useState(null); // { docTypeId, pluralLabel, x, y }
  const [docTypeDeleteConfirm, setDocTypeDeleteConfirm] = useState(null); // { docTypeId, pluralLabel, docCount, x, y }
  const [docTypeDrag, setDocTypeDrag] = useState(null); // { docTypeId }
  const [docTypeDropPreview, setDocTypeDropPreview] = useState(null); // { beforeDocTypeId }
  const [toast, setToast] = useState(null); // { message, key }

  const project = projects[currentProjectId];

  // Reflect the theme on the document root so the CSS `[data-theme]` tokens
  // apply everywhere, not just inside the React tree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Same idea for the selected font, but as a plain CSS custom property
  // (--font-family) rather than a [data-font] attribute + hardcoded CSS
  // blocks per option, since the value is a full font-family stack, not a
  // fixed enum of visual variants like the theme is. The script/page content
  // (Screenplay view + the Editor -- both render the same .screenplay-page
  // container) gets its own independent --script-font-family, so "the
  // script" and "everywhere else" can be set separately.
  useEffect(() => {
    document.documentElement.style.setProperty('--font-family', fontStack(fontId));
  }, [fontId]);

  useEffect(() => {
    document.documentElement.style.setProperty('--script-font-family', fontStack(scriptFontId));
  }, [scriptFontId]);

  // Persist whenever any project, the active project, sidebar, theme, or
  // font state changes (autosave).
  useEffect(() => {
    const savedAt = Date.now();
    setLastSavedAt(savedAt);
    try {
      savePersisted(
        JSON.stringify({
          projects,
          currentProjectId,
          sidebarCollapsed,
          theme,
          fontId,
          scriptFontId,
          lastSavedAt: savedAt,
        })
      );
    } catch {
      // Storage unavailable (private mode, quota, etc.) — skip persistence silently.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, currentProjectId, sidebarCollapsed, theme, fontId, scriptFontId]);

  const showToast = useCallback((message) => {
    setToast({ message, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((c) => !c), []);

  const navigate = useCallback((name, payload = null) => {
    setView({ name, payload });
  }, []);

  // Every mutation to the *active* project's data goes through this one
  // spot, so nothing else needs to know how the multi-project map is keyed.
  const updateCurrentProject = useCallback(
    (updater) => {
      setProjects((prev) => ({ ...prev, [currentProjectId]: updater(prev[currentProjectId]) }));
    },
    [currentProjectId]
  );

  const switchProject = useCallback((projectId) => {
    setCurrentProjectId(projectId);
    setView({ name: 'outline', payload: null });
  }, []);

  const createProject = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = createEmptyProject(trimmed);
    setProjects((prev) => ({ ...prev, [p.id]: p }));
    setCurrentProjectId(p.id);
    setView({ name: 'outline', payload: null });
  }, []);

  const renameProject = useCallback((projectId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProjects((prev) =>
      prev[projectId] ? { ...prev, [projectId]: { ...prev[projectId], name: trimmed } } : prev
    );
  }, []);

  const updateTitlePage = useCallback(
    (patch) => {
      updateCurrentProject((p) => ({ ...p, titlePage: { ...p.titlePage, ...patch } }));
    },
    [updateCurrentProject]
  );

  const openProjectMenu = useCallback((projectId, name, x, y) => {
    setProjectMenu({ projectId, name, x, y });
  }, []);

  const closeProjectMenu = useCallback(() => setProjectMenu(null), []);

  const deleteProject = useCallback(
    (projectId) => {
      setProjects((prev) => {
        const { [projectId]: _removed, ...rest } = prev;
        return rest;
      });
      setCurrentProjectId((current) => {
        if (current !== projectId) return current;
        // The active project was deleted -- fall back to whatever's left.
        const remainingIds = Object.keys(projects).filter((id) => id !== projectId);
        return remainingIds[0];
      });
      setView({ name: 'outline', payload: null });
    },
    [projects]
  );

  // A project is a real workspace (its own acts, screenplay, docs) with no
  // undo -- always confirm first, and never let the last one be deleted
  // (there'd be nothing left to switch to).
  const requestDeleteProject = useCallback(
    (projectId, name, x, y) => {
      setProjectMenu(null);
      if (Object.keys(projects).length <= 1) {
        showToast('Can’t delete your only project');
        return;
      }
      setProjectDeleteConfirm({ projectId, name, x, y });
    },
    [projects, showToast]
  );

  const cancelDeleteProject = useCallback(() => setProjectDeleteConfirm(null), []);

  const confirmDeleteProject = useCallback(() => {
    setProjectDeleteConfirm((current) => {
      if (current) deleteProject(current.projectId);
      return null;
    });
  }, [deleteProject]);

  const addAct = useCallback(() => {
    updateCurrentProject((p) => ({
      ...p,
      acts: [...p.acts, { id: generateId('act'), title: 'New Act', cards: [] }],
    }));
  }, [updateCurrentProject]);

  const renameAct = useCallback(
    (actId, title) => {
      updateCurrentProject((p) => ({
        ...p,
        acts: p.acts.map((act) => (act.id === actId ? { ...act, title } : act)),
      }));
    },
    [updateCurrentProject]
  );

  const openActMenu = useCallback((actId, title, x, y) => {
    setActMenu({ actId, title, x, y });
  }, []);

  const closeActMenu = useCallback(() => setActMenu(null), []);

  const deleteAct = useCallback(
    (actId) => {
      updateCurrentProject((p) => ({ ...p, acts: p.acts.filter((a) => a.id !== actId) }));
    },
    [updateCurrentProject]
  );

  // Deleting an act takes every card (and every card's scene) in it with
  // it -- always confirm first, same as beat cards, docs, and projects.
  const requestDeleteAct = useCallback((actId, title, x, y) => {
    setActMenu(null);
    setActDeleteConfirm({ actId, title, x, y });
  }, []);

  const cancelDeleteAct = useCallback(() => setActDeleteConfirm(null), []);

  const confirmDeleteAct = useCallback(() => {
    setActDeleteConfirm((current) => {
      if (current) deleteAct(current.actId);
      return null;
    });
  }, [deleteAct]);

  const addCard = useCallback(
    (actId) => {
      updateCurrentProject((p) => ({
        ...p,
        acts: p.acts.map((act) =>
          act.id === actId
            ? {
                ...act,
                cards: [
                  ...act.cards,
                  {
                    id: generateId('card'),
                    title: 'Untitled beat',
                    description: 'Click to describe what happens here.',
                    isFlagged: false,
                    sceneDoc: emptyDoc(),
                  },
                ],
              }
            : act
        ),
      }));
    },
    [updateCurrentProject]
  );

  // Every card's sceneDoc is independent, so updating one just replaces
  // that one card's field -- no shared document to coordinate with.
  const updateCardSceneDoc = useCallback(
    (actId, cardId, docJson) => {
      updateCurrentProject((p) => ({
        ...p,
        acts: p.acts.map((act) =>
          act.id === actId
            ? { ...act, cards: act.cards.map((c) => (c.id === cardId ? { ...c, sceneDoc: docJson } : c)) }
            : act
        ),
      }));
    },
    [updateCurrentProject]
  );

  const updateCard = useCallback(
    (actId, cardId, patch) => {
      updateCurrentProject((p) => ({
        ...p,
        acts: p.acts.map((act) =>
          act.id === actId
            ? { ...act, cards: act.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
            : act
        ),
      }));
    },
    [updateCurrentProject]
  );

  const openCardMenu = useCallback((actId, cardId, x, y, meta) => {
    setCardMenu({ actId, cardId, x, y, title: meta?.title });
  }, []);

  const closeCardMenu = useCallback(() => setCardMenu(null), []);

  const deleteCard = useCallback(
    (actId, cardId) => {
      // The card's sceneDoc belongs only to it -- deleting the card
      // discards its content naturally, no shared document to clean up.
      updateCurrentProject((p) => ({
        ...p,
        acts: p.acts.map((a) => (a.id === actId ? { ...a, cards: a.cards.filter((c) => c.id !== cardId) } : a)),
      }));
      setCardMenu(null);
    },
    [updateCurrentProject]
  );

  // Deleting a card is permanent (it also removes the scene from the script,
  // and there's no undo) — every entry point routes through this
  // confirm-first flow rather than calling deleteCard directly.
  const requestDeleteCard = useCallback((actId, cardId, title, x, y) => {
    setCardMenu(null);
    setDeleteConfirm({ actId, cardId, title, x, y });
  }, []);

  const cancelDeleteCard = useCallback(() => setDeleteConfirm(null), []);

  const confirmDeleteCard = useCallback(() => {
    setDeleteConfirm((current) => {
      if (current) deleteCard(current.actId, current.cardId);
      return null;
    });
  }, [deleteCard]);

  const beginDrag = useCallback((cardId, fromActId) => {
    setDragState({ cardId, fromActId });
  }, []);

  const endDrag = useCallback(() => {
    setDragState(null);
    setDropPreview(null);
  }, []);

  const updateDropPreview = useCallback((actId, beforeCardId) => {
    setDropPreview((prev) =>
      prev && prev.actId === actId && prev.beforeCardId === beforeCardId
        ? prev
        : { actId, beforeCardId }
    );
  }, []);

  const dropCard = useCallback(
    (toActId) => {
      updateCurrentProject((p) => {
        if (!dragState || !dropPreview) return p;
        const { cardId, fromActId } = dragState;
        const { beforeCardId } = dropPreview;
        const fromAct = p.acts.find((a) => a.id === fromActId);
        const card = fromAct?.cards.find((c) => c.id === cardId);
        if (!card) return p;

        const acts = p.acts.map((act) => {
          if (act.id === fromActId && act.id !== toActId) {
            return { ...act, cards: act.cards.filter((c) => c.id !== cardId) };
          }
          if (act.id === toActId) {
            const source = act.id === fromActId ? act.cards.filter((c) => c.id !== cardId) : act.cards;
            const cards = [...source];
            const insertAt = beforeCardId ? cards.findIndex((c) => c.id === beforeCardId) : -1;
            cards.splice(insertAt === -1 ? cards.length : insertAt, 0, card);
            return { ...act, cards };
          }
          return act;
        });

        return { ...p, acts };
      });
      setDragState(null);
      setDropPreview(null);
    },
    [updateCurrentProject, dragState, dropPreview]
  );

  // ---- Document types (Character Bible / Notes & Research / any custom
  // type added via the "+" next to the project name) and their docs ----
  // `docTypeId` identifies which type's `docs` array a doc lives in --
  // Character Bible and Notes & Research are just the two types every
  // project starts with (see defaultDocTypes in sampleData.js), not
  // special-cased anywhere below.

  const addDoc = useCallback(
    (docTypeId) => {
      const doc = { id: generateId('doc') };
      updateCurrentProject((p) => ({
        ...p,
        docTypes: p.docTypes.map((t) =>
          t.id === docTypeId ? { ...t, docs: [...t.docs, { ...doc, content: t.template ?? '' }] } : t
        ),
      }));
      setView({ name: 'doc', payload: { docTypeId, docId: doc.id } });
    },
    [updateCurrentProject]
  );

  const updateDocContent = useCallback(
    (docTypeId, docId, content) => {
      updateCurrentProject((p) => ({
        ...p,
        docTypes: p.docTypes.map((t) =>
          t.id === docTypeId ? { ...t, docs: t.docs.map((d) => (d.id === docId ? { ...d, content } : d)) } : t
        ),
      }));
    },
    [updateCurrentProject]
  );

  const duplicateDoc = useCallback(
    (docTypeId, docId) => {
      updateCurrentProject((p) => ({
        ...p,
        docTypes: p.docTypes.map((t) => {
          if (t.id !== docTypeId) return t;
          const idx = t.docs.findIndex((d) => d.id === docId);
          if (idx === -1) return t;
          const copy = { id: generateId('doc'), content: duplicateMarkdown(t.docs[idx].content) };
          const docs = [...t.docs];
          docs.splice(idx + 1, 0, copy);
          return { ...t, docs };
        }),
      }));
      setFileMenu(null);
    },
    [updateCurrentProject]
  );

  const openFileMenu = useCallback((docTypeId, docId, x, y, title) => {
    setFileMenu({ docTypeId, docId, x, y, title });
  }, []);

  const closeFileMenu = useCallback(() => setFileMenu(null), []);

  const deleteDoc = useCallback(
    (docTypeId, docId) => {
      updateCurrentProject((p) => ({
        ...p,
        docTypes: p.docTypes.map((t) => (t.id === docTypeId ? { ...t, docs: t.docs.filter((d) => d.id !== docId) } : t)),
      }));
      // If the doc being deleted is the one currently open, don't leave the
      // user staring at an editor for a document that no longer exists.
      setView((v) => (v.name === 'doc' && v.payload?.docId === docId ? { name: 'outline', payload: null } : v));
    },
    [updateCurrentProject]
  );

  const requestDeleteDoc = useCallback((docTypeId, docId, title, x, y) => {
    setFileMenu(null);
    setFileDeleteConfirm({ docTypeId, docId, title, x, y });
  }, []);

  const cancelDeleteDoc = useCallback(() => setFileDeleteConfirm(null), []);

  const confirmDeleteDoc = useCallback(() => {
    setFileDeleteConfirm((current) => {
      if (current) deleteDoc(current.docTypeId, current.docId);
      return null;
    });
  }, [deleteDoc]);

  // ---- Document types themselves: add/edit (via a modal, see
  // DocTypeModal.jsx), delete (confirm-protected, right-click), and
  // drag-to-reorder (mirrors the beat-card drag pattern, just a flat list
  // instead of acts-of-cards). ----

  // `key` is unique per open (not per doc type) -- lets the modal's
  // template editor (an uncontrolled ProseMirror instance keyed on it, see
  // DocTypeModal.jsx) force a genuinely fresh remount every time the modal
  // opens, including two consecutive "Add" opens, which would otherwise
  // share the same identity and leave stale content behind.
  const openAddDocTypeModal = useCallback(() => setDocTypeModal({ mode: 'add', key: generateId('modal') }), []);

  const openEditDocTypeModal = useCallback(
    (docTypeId) => {
      const t = project?.docTypes.find((dt) => dt.id === docTypeId);
      if (!t) return;
      setDocTypeModal({
        mode: 'edit',
        key: generateId('modal'),
        docTypeId,
        pluralLabel: t.pluralLabel,
        singularLabel: t.singularLabel,
        template: t.template,
      });
    },
    [project]
  );

  const closeDocTypeModal = useCallback(() => setDocTypeModal(null), []);

  const addDocType = useCallback(
    ({ pluralLabel, singularLabel, template }) => {
      const trimmed = pluralLabel.trim();
      if (!trimmed) return;
      const t = {
        id: generateId('doctype'),
        pluralLabel: trimmed,
        singularLabel: singularLabel.trim() || trimmed,
        template: template ?? '',
        docs: [],
      };
      updateCurrentProject((p) => ({ ...p, docTypes: [...p.docTypes, t] }));
      setDocTypeModal(null);
    },
    [updateCurrentProject]
  );

  const updateDocType = useCallback(
    (docTypeId, { pluralLabel, singularLabel, template }) => {
      const trimmed = pluralLabel.trim();
      if (!trimmed) return;
      updateCurrentProject((p) => ({
        ...p,
        docTypes: p.docTypes.map((t) =>
          t.id === docTypeId
            ? { ...t, pluralLabel: trimmed, singularLabel: singularLabel.trim() || trimmed, template: template ?? '' }
            : t
        ),
      }));
      setDocTypeModal(null);
    },
    [updateCurrentProject]
  );

  const openDocTypeMenu = useCallback((docTypeId, pluralLabel, x, y) => {
    setDocTypeMenu({ docTypeId, pluralLabel, x, y });
  }, []);

  const closeDocTypeMenu = useCallback(() => setDocTypeMenu(null), []);

  const deleteDocType = useCallback(
    (docTypeId) => {
      updateCurrentProject((p) => ({ ...p, docTypes: p.docTypes.filter((t) => t.id !== docTypeId) }));
      // If a doc from the deleted type is open, don't leave the user
      // staring at an editor for a document that no longer exists.
      setView((v) => (v.name === 'doc' && v.payload?.docTypeId === docTypeId ? { name: 'outline', payload: null } : v));
    },
    [updateCurrentProject]
  );

  // Deleting a type takes every doc inside it with it -- always confirm
  // first, same pattern as beat cards, acts, docs, and projects.
  const requestDeleteDocType = useCallback((docTypeId, pluralLabel, docCount, x, y) => {
    setDocTypeMenu(null);
    setDocTypeDeleteConfirm({ docTypeId, pluralLabel, docCount, x, y });
  }, []);

  const cancelDeleteDocType = useCallback(() => setDocTypeDeleteConfirm(null), []);

  const confirmDeleteDocType = useCallback(() => {
    setDocTypeDeleteConfirm((current) => {
      if (current) deleteDocType(current.docTypeId);
      return null;
    });
  }, [deleteDocType]);

  const beginDocTypeDrag = useCallback((docTypeId) => setDocTypeDrag({ docTypeId }), []);

  const endDocTypeDrag = useCallback(() => {
    setDocTypeDrag(null);
    setDocTypeDropPreview(null);
  }, []);

  const updateDocTypeDropPreview = useCallback((beforeDocTypeId) => {
    setDocTypeDropPreview((prev) => (prev && prev.beforeDocTypeId === beforeDocTypeId ? prev : { beforeDocTypeId }));
  }, []);

  const dropDocType = useCallback(() => {
    updateCurrentProject((p) => {
      if (!docTypeDrag || !docTypeDropPreview) return p;
      const { docTypeId } = docTypeDrag;
      const { beforeDocTypeId } = docTypeDropPreview;
      const current = p.docTypes.find((t) => t.id === docTypeId);
      if (!current) return p;
      const rest = p.docTypes.filter((t) => t.id !== docTypeId);
      const insertAt = beforeDocTypeId ? rest.findIndex((t) => t.id === beforeDocTypeId) : -1;
      rest.splice(insertAt === -1 ? rest.length : insertAt, 0, current);
      return { ...p, docTypes: rest };
    });
    setDocTypeDrag(null);
    setDocTypeDropPreview(null);
  }, [updateCurrentProject, docTypeDrag, docTypeDropPreview]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      theme,
      setTheme,
      fontId,
      setFontId,
      scriptFontId,
      setScriptFontId,
      project,
      projects,
      currentProjectId,
      switchProject,
      createProject,
      renameProject,
      updateTitlePage,
      projectMenu,
      openProjectMenu,
      closeProjectMenu,
      projectDeleteConfirm,
      requestDeleteProject,
      cancelDeleteProject,
      confirmDeleteProject,
      lastSavedAt,
      view,
      navigate,
      addAct,
      renameAct,
      actMenu,
      openActMenu,
      closeActMenu,
      actDeleteConfirm,
      requestDeleteAct,
      cancelDeleteAct,
      confirmDeleteAct,
      addCard,
      updateCard,
      updateCardSceneDoc,
      dragState,
      dropPreview,
      beginDrag,
      endDrag,
      updateDropPreview,
      dropCard,
      cardMenu,
      openCardMenu,
      closeCardMenu,
      deleteConfirm,
      requestDeleteCard,
      cancelDeleteCard,
      confirmDeleteCard,
      addDoc,
      updateDocContent,
      duplicateDoc,
      fileMenu,
      openFileMenu,
      closeFileMenu,
      fileDeleteConfirm,
      requestDeleteDoc,
      cancelDeleteDoc,
      confirmDeleteDoc,
      docTypeModal,
      openAddDocTypeModal,
      openEditDocTypeModal,
      closeDocTypeModal,
      addDocType,
      updateDocType,
      docTypeMenu,
      openDocTypeMenu,
      closeDocTypeMenu,
      docTypeDeleteConfirm,
      requestDeleteDocType,
      cancelDeleteDocType,
      confirmDeleteDocType,
      docTypeDrag,
      docTypeDropPreview,
      beginDocTypeDrag,
      endDocTypeDrag,
      updateDocTypeDropPreview,
      dropDocType,
      toast,
      showToast,
    }),
    [
      sidebarCollapsed,
      toggleSidebar,
      theme,
      fontId,
      scriptFontId,
      project,
      projects,
      currentProjectId,
      switchProject,
      createProject,
      renameProject,
      updateTitlePage,
      projectMenu,
      openProjectMenu,
      closeProjectMenu,
      projectDeleteConfirm,
      requestDeleteProject,
      cancelDeleteProject,
      confirmDeleteProject,
      lastSavedAt,
      view,
      navigate,
      addAct,
      renameAct,
      actMenu,
      openActMenu,
      closeActMenu,
      actDeleteConfirm,
      requestDeleteAct,
      cancelDeleteAct,
      confirmDeleteAct,
      addCard,
      updateCard,
      updateCardSceneDoc,
      dragState,
      dropPreview,
      beginDrag,
      endDrag,
      updateDropPreview,
      dropCard,
      cardMenu,
      openCardMenu,
      closeCardMenu,
      deleteConfirm,
      requestDeleteCard,
      cancelDeleteCard,
      confirmDeleteCard,
      addDoc,
      updateDocContent,
      duplicateDoc,
      fileMenu,
      openFileMenu,
      closeFileMenu,
      fileDeleteConfirm,
      requestDeleteDoc,
      cancelDeleteDoc,
      confirmDeleteDoc,
      docTypeModal,
      openAddDocTypeModal,
      openEditDocTypeModal,
      closeDocTypeModal,
      addDocType,
      updateDocType,
      docTypeMenu,
      openDocTypeMenu,
      closeDocTypeMenu,
      docTypeDeleteConfirm,
      requestDeleteDocType,
      cancelDeleteDocType,
      confirmDeleteDocType,
      docTypeDrag,
      docTypeDropPreview,
      beginDocTypeDrag,
      endDocTypeDrag,
      updateDocTypeDropPreview,
      dropDocType,
      toast,
      showToast,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
  return ctx;
}
