import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createSampleProject, createEmptyProject, SEED_PROJECT_NAMES } from './sampleData.js';
import { characterTemplate, noteTemplate } from './docTemplates.js';
import { DEFAULT_FONT_ID, FONT_BY_ID, fontStack } from './fontOptions.js';
import { generateId } from '../utils/id.js';
import { duplicateMarkdown } from '../utils/markdown.js';
import { emptyDoc, extractSceneRange } from '../editor/docJson.js';

const STORAGE_KEY = 'slate-writer-state';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
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

// Builds the initial `projects` map from whatever was persisted, migrating
// the pre-multi-project shape (a single `project`) if that's what's there,
// or seeding a fresh install with one real project plus empty-template
// projects for the rest of the switcher list. Every project (freshly
// seeded or restored) passes through the per-card-doc migration above,
// which is a no-op for anything already in the current shape.
function buildInitialProjects(persisted) {
  if (persisted?.projects && typeof persisted.projects === 'object') {
    return Object.fromEntries(
      Object.entries(persisted.projects).map(([id, p]) => [id, migrateProjectToPerCardDocs(p)])
    );
  }
  if (persisted?.project) {
    const legacy = persisted.project;
    const id = legacy.id ?? generateId('project');
    return {
      [id]: migrateProjectToPerCardDocs({
        ...legacy,
        id,
        screenplayDoc: legacy.screenplayDoc ?? emptyDoc(),
        characterBible: legacy.characterBible ?? [],
        notesResearch: legacy.notesResearch ?? [],
      }),
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
  const [fileMenu, setFileMenu] = useState(null); // { docType, docId, title, x, y }
  const [fileDeleteConfirm, setFileDeleteConfirm] = useState(null); // { docType, docId, title, x, y }
  const [projectMenu, setProjectMenu] = useState(null); // { projectId, name, x, y }
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState(null); // { projectId, name, x, y }
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
      localStorage.setItem(
        STORAGE_KEY,
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
      // localStorage unavailable (private mode, quota, etc.) — skip persistence silently.
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

  // ---- Character Bible / Notes & Research docs ----
  // `docType` is 'characterBible' | 'notesResearch' — matches the field name
  // directly on the project object, so no translation layer is needed.

  const addCharacterDoc = useCallback(() => {
    const doc = { id: generateId('doc'), content: characterTemplate() };
    updateCurrentProject((p) => ({ ...p, characterBible: [...p.characterBible, doc] }));
    setView({ name: 'doc', payload: { docType: 'characterBible', docId: doc.id } });
  }, [updateCurrentProject]);

  const addNoteDoc = useCallback(() => {
    const doc = { id: generateId('doc'), content: noteTemplate() };
    updateCurrentProject((p) => ({ ...p, notesResearch: [...p.notesResearch, doc] }));
    setView({ name: 'doc', payload: { docType: 'notesResearch', docId: doc.id } });
  }, [updateCurrentProject]);

  const updateDocContent = useCallback(
    (docType, docId, content) => {
      updateCurrentProject((p) => ({
        ...p,
        [docType]: p[docType].map((d) => (d.id === docId ? { ...d, content } : d)),
      }));
    },
    [updateCurrentProject]
  );

  const duplicateDoc = useCallback(
    (docType, docId) => {
      updateCurrentProject((p) => {
        const idx = p[docType].findIndex((d) => d.id === docId);
        if (idx === -1) return p;
        const copy = { id: generateId('doc'), content: duplicateMarkdown(p[docType][idx].content) };
        const list = [...p[docType]];
        list.splice(idx + 1, 0, copy);
        return { ...p, [docType]: list };
      });
      setFileMenu(null);
    },
    [updateCurrentProject]
  );

  const openFileMenu = useCallback((docType, docId, x, y, title) => {
    setFileMenu({ docType, docId, x, y, title });
  }, []);

  const closeFileMenu = useCallback(() => setFileMenu(null), []);

  const deleteDoc = useCallback(
    (docType, docId) => {
      updateCurrentProject((p) => ({ ...p, [docType]: p[docType].filter((d) => d.id !== docId) }));
      // If the doc being deleted is the one currently open, don't leave the
      // user staring at an editor for a document that no longer exists.
      setView((v) => (v.name === 'doc' && v.payload?.docId === docId ? { name: 'outline', payload: null } : v));
    },
    [updateCurrentProject]
  );

  const requestDeleteDoc = useCallback((docType, docId, title, x, y) => {
    setFileMenu(null);
    setFileDeleteConfirm({ docType, docId, title, x, y });
  }, []);

  const cancelDeleteDoc = useCallback(() => setFileDeleteConfirm(null), []);

  const confirmDeleteDoc = useCallback(() => {
    setFileDeleteConfirm((current) => {
      if (current) deleteDoc(current.docType, current.docId);
      return null;
    });
  }, [deleteDoc]);

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
      addCharacterDoc,
      addNoteDoc,
      updateDocContent,
      duplicateDoc,
      fileMenu,
      openFileMenu,
      closeFileMenu,
      fileDeleteConfirm,
      requestDeleteDoc,
      cancelDeleteDoc,
      confirmDeleteDoc,
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
      addCharacterDoc,
      addNoteDoc,
      updateDocContent,
      duplicateDoc,
      fileMenu,
      openFileMenu,
      closeFileMenu,
      fileDeleteConfirm,
      requestDeleteDoc,
      cancelDeleteDoc,
      confirmDeleteDoc,
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
