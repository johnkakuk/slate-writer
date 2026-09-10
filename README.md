# Slate Writer

A purpose-built screenwriting web app — a lighter, local-first alternative to Arc Studio. Dark "Production Deck" theme (with a light mode), Courier New throughout, `.fountain`-flavored portability as the long-term goal. First real use case: adapting the short story "Long Way Down" into a short-film screenplay.

## Status

Local-first, multi-project. No backend, no accounts, no sync — everything lives in the browser's (or, on iOS, the app's) `localStorage`. Ships as a web app and, via Capacitor, an iOS app shell — see [Running on iOS](#running-on-ios).

## Tech stack

- **React 18 + Vite** — no router; view switching is a small state machine in `ProjectContext` (`{ name, payload }`), same pattern the original mockup used.
- **ProseMirror** — the screenplay editor (`src/editor/`), a self-contained module by design (see [Architecture](#architecture) below).
- **React Context + `localStorage`** — all app state, no external state library. Autosaves on every change.
- **Plain CSS custom properties** — dark/light theme via `[data-theme]`, no CSS framework.
- **Capacitor** — wraps the built web app in a native iOS shell for on-device installs. No React Native — see [Running on iOS](#running-on-ios) for why.

## Getting started

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. `npm run build` / `npm run preview` for a production build.

## What's built

**App shell** — collapsible sidebar (capped to viewport height), unified file tree, Settings pinned at the bottom, live autosave footer.

**Multi-project** — the project switcher is backed by real, fully isolated projects (acts, screenplay, Character Bible, Notes & Research each scoped per project), with search-as-you-type and a "+ New Project" flow. New projects provision from a standard empty 3-act template. Right-click a project for Rename (inline, same pattern as the beat-card/act title editing) or Delete (confirm-protected; you can't delete your only remaining project).

**Outline / Beats** (default view) — kanban board, acts as columns (add, rename in place), beat cards with:
- click-to-edit title/description
- native HTML5 drag-and-drop with a drop-indicator line (mouse/trackpad only — see [Known limitations](#known-limitations))
- scene numbers (`SC. 01`, etc.) computed live from card order, not stored
- a flag toggle (real `isFlagged` data field, not just a visual effect)
- trash / pencil / flag icons plus a right-click menu (Edit / Delete), delete confirm-protected — deleting a card also removes its scene from the actual script
- double-click anywhere on the card (including its text) opens the Editor at that scene, *unless* you're mid-edit in a text field, in which case it's treated as a normal double-click-to-select-a-word instead (distinguished by how long the field's been focused, not just whether it is)

**Screenplay view** — read-only, renders live from the same document the Editor edits (not a separate copy). Click any line to jump to the Editor at that exact spot.

**Editor** — ProseMirror-based, six screenplay element types (scene heading, action, character, dialogue, parenthetical, transition) with correct margins/caps per type. Tab / Shift-Tab cycles element type; Enter smart-continues into whichever type usually follows; a Notion-style slash-command menu (`/`) offers all six, filtered by prefix match, navigable with arrow keys. Scroll-to-anchor when opened from a beat card or a screenplay line, with a Back button in the top bar.

**Character Bible / Notes & Research** — real markdown documents now, not placeholders, with a live WYSIWYG editor (`src/richtext/`, ProseMirror via `prosemirror-markdown` + `prosemirror-example-setup` — a second, independent ProseMirror module from the screenplay editor, with its own plain schema: headings, lists, blockquote, bold/italic/code). Type `#`/`##`/etc. for headings, `-`/`*`/`1.` for lists (Tab/Shift-Tab to indent), `**bold**`/`*italic*`/`` `code` `` for marks — all format live as you type, not just on save. Storage stays plain markdown text underneath (`doc.content`), same as before. A doc's sidebar title is derived live from its first `# heading` line, so renaming it is just editing that line. New docs seed from a basic template (care package's character-doc sections: physical description, voice & speech patterns, backstory, relationships, arc notes; a bare heading for notes) — each heading is followed by a real blank line you can click straight into, not just adjacent newlines (see the NBSP note in Architecture). Right-click a file for Edit / Duplicate / Delete (delete confirm-protected, same pattern as beat cards).

**Settings** — Dark/Light theme toggle; a font picker (`src/state/fontOptions.js`) with 15 curated options across Monospace/Serif/Sans-serif, each shown live in itself in a custom dropdown, applied app-wide (chrome and script pages alike) via one `--font-family` CSS variable. Both persisted.

**Data model** — beat cards hold editorial summary (title, description, `isFlagged`) plus a `sceneId`, which is the literal node id of that scene's heading in the screenplay document. That id is the one anchor the Outline, Screenplay view, and Editor all use to point at the same spot — see `src/editor/schema.js` and `src/state/sampleData.js`. Character Bible / Notes & Research docs are `{ id, content }` — no separate title field; see `titleFromMarkdown` in `src/utils/markdown.js`.

## Running on iOS

Slate Writer ships as an iOS app via **Capacitor** (`ios/` — a generated native Xcode project wrapping the built web app in a WebView), not React Native.

**Why not React Native:** the editor is built on ProseMirror, which manipulates a real browser DOM (`contentEditable`, `Selection`/`Range`, `MutationObserver`) — none of that exists in React Native's runtime. Same problem for the Outline board's native HTML5 drag-and-drop, and for all the CSS. Getting this app onto literal React Native would mean rebuilding the editor, the board's drag-and-drop, and every screen's styling from scratch. Capacitor instead packages the existing app as-is — nothing was rewritten to get here.

**To build and run:**
```
npm run build
npx cap sync ios
npx cap open ios     # opens the Xcode project
```
Then in Xcode: pick your iPad as the run destination (or a Simulator), select a Development Team under Signing & Capabilities (first time only — needs your Apple ID added in Xcode → Settings → Accounts), and hit Run.

**One known snag on this machine:** this Xcode install (26.6) is missing the iOS 26.5 device-platform component, which blocks even Simulator builds from the command line (`xcodebuild` reports "Supported platforms for the buildables in the current scheme is empty"). The Simulator *runtime* itself is fine (`xcrun simctl boot` works) — this is specifically about the missing platform-support download. Opening the project in Xcode.app directly should prompt to download the missing component (Xcode → Settings → Components); that's the path this couldn't take unsupervised overnight since it's a multi-GB download.

**App icon / splash screen:** placeholder (a plain green "S" mark) generated from `assets/icon.png` / `assets/splash.png` via `npx capacitor-assets generate --ios`. Swap those two source files for real artwork and rerun that command to regenerate everything in `ios/App/App/Assets.xcassets`.

**Bonus, and unrelated to the above:** the web app also has a PWA manifest (`public/manifest.json`), so "Add to Home Screen" from Mobile Safari gives a full-screen app icon with zero native tooling at all — works today, no Xcode required, though it's not an App Store-installable app.

**Important:** the Capacitor wrapper does not fix the touch drag-and-drop gap below — it's the same web code, just in a native shell. Reordering the Outline board still needs a mouse/trackpad (e.g., an attached trackpad, or Sidecar/a Mac) until that gap is actually addressed.

## What's stubbed (not real yet)

- **Trash / soft delete** — doesn't exist yet, not even a placeholder in the sidebar (deliberately removed rather than left as dead UI). Beat card and doc deletion are currently **permanent**.
- **Export PDF** — button exists, shows a "not wired up" toast.
- **`.fountain` import/export** — not built. The screenplay persists as ProseMirror JSON, not Fountain.
- **"+" add file** (file tree header, next to the project name) — placeholder toast; use the per-folder "+" next to Character Bible / Notes & Research instead, which are real.

## Roadmap

Roughly in the order they'd unblock real use:

1. **Trash / soft delete** — right now "Delete" (beat cards, docs, and projects alike) is permanent. Needs an actual trash mechanism before that's safe to rely on; deliberately not a stub UI in the meantime.
2. **`.fountain` serializer + parser** — doc → Fountain (for export and true portability) and Fountain → doc (for import). Called out in the original planning doc as a small, well-scoped task now that there's an actual document to serialize.
3. **PDF export** — proper pagination, scene numbers, title page.
4. **Touch drag-and-drop** — see [Known limitations](#known-limitations); matters more now that there's a real iPad app to use it on.
5. **Revision history** — explicitly deferred during planning; can come back if it turns out to be needed.
6. **Real app icon / splash art** — current one is a placeholder green "S," see [Running on iOS](#running-on-ios).
7. **Mac port** — the original platform order (web → iOS → Mac) is why the Editor is kept as a self-contained module; iOS is now covered, Mac is the remaining leg.
8. **Multiple selections** - enable multiple file selections and bulk operations in sidebar menu

## Architecture

- **The screenplay document is the single source of truth.** It's a flat ProseMirror-shaped JSON tree (`project.screenplayDoc`) — see `src/editor/schema.js`. The Screenplay view renders it read-only; the Editor edits it live; nothing else holds a separate copy of scene content.
- **Stable `id` anchors tie everything together.** Every node in the document carries an `id`. A beat card's `sceneId` is literally the `id` of that scene's heading node — that's what lets the Outline, Screenplay view, and Editor all point at the same spot without a separate lookup table.
- **The editor is self-contained** (`src/editor/`) — schema, keymap, plugins, slash menu. No other part of the app imports ProseMirror directly. That isolation is deliberate: the care package's platform order is web first, then iOS, then Mac, and keeping the editor decoupled is what makes that porting path realistic.
- **One `projects` map + a `currentProjectId`, not a single `project`.** Every mutator in `ProjectContext` goes through one `updateCurrentProject(updater)` helper, so nothing else needs to know how the map is keyed. Persisted state migrates automatically from the earlier single-project shape.
- **Blank markdown paragraphs are stored as a lone U+00A0 (non-breaking space), not truly empty.** Markdown has no way to represent an empty paragraph — a blank line is just a block separator, not content, so it never survives parsing (verified empirically: any number of blank lines between headings still parses to zero paragraph nodes). A lone NBSP does survive a full parse/serialize round trip and renders indistinguishably from blank, which is what lets intentional whitespace (template gaps, or anything the user leaves blank) persist across save/reload instead of silently vanishing. See `markdownSerde.js`'s custom `paragraph` serializer and `docTemplates.js`.
- **The rich markdown editor's mark shortcuts (`**bold**`, `*italic*`, `` `code` ``) are hand-rolled**, not from `prosemirror-example-setup` — it only ships block-level input rules (heading, list, blockquote, code block), nothing for inline marks. See `markInputRules.js`.

## Known limitations

- **No touch support for drag-and-drop.** Native HTML5 DnD (used for the Outline board) doesn't work on iPad Safari (or the Capacitor app's WebView) or other touch devices — mouse/trackpad only. Accepted gap, not a bug, per the original planning decision to defer pulling in a real DnD library — but see [Running on iOS](#running-on-ios) for why it matters more now.
- **No backend.** Everything is `localStorage`, scoped to one browser (or the one iOS app) on one device. Clearing site data / deleting the app loses everything.
- **Beat card, doc, and project deletion are all permanent.** No undo, no Trash yet (see [Roadmap](#roadmap)).

