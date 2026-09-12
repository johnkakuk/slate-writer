# Slate Writer

A lightweight, local-first screenwriting app.

## Status

Local-first, multi-project, with no backend or accounts. The web app stores state in `localStorage`; iOS and Electron use SQLite. The installed iOS and macOS apps also support optional shared-folder sync through a folder you choose, including iCloud Drive. Ships as a web app, an iOS app shell via Capacitor (see [Running on iOS](#running-on-ios)), and a native desktop app via Electron (see [Running on Desktop](#running-on-desktop)).

## Tech stack

- **React 18 + Vite** — no router; view switching is a small state machine in `ProjectContext` (`{ name, payload }`).
- **ProseMirror** — the screenplay editor (`src/editor/`), a self-contained module by design.
- **React Context + platform storage** — all app state, no external state library. Autosaves on every change to browser `localStorage` or native SQLite (`src/state/nativeSqliteStorage.js` on iOS, `electron/main.cjs` on desktop).
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

**App shell** — iOS status-bar clearance at the top, app surfaces extending to the bottom edge, and home-indicator clearance inside the sidebar footer. Collapsible sidebar contains unified file tree, Settings, and a compact footer for autosave and sync status.

**Multi-project** — Each project contains an outline/beat editor, a screenplay view, and a title page editor. A markdown notebook system is in place as well for keeping track of other data. Contextual menus are used as needed throughout.

**Outline / Beat Editor** (default view) — kanban board, acts as columns, beat cards with:
- click-to-edit title/description
- drag-and-drop with a drop-indicator line, plus a dedicated touch drag handle for moving cards on iPad
- a flag toggle
- trash / pencil / flag icons plus a right-click menu (Edit / Delete), delete confirm-protected
- double-click anywhere on the card (including its text) opens the Editor at that scene, *unless* you're mid-edit in a text field, in which case it's treated as a normal double-click-to-select-a-word instead (distinguished by how long the field's been focused, not just whether it is)
- act columns: hover-highlighted title, right-click for Rename (focuses and selects the title in place) or Delete (confirm-protected — takes every card in the act with it)

**Title Page** — a dedicated view for the exported PDF's first page: title, credit line, author, an optional "based on" line, and contact/draft info pinned to the page's bottom corners. Plain fields styled as a live preview of the actual printed layout — WYSIWYG.

**Screenplay view** — read-only, a live concatenation of every beat card's own scene content, in outline order — not a separately stored document, so reordering, editing, adding, or deleting beats is reflected here immediately with nothing to keep in sync. Click any line to jump into the Editor at that exact spot, caret placed at the *end* of that line's text — ready to keep writing, not re-reading from the top. Export PDF lives here, top-right.

**Editor** — ProseMirror-based, six screenplay element types (scene heading, action, character, dialogue, parenthetical, transition) with correct margins/caps per type. Each beat card owns its own scene document (`card.sceneDoc`) — opening a different beat is a genuinely separate document, not a scroll position within a shared one.

The top-right fullscreen icon hides the sidebar and editor headers for focused writing. In fullscreen it stays visible at half opacity; click it again or press Escape to leave. Your selection, undo history, and sidebar preference are retained.

Available automations:
- Tab / Shift-Tab cycles element type, except on empty Character blocks or blocks containing a recent character name.
- For these, Tab cycles names forward and Shift-Tab backward, wrapping through the same list.
- Enter smart-continues into whichever type usually follows (Character → Dialogue → Character, etc.), and on an already-blank line drops back to Action instead of chaining another empty element.
- A Notion-style slash-command menu (`/`) offers all six types, filtered by prefix match, navigable with arrow keys. Previous / Next controls in the header walk every beat across every act in outline order. Scroll-to-anchor when opened from a beat card or a Screenplay line, with a Back button in the top bar.
- Automatic Parentheticals. When enabled, typing `(` in an empty Dialogue or Action block changes it to Parenthetical. This also works after finishing dialogue: press Enter, then type `(` in the empty Character cue to add a trailing direction.
- Enter after a parenthetical **continues as Dialogue**; use `/C` and Enter to choose a new Character instead. Parentheticals stay closely attached to their dialogue, with extra separation before the next character. The editor and read-only Screenplay view share these spacing rules.

**Typewriter Mode and touch editing** — Settings offers paragraph, line, underline, or no highlight. Typewriter Mode keeps the active line at its scrolling anchor while writing. Has been very buggy with caret placement on tap/click reposition, but mostly fixed. See [CARET_INVESTIGATION.md](CARET_INVESTIGATION.md) for the evidence and validation.

**Pasting multi-line text is Fountain-aware** (`src/editor/fountainParse.js` + `fountainPastePlugin.js`): `INT.`/`EXT.` lines become scene headings, a capitalized line with a blank line before it and dialogue right after becomes a character cue, `(parenthetical)`-shaped lines and `TO:`-ending transitions get their own types, and everything else lands as action or continuing dialogue — so a scene written by Claude or ChatGPT (or copied from a `.fountain` file) pastes in already formatted instead of landing as one flat block. Fountain's own forced-type markers work too (`@` character, `>` transition, `.` scene heading, `!` action). A single-line paste (no newline) is untouched, normal inline text entry — this only kicks in for genuinely multi-block pastes.

**Markdown Editor** — real markdown documents, with a live WYSIWYG editor (`src/richtext/`, ProseMirror via `prosemirror-markdown` + `prosemirror-example-setup` — a second, independent ProseMirror module from the screenplay editor, with its own plain schema: headings, lists, blockquote, bold/italic/code). Type `#`/`##`/etc. for headings, `-`/`*`/`1.` for lists (Tab/Shift-Tab to indent), `**bold**`/`*italic*`/`` `code` `` for marks — all format live as you type, not just on save.

New docs seed from an optional template. Right-click a file for Edit / Duplicate / Delete (delete confirm-protected, same pattern as beat cards).

**Settings** — Dark/Light theme toggle; two independent font pickers (`src/state/fontOptions.js`), 15 curated options across Monospace/Serif/Sans-serif, each shown live in itself in a custom dropdown — one for the UI (chrome, sidebar, cards), one for the script (Editor + Screenplay view), laid out side by side in a two-column grid that collapses to one column on narrow viewports. Both persisted independently. Typewriter Mode, highlight style, and Automatic Parentheticals are also configurable here. On iOS and macOS Electron, iCloud Sync connects to a shared folder, with per-document revisions, advisory editing guards, conflict choices, and recovery history. See [Shared-folder sync](SYNC.md) for setup and handoff instructions. The web/PWA build remains local.

**Export PDF** — a full industry-format screenplay PDF (`src/export/screenplayPdf.js`), triggered from the Screenplay view: the Title Page followed by every beat's scene content concatenated in outline order — 12pt Courier, standard 1.5"/1" margins and per-element indents, bold scene headings/character cues/transitions (matching the in-app read-only view), correct blank-line spacing between elements (with extra breathing room before a new scene heading), and page numbers starting on script page 2.

## Running on iOS

Slate Writer ships as an iOS app via **Capacitor** (`ios/` — a generated native Xcode project wrapping the built web app in a WebView).

**To build and run:**
```
npm run build
npx cap sync ios
npx cap open ios     # opens the Xcode project
```
Then in Xcode: pick your iPad as the run destination (or a Simulator), select a Development Team under Signing & Capabilities (first time only — needs your Apple ID added in Xcode → Settings → Accounts), and hit Run.

After shared editor or CSS changes, rebuild and sync again, then Stop/Run in Xcode to install the updated assets. The same `src/` code powers web, iOS, and Electron; each packaged app or hosted web deployment must be rebuilt to receive changes.

**Bonus, and unrelated to the above:** the web app also has a PWA manifest (`public/manifest.json`), so "Add to Home Screen" from Mobile Safari gives a full-screen app icon with zero native tooling at all — works today, no Xcode required, though it's not an App Store-installable app.

## Running on Desktop

Slate Writer also ships as a native desktop app via **Electron** (`electron/main.cjs` — a `BrowserWindow` loading the built web app), packaged with `electron-builder`. State is stored in `slate-writer.db` under Electron's user-data directory (`~/Library/Application Support/Slate Writer` on macOS). Older localStorage state migrates when the database is first populated. Optional shared-folder sync runs alongside local SQLite autosave. Desktop scripts also compile the native Swift file-coordination helper (requires Xcode command-line tools on macOS).

**To build and run:**
```
npm run electron:dev       # dev mode, hot-reloads against the Vite dev server
npm run electron:preview   # builds once, then launches Electron against dist/ (quick manual check, no packaging)
npm run electron:dist      # builds and packages a real installable app (release/)
```
`electron:dist` targets a macOS `.dmg` in `release/`, with the unpacked application alongside it. To explicitly build for Apple Silicon, run `npm run electron:dist -- --mac --arm64`. Signing depends on the certificates available on the build machine; this project does not configure notarization. Add `win`/`linux` targets to `build` in `package.json` when those platforms are needed.


## What's stubbed (not real yet)

- **Trash / soft delete** — doesn't exist yet, not even a placeholder in the sidebar (deliberately removed rather than left as dead UI). Without sync history, deleted writing is not recoverable. Once folder sync has been enabled, its recovery history can restore writing into a separate project; there is still no conventional Trash UI.
- **`.fountain` file import/export** — not built. Each scene persists as ProseMirror JSON, not Fountain. (Pasting Fountain-*formatted text* into the Editor does work, and reuses the same line-classification logic a real `.fountain` importer would need — see [What's built](#whats-built) — but there's no way to open or save an actual `.fountain` file yet.)

## Roadmap

Roughly in the order they'd unblock real use:

1. **Web/account-based sync** — iCloud folder sync now covers the installed iOS and macOS apps. Browser access and non-Apple platforms would need a separate transport/backend.
2. **Trash / soft delete** — add a conventional Trash UI. Sync-enabled libraries now retain deleted writing in recovery history.
3. **`.fountain` file serializer + parser** — doc → Fountain (for export and true portability) and Fountain → doc (for opening a `.fountain` file directly, not just pasting its contents). The line-classification half of the parser direction already exists (`src/editor/fountainParse.js`, built for paste) — this is mostly "read/write an actual file" plus a doc → Fountain serializer.
4. **PDF export polish** — `(MORE)` / `(CONT'D)` markers when Dialogue itself splits across a page break; see [Known limitations](#known-limitations).
5. **Touch interaction polish** — continue testing drag handles, scrolling, and editing on physical devices.
6. **Revision history polish** — sync now retains recoverable revisions; compacting long histories while supporting offline devices remains future work.
7. **Real app icon / splash art** — both iOS and desktop currently use the same placeholder green "S" mark (`assets/icon.png`), see [Running on iOS](#running-on-ios) and [Running on Desktop](#running-on-desktop).
8. **Multiple selections** - enable multiple file selections and bulk operations in sidebar menu

## Future consideration: App Store release

A one-time **$4.99 iPad app** is a possible future release, not a committed launch plan. Slate's screenplay editor, outline board, local persistence, PDF export, and optional iCloud folder sync give it a credible basis for Apple's minimum-functionality requirement. Capacitor is not itself a barrier, but approval depends on the submitted app and App Review. See [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Before submitting:

- **Bundle fonts locally**, with their required licenses. The current Google Fonts requests can leave offline installs using fallback fonts; typography and pagination should remain consistent without a connection.
- **Choose device support deliberately.** The Xcode project currently targets iPhone and iPad. Consider an iPad-only first release unless the phone experience is also fully tested.
- **Complete privacy and SDK disclosures.** Add an accessible privacy-policy link in the app and store listing, complete App Store privacy answers, and audit privacy manifests and required-reason API declarations across native code and dependencies. Apple explicitly lists Capacitor in its [third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/).
- **Validate a clean release install:** touch-only and hardware-keyboard writing, export, airplane-mode editing and relaunch, sync conflicts, and upgrades that preserve existing documents. Prioritize dependable backup and recovery before taking responsibility for customers' writing.
- **Prepare the listing and support:** final icon/screenshots, description, support contact/page, and review notes explaining that iCloud folder setup is optional. Describe sync's advisory editing guards accurately; do not promise strict locking or instant delivery.

Distribution requires the [Apple Developer Program](https://developer.apple.com/programs/enroll/) ($99 USD/year as of September 2026). Free Personal Team provisioning expires after seven days, so periodic Xcode reinstalls remain the current personal-use bridge; see [Apple's account limits](https://developer.apple.com/help/account/basics/about-your-developer-account). Release configuration alone does not eliminate signing verification requirements.

If enrolled and eligible for the [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/), its standard 15% commission leaves approximately $4.24 from a $4.99 sale before applicable taxes and adjustments—roughly 24 sales to cover annual membership, excluding other costs. Recheck pricing and Apple policies when a release is planned.

## Known limitations

- **iCloud delivery and editing warnings are advisory.** The installed iOS and macOS apps can share a selected iCloud Drive folder. Apple controls propagation, so immediate delivery and strict exclusive editing are not guaranteed. Conflicting edits retain both versions. Web/PWA state remains separate. See [SYNC.md](SYNC.md).
- **Occasional caret movement while scrolling upward on iPad.** Intentional tap placement passed the user's physical-device retest, including Typewriter Line mode. A few scrolling-related occurrences remain; see [CARET_INVESTIGATION.md](CARET_INVESTIGATION.md).
- **No Trash UI yet.** Recovery history retains writing after folder sync has been enabled; earlier deletions have no recovery history. Keep independent backups.
- **PDF export doesn't add `(MORE)` / `(CONT'D)` markers when Dialogue splits across a page break.** A Character cue is always kept with at least its Dialogue's first line (see [Architecture](#architecture)), and a monologue longer than a full page does correctly continue onto the next one rather than running off the bottom — it just does so silently, without the marked-continuation convention a reader would expect.
- **Blank lines in Character Bible / Notes & Research docs don't survive save/reload.** Markdown has no native way to represent a truly empty paragraph — a blank line is just a block separator, not content — so any blank line collapses away on the next load. (An earlier NBSP-based workaround existed for this and was deliberately removed as not worth the added complexity; type your own line breaks back in if this bites you.)
