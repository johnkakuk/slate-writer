import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createSampleProject, RECENT_PROJECT_NAMES } from './sampleData.js';
import { generateId } from '../utils/id.js';
import { appendEmptyScene, emptyDoc, removeScene } from '../editor/docJson.js';

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

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  // Read persisted state synchronously into each piece of state's lazy
  // initializer (rather than restoring it later in a useEffect) so the very
  // first render already reflects it. Restoring it via an effect left a
  // window, on mount, where the autosave effect below (which also runs on
  // mount) would fire with the still-default state and immediately
  // overwrite the just-loaded values in localStorage before React had
  // re-rendered with the restored ones — theme (and everything else) would
  // revert right after a reload.
  const [persisted] = useState(() => loadPersisted());

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof persisted?.sidebarCollapsed === 'boolean' ? persisted.sidebarCollapsed : false
  );
  const [theme, setTheme] = useState(() => (persisted?.theme === 'light' ? 'light' : 'dark'));
  const [project, setProject] = useState(() => {
    // Guards against state saved before `screenplayDoc` existed on the
    // project shape (an earlier scaffold session) — everything else about
    // the persisted shape is still compatible.
    if (persisted?.project) {
      return { ...persisted.project, screenplayDoc: persisted.project.screenplayDoc ?? emptyDoc() };
    }
    return createSampleProject();
  });
  const [lastSavedAt, setLastSavedAt] = useState(() => persisted?.lastSavedAt ?? null);
  const [selectedProjectName, setSelectedProjectName] = useState(RECENT_PROJECT_NAMES[0]);
  const [view, setView] = useState({ name: 'outline', payload: null });
  const [dragState, setDragState] = useState(null); // { cardId, fromActId }
  const [dropPreview, setDropPreview] = useState(null); // { actId, beforeCardId }
  const [cardMenu, setCardMenu] = useState(null); // { actId, cardId, sceneId, title, x, y }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { actId, cardId, title, x, y }
  const [toast, setToast] = useState(null); // { message, key }

  // Reflect the theme on the document root so the CSS `[data-theme]` tokens
  // apply everywhere, not just inside the React tree.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Persist whenever project, sidebar, or theme state changes (autosave).
  useEffect(() => {
    const savedAt = Date.now();
    setLastSavedAt(savedAt);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ project, sidebarCollapsed, theme, lastSavedAt: savedAt })
      );
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — skip persistence silently.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, sidebarCollapsed, theme]);

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

  const addAct = useCallback(() => {
    setProject((p) => ({
      ...p,
      acts: [...p.acts, { id: generateId('act'), title: 'New Act', cards: [] }],
    }));
  }, []);

  const renameAct = useCallback((actId, title) => {
    setProject((p) => ({
      ...p,
      acts: p.acts.map((act) => (act.id === actId ? { ...act, title } : act)),
    }));
  }, []);

  const addCard = useCallback((actId) => {
    setProject((p) => {
      const sceneId = generateId('scene');
      return {
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
                    sceneId,
                  },
                ],
              }
            : act
        ),
        screenplayDoc: appendEmptyScene(p.screenplayDoc, sceneId),
      };
    });
  }, []);

  const updateScreenplayDoc = useCallback((docJson) => {
    setProject((p) => ({ ...p, screenplayDoc: docJson }));
  }, []);

  const updateCard = useCallback((actId, cardId, patch) => {
    setProject((p) => ({
      ...p,
      acts: p.acts.map((act) =>
        act.id === actId
          ? { ...act, cards: act.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
          : act
      ),
    }));
  }, []);

  const openCardMenu = useCallback((actId, cardId, x, y, meta) => {
    setCardMenu({ actId, cardId, x, y, sceneId: meta?.sceneId, title: meta?.title });
  }, []);

  const closeCardMenu = useCallback(() => setCardMenu(null), []);

  const deleteCard = useCallback((actId, cardId) => {
    setProject((p) => {
      const act = p.acts.find((a) => a.id === actId);
      const card = act?.cards.find((c) => c.id === cardId);
      return {
        ...p,
        acts: p.acts.map((a) =>
          a.id === actId ? { ...a, cards: a.cards.filter((c) => c.id !== cardId) } : a
        ),
        screenplayDoc: card ? removeScene(p.screenplayDoc, card.sceneId) : p.screenplayDoc,
      };
    });
    setCardMenu(null);
  }, []);

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
      setProject((p) => {
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
    [dragState, dropPreview]
  );

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      toggleSidebar,
      theme,
      setTheme,
      project,
      selectedProjectName,
      setSelectedProjectName,
      recentProjectNames: RECENT_PROJECT_NAMES,
      lastSavedAt,
      view,
      navigate,
      addAct,
      renameAct,
      addCard,
      updateCard,
      updateScreenplayDoc,
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
      toast,
      showToast,
    }),
    [
      sidebarCollapsed,
      toggleSidebar,
      theme,
      project,
      selectedProjectName,
      lastSavedAt,
      view,
      navigate,
      addAct,
      renameAct,
      addCard,
      updateCard,
      updateScreenplayDoc,
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
