# Slate Writer

A purpose-built screenwriting web app — a lighter, local-first alternative to Arc Studio. Dark "Production Deck" theme (with a light mode), Courier New throughout, `.fountain`-flavored portability as the long-term goal. First real use case: adapting the short story "Long Way Down" into a short-film screenplay.

## Status

Local-first, multi-project. No backend, no accounts, no sync — everything lives in the browser's (or, on iOS/desktop, the app's) `localStorage`. Ships as a web app, an iOS app shell via Capacitor (see [Running on iOS](#running-on-ios)), and a native desktop app via Electron (see [Running on Desktop](#running-on-desktop)).

## Tech stack

- **React 18 + Vite** — no router; view switching is a small state machine in `ProjectContext` (`{ name, payload }`), same pattern the original mockup used.
- **ProseMirror** — the screenplay editor (`src/editor/`), a self-contained module by design (see [Architecture](#architecture) below).
- **React Context + `localStorage`** — all app state, no external state library. Autosaves on every change.
- **Plain CSS custom properties** — dark/light theme via `[data-theme]`, no CSS framework.
- **Capacitor** — wraps the built web app in a native iOS shell for on-device installs. No React Native — see [Running on iOS](#running-on-ios) for why.
- **jsPDF** — client-side screenplay PDF export (`src/export/`). Courier is one of its built-in base-14 fonts, so no font file needs embedding.
- **Electron** — wraps the built web app in a native desktop shell (`electron/main.cjs`), packaged with `electron-builder` — see [Running on Desktop](#running-on-desktop).

## Getting started

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. `npm run build` / `npm run preview` for a production build.

## What's built

**App shell** — collapsible sidebar (capped to viewport height), unified file tree, Settings pinned at the bottom, live autosave footer. The top bar shows the current project's name, centered, with a Back button on the left when inside the Editor or a doc (returns to wherever you opened it from — the Outline or a specific Screenplay line). The title's position doesn't shift when the Back button appears or disappears.

**Multi-project** — the project switcher is backed by real, fully isolated projects (acts, beats, Character Bible, Notes & Research, and a title page each scoped per project), with search-as-you-type and a "+ New Project" flow. New projects provision from a standard empty 3-act template. Right-click a project for Rename (inline, same pattern as the beat-card/act title editing) or Delete (confirm-protected; you can't delete your only remaining project).

**Outline / Beats** (default view) — kanban board, acts as columns, beat cards with:
- click-to-edit title/description
- native HTML5 drag-and-drop with a drop-indicator line (mouse/trackpad only — see [Known limitations](#known-limitations))
- scene numbers (`SC. 01`, etc.) computed live from card order, not stored
- a flag toggle (real `isFlagged` data field, not just a visual effect)
- trash / pencil / flag icons plus a right-click menu (Edit / Delete), delete confirm-protected — deleting a card removes its scene along with it
- double-click anywhere on the card (including its text) opens the Editor at that scene, *unless* you're mid-edit in a text field, in which case it's treated as a normal double-click-to-select-a-word instead (distinguished by how long the field's been focused, not just whether it is)
- act columns: hover-highlighted title, right-click for Rename (focuses and selects the title in place) or Delete (confirm-protected — takes every card in the act with it)

**Title Page** — a dedicated view for the exported PDF's first page: title, credit line, author, an optional "based on" line, and contact/draft info pinned to the page's bottom corners. Plain fields styled as a live preview of the actual printed layout — this is exactly what prints. Title defaults to the project name until set explicitly.

**Screenplay view** — read-only, a live concatenation of every beat card's own scene content, in outline order — not a separately stored document, so reordering, editing, adding, or deleting beats is reflected here immediately with nothing to keep in sync. Click any line to jump into the Editor at that exact spot, caret placed at the *end* of that line's text — ready to keep writing, not re-reading from the top. Export PDF lives here, top-right, the only place it appears.

**Editor** — ProseMirror-based, six screenplay element types (scene heading, action, character, dialogue, parenthetical, transition) with correct margins/caps per type. Each beat card owns its own scene document (`card.sceneDoc`) — opening a different beat is a genuinely separate document, not a scroll position within a shared one. Tab / Shift-Tab cycles element type; Enter smart-continues into whichever type usually follows (Character → Dialogue → Character, etc.), and on an already-blank line drops back to Action instead of chaining another empty element — the same "I'm done with this" convention Final Draft/Arc Studio use. A Notion-style slash-command menu (`/`) offers all six types, filtered by prefix match, navigable with arrow keys. Previous / Next controls in the header walk every beat across every act in outline order. Scroll-to-anchor when opened from a beat card or a Screenplay line, with a Back button in the top bar.

Pasting multi-line text is Fountain-aware (`src/editor/fountainParse.js` + `fountainPastePlugin.js`): `INT.`/`EXT.` lines become scene headings, a capitalized line with a blank line before it and dialogue right after becomes a character cue, `(parenthetical)`-shaped lines and `TO:`-ending transitions get their own types, and everything else lands as action or continuing dialogue — so a scene written by Claude or ChatGPT (or copied from a `.fountain` file) pastes in already formatted instead of landing as one flat block. Fountain's own forced-type markers work too (`@` character, `>` transition, `.` scene heading, `!` action). A single-line paste (no newline) is untouched, normal inline text entry — this only kicks in for genuinely multi-block pastes.

**Character Bible / Notes & Research** — real markdown documents, with a live WYSIWYG editor (`src/richtext/`, ProseMirror via `prosemirror-markdown` + `prosemirror-example-setup` — a second, independent ProseMirror module from the screenplay editor, with its own plain schema: headings, lists, blockquote, bold/italic/code). Type `#`/`##`/etc. for headings, `-`/`*`/`1.` for lists (Tab/Shift-Tab to indent), `**bold**`/`*italic*`/`` `code` `` for marks — all format live as you type, not just on save. Storage stays plain markdown text underneath (`doc.content`). A doc's sidebar title is derived live from its first `# heading` line, so renaming it is just editing that line. New docs seed from a basic template (character-doc sections: physical description, voice & speech patterns, backstory, relationships, arc notes; a bare heading for notes). Right-click a file for Edit / Duplicate / Delete (delete confirm-protected, same pattern as beat cards).

**Settings** — Dark/Light theme toggle; two independent font pickers (`src/state/fontOptions.js`), 15 curated options across Monospace/Serif/Sans-serif, each shown live in itself in a custom dropdown — one for the UI (chrome, sidebar, cards), one for the script (Editor + Screenplay view), laid out side by side in a two-column grid that collapses to one column on narrow viewports. Both persisted independently.

**Export PDF** — a full industry-format screenplay PDF (`src/export/screenplayPdf.js`), triggered from the Screenplay view: the Title Page followed by every beat's scene content concatenated in outline order — 12pt Courier, standard 1.5"/1" margins and per-element indents, bold scene headings/character cues/transitions (matching the in-app read-only view), correct blank-line spacing between elements (with extra breathing room before a new scene heading), and page numbers starting on script page 2. A Character cue is never left stranded alone at the bottom of a page with its Dialogue pushed to the next one — both move together. Reads directly from the same per-card scene documents the Editor and Screenplay view use, so there's nothing separate to keep in sync (see [Known limitations](#known-limitations) for what it doesn't do yet).

**Data model** — beat cards each own their scene outright (`card.sceneDoc`, a ProseMirror-shaped JSON tree — see `src/editor/schema.js`) rather than anchoring into one shared whole-script document. The Screenplay view and PDF export are both live concatenations of every card's `sceneDoc` in outline order, computed fresh each time. A project persisted before this shape existed migrates automatically the first time it loads (`migrateProjectToPerCardDocs` in `ProjectContext.jsx`). Each project also carries a `titlePage` (title, credit line, author, based-on, contact, draft info) used by both the Title Page editor and PDF export; older projects backfill a default on load. Character Bible / Notes & Research docs are `{ id, content }` — no separate title field; see `titleFromMarkdown` in `src/utils/markdown.js`.

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

## Running on Desktop

Slate Writer also ships as a native desktop app via **Electron** (`electron/main.cjs` — a `BrowserWindow` loading the built web app), packaged with `electron-builder`. Same `localStorage`-backed persistence as the web app — Electron's default session persists it to disk (`~/Library/Application Support/Slate Writer` on macOS) automatically, so data survives quitting and relaunching the app. Verified by actually closing and relaunching the packaged app and confirming state survives, not just by reasoning about how Electron sessions are supposed to work.

**To build and run:**
```
npm run electron:dev       # dev mode, hot-reloads against the Vite dev server
npm run electron:preview   # builds once, then launches Electron against dist/ (quick manual check, no packaging)
npm run electron:dist      # builds and packages a real installable app (release/)
```
`electron:dist` currently targets a macOS `.dmg` (`build.mac` in `package.json`) — unsigned, since there's no Apple Developer ID configured, so macOS Gatekeeper will warn on first open (right-click → Open bypasses it). Add `win`/`linux` targets to `build` in `package.json` when those platforms are needed.

**Packaging note:** `build.files` explicitly excludes `node_modules` — the renderer only ever loads the already-bundled `dist/` output, and the main process only touches Electron/Node built-ins, so none of the app's own npm dependencies (React, ProseMirror, jsPDF, etc.) need to physically exist inside the packaged app. Leaving that default in would have quietly bundled every dependency (including unrelated ones like the Capacitor/iOS tooling) into the app for no reason.

**One dependency-resolution snag hit while setting this up:** `electron-builder`'s DMG-blockmap step pulls in `@noble/hashes`, and the version it resolved to (2.x) is ESM-only while `electron-builder` `require()`s it — crashes immediately on `vite build && electron-builder`. Fixed with an `overrides` entry in `package.json` pinning `@noble/hashes` to the last 1.x release (still has a CommonJS build). Remove the override if a future `electron-builder` release fixes this upstream.

**App icon:** the same placeholder green "S" mark used on iOS (`assets/icon.png`), converted to `build/icon.icns` via `sips`/`iconutil` (both macOS built-ins, no extra dependency) and wired in via `build.mac.icon` in `package.json`. Regenerate it the same way if `assets/icon.png` ever changes — there's no automated regen step for the desktop build the way `capacitor-assets` provides for iOS.

## What's stubbed (not real yet)

- **Trash / soft delete** — doesn't exist yet, not even a placeholder in the sidebar (deliberately removed rather than left as dead UI). Beat card and doc deletion are currently **permanent**.
- **`.fountain` file import/export** — not built. Each scene persists as ProseMirror JSON, not Fountain. (Pasting Fountain-*formatted text* into the Editor does work, and reuses the same line-classification logic a real `.fountain` importer would need — see [What's built](#whats-built) — but there's no way to open or save an actual `.fountain` file yet.)
- **"+" add file** (file tree header, next to the project name) — placeholder toast; use the per-folder "+" next to Character Bible / Notes & Research instead, which are real.

## Roadmap

Roughly in the order they'd unblock real use:

1. **Cloud backend (MongoDB + real user auth), deployed on Vercel** — the actual "access it from anywhere" goal. A genuine architecture shift, not a feature add: every `localStorage` read/write in `ProjectContext` becomes a network call, autosave becomes debounced instead of instant, and it needs a decision between bolting a thin `/api` layer onto the current Vite SPA or migrating to Next.js (which makes serverless functions + auth on Vercel considerably less painful). Deliberately deferred in favor of the Electron desktop build below, which unblocks real use today with no rewrite.
2. **Trash / soft delete** — right now "Delete" (beat cards, acts, docs, and projects alike) is permanent. Needs an actual trash mechanism before that's safe to rely on; deliberately not a stub UI in the meantime.
3. **`.fountain` file serializer + parser** — doc → Fountain (for export and true portability) and Fountain → doc (for opening a `.fountain` file directly, not just pasting its contents). The line-classification half of the parser direction already exists (`src/editor/fountainParse.js`, built for paste) — this is mostly "read/write an actual file" plus a doc → Fountain serializer.
4. **PDF export polish** — `(MORE)` / `(CONT'D)` markers when Dialogue itself splits across a page break; see [Known limitations](#known-limitations).
5. **Touch drag-and-drop** — see [Known limitations](#known-limitations); matters more now that there's a real iPad app to use it on.
6. **Revision history** — explicitly deferred during planning; can come back if it turns out to be needed.
7. **Real app icon / splash art** — both iOS and desktop currently use the same placeholder green "S" mark (`assets/icon.png`), see [Running on iOS](#running-on-ios) and [Running on Desktop](#running-on-desktop).
8. **Multiple selections** - enable multiple file selections and bulk operations in sidebar menu

## Architecture

- **Each beat card owns its scene outright — there's no shared whole-script document.** `card.sceneDoc` is a flat ProseMirror-shaped JSON tree (see `src/editor/schema.js`) holding just that scene's content. The Editor loads and edits exactly one card's `sceneDoc` per mount (keyed on `actId:cardId`, so switching beats is a genuine remount, not a scroll within something shared); the Screenplay view and the PDF export both just concatenate every card's `sceneDoc` in current outline order on every render/build — nothing to keep in sync when beats are added, edited, reordered, or deleted. This replaced an earlier single-shared-document design where every beat opened the *same* document just scrolled to a different spot — see `migrateProjectToPerCardDocs` in `ProjectContext.jsx` for the one-time migration older persisted projects pass through.
- **Stable `id` anchors still matter within a scene.** Every node carries an `id`; a Screenplay-view line click passes its node's `id` as a `blockId` so the Editor can place the caret at that exact line (at its end, not its start) instead of just opening at the top of the scene.
- **The editor is self-contained** (`src/editor/`) — schema, keymap, plugins, slash menu. No other part of the app imports ProseMirror directly. That isolation is deliberate: the care package's platform order is web first, then iOS, then Mac, and keeping the editor decoupled is what makes that porting path realistic.
- **One `projects` map + a `currentProjectId`, not a single `project`.** Every mutator in `ProjectContext` goes through one `updateCurrentProject(updater)` helper, so nothing else needs to know how the map is keyed. Persisted state migrates automatically from the earlier single-project shape.
- **PDF export (`src/export/screenplayPdf.js`) reads the same per-card `sceneDoc`s the Screenplay view does**, flattened the same way, so the exported PDF can never drift from what's on screen. Pagination is atomic per element by default (a block moves to the next page as a whole rather than splitting) except when the block itself is too long to ever fit on one page alone, which falls back to a per-line check instead — otherwise a long monologue would loop forever hunting for room that doesn't exist. A Character cue additionally reserves room for at least its Dialogue's first line, so the pair is never separated by a page break.
- **The rich markdown editor's mark shortcuts (`**bold**`, `*italic*`, `` `code` ``) are hand-rolled**, not from `prosemirror-example-setup` — it only ships block-level input rules (heading, list, blockquote, code block), nothing for inline marks. See `markInputRules.js`.
- **Fountain-aware paste only triggers on a genuinely multi-line clipboard payload** (`fountainPastePlugin.js`'s `handlePaste` bails out immediately if the pasted text has no newline). Without that guard, pasting a single word or phrase mid-sentence -- replacing a selected word, say -- would get reinterpreted as a whole new typed block instead of plain inline text, which would make normal editing feel broken. The classified blocks are inserted via `Slice.maxOpen(Fragment.from(nodes))` + `replaceSelection`, the same primitive ProseMirror's own clipboard handling uses for pasting multiple block-level nodes at once.

## Known limitations

- **No touch support for drag-and-drop.** Native HTML5 DnD (used for the Outline board) doesn't work on iPad Safari (or the Capacitor app's WebView) or other touch devices — mouse/trackpad only. Accepted gap, not a bug, per the original planning decision to defer pulling in a real DnD library — but see [Running on iOS](#running-on-ios) for why it matters more now.
- **No backend.** Everything is `localStorage`, scoped to one browser (or one iOS app, or one desktop app install) on one device — the web, iOS, and Electron builds each have their own separate storage, not a shared one. Clearing site data / deleting the app loses everything. See [Roadmap](#roadmap) for the planned cloud backend that actually unifies this.
- **Beat card, doc, and project deletion are all permanent.** No undo, no Trash yet (see [Roadmap](#roadmap)).
- **PDF export doesn't add `(MORE)` / `(CONT'D)` markers when Dialogue splits across a page break.** A Character cue is always kept with at least its Dialogue's first line (see [Architecture](#architecture)), and a monologue longer than a full page does correctly continue onto the next one rather than running off the bottom — it just does so silently, without the marked-continuation convention a reader would expect.
- **Blank lines in Character Bible / Notes & Research docs don't survive save/reload.** Markdown has no native way to represent a truly empty paragraph — a blank line is just a block separator, not content — so any blank line collapses away on the next load. (An earlier NBSP-based workaround existed for this and was deliberately removed as not worth the added complexity; type your own line breaks back in if this bites you.)

