# Slate Writer

A purpose-built screenwriting web app — a lighter, local-first alternative to Arc Studio. Dark "Production Deck" theme (with a light mode), Courier New throughout, `.fountain`-flavored portability as the long-term goal. First real use case: adapting the short story "Long Way Down" into a short-film screenplay.

## Status

Early and local-only. No backend, no accounts, no sync — everything lives in the browser's `localStorage`. One real project ("Long Way Down") is seeded with sample content; the project switcher's other entries are decorative for now.

## Tech stack

- **React 18 + Vite** — no router; view switching is a small state machine in `ProjectContext` (`{ name, payload }`), same pattern the original mockup used.
- **ProseMirror** — the screenplay editor (`src/editor/`), a self-contained module by design (see [Architecture](#architecture) below).
- **React Context + `localStorage`** — all app state, no external state library. Autosaves on every change.
- **Plain CSS custom properties** — dark/light theme via `[data-theme]`, no CSS framework.

## Getting started

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. `npm run build` / `npm run preview` for a production build.

## What's built

**App shell** — collapsible sidebar (capped to viewport height), project switcher (static list, no real search yet), unified file tree, Settings pinned at the bottom, live autosave footer.

**Outline / Beats** (default view) — kanban board, acts as columns (add, rename in place), beat cards with:
- click-to-edit title/description
- native HTML5 drag-and-drop with a drop-indicator line (mouse/trackpad only — see [Known limitations](#known-limitations))
- scene numbers (`SC. 01`, etc.) computed live from card order, not stored
- a flag toggle (real `isFlagged` data field, not just a visual effect)
- right-click menu (Edit / Delete) and matching icon buttons, with a shared confirm-before-delete popover — deleting a card also removes its scene from the actual script

**Screenplay view** — read-only, renders live from the same document the Editor edits (not a separate copy). Click any line to jump to the Editor at that exact spot.

**Editor** — ProseMirror-based, six screenplay element types (scene heading, action, character, dialogue, parenthetical, transition) with correct margins/caps per type. Tab / Shift-Tab cycles element type; Enter smart-continues into whichever type usually follows; a Notion-style slash-command menu (`/`) offers all six, filtered by prefix match, navigable with arrow keys. Scroll-to-anchor when opened from a beat card or a screenplay line, with a Back button in the top bar.

**Settings** — Dark/Light theme toggle, persisted.

**Data model** — beat cards hold editorial summary (title, description, `isFlagged`) plus a `sceneId`, which is the literal node id of that scene's heading in the screenplay document. That id is the one anchor the Outline, Screenplay view, and Editor all use to point at the same spot — see `src/editor/schema.js` and `src/state/sampleData.js`.

## What's stubbed (not real yet)

- **Character Bible** — sidebar folder exists (`Mara`, `Eli`) but opens a generic "coming soon" placeholder, not an actual document.
- **Notes & Research** — same: folder + file list (`Character voice`, `Timeline`) with no real content behind them.
- **Trash** — folder exists in the sidebar, but it's not wired to anything. Beat card deletion is currently **permanent** — there's no soft-delete/recovery path yet.
- **Project switcher** — the dropdown lists 10 project names; only "Long Way Down" has real data. Selecting another just shows a toast.
- **Export PDF** — button exists, shows a "not wired up" toast.
- **`.fountain` import/export** — not built. The document persists as ProseMirror JSON, not Fountain.
- **"+" add file** (file tree header) — placeholder toast.

## Roadmap

Roughly in the order they'd unblock real use:

1. **Character Bible screens** — one document per character (physical description, voice/speech patterns, backstory, relationships, arc notes), replacing the current stub.
2. **Notes & Research screens** — free-form docs, same underlying editor as Character Bible.
3. **A shared markdown editor module** — Character Bible and Notes & Research both need a lighter editor than the screenplay one (no element-type cycling, no Fountain concerns). Worth building as its own small module rather than repurposing the ProseMirror screenplay schema.
4. **Real Trash / soft delete** — right now "Delete" on a beat card is permanent. Needs an actual trash mechanism before that's safe to rely on.
5. **`.fountain` serializer + parser** — doc → Fountain (for export and true portability) and Fountain → doc (for import). Called out in the original planning doc as a small, well-scoped task once there's an actual document to serialize — there is now.
6. **PDF export** — proper pagination, scene numbers, title page.
7. **Multi-project support** — real project switching and creation; the switcher is currently decorative for everything but the one seeded project.
8. **Project search** — the search bar in the project switcher is visual only.
9. **Touch drag-and-drop** — see [Known limitations](#known-limitations).
10. **Revision history** — explicitly deferred during planning; can come back if it turns out to be needed.
11. **iOS / Mac ports** — the original platform order (web → iOS → Mac) is why the Editor is kept as a self-contained module.

## Architecture

- **The screenplay document is the single source of truth.** It's a flat ProseMirror-shaped JSON tree (`project.screenplayDoc`) — see `src/editor/schema.js`. The Screenplay view renders it read-only; the Editor edits it live; nothing else holds a separate copy of scene content.
- **Stable `id` anchors tie everything together.** Every node in the document carries an `id`. A beat card's `sceneId` is literally the `id` of that scene's heading node — that's what lets the Outline, Screenplay view, and Editor all point at the same spot without a separate lookup table.
- **The editor is self-contained** (`src/editor/`) — schema, keymap, plugins, slash menu. No other part of the app imports ProseMirror directly. That isolation is deliberate: the care package's platform order is web first, then iOS, then Mac, and keeping the editor decoupled is what makes that porting path realistic later.

## Known limitations

- **No touch support for drag-and-drop.** Native HTML5 DnD (used for the Outline board) doesn't work on iPad Safari or other touch devices — mouse/trackpad only. Accepted gap, not a bug, per the original planning decision to defer pulling in a real DnD library.
- **No backend.** Everything is `localStorage`, scoped to one browser on one device. Clearing site data loses everything.
- **Beat card deletion is permanent.** No undo, no Trash yet (see [Roadmap](#roadmap)).
