# Slate Writer — Build Care Package

Handoff doc for Claude Code. This captures every decision made during planning so the build doesn't have to re-litigate them. A reference mockup (`screenplay-app-mockups.html`) is attached — it's an HTML/CSS/JS visual prototype, not production code, but it should be treated as the source of truth for layout, spacing, color, and interaction patterns unless this doc says otherwise.

## What this is

A purpose-built screenwriting web app — an alternative to Arc Studio (which costs $150+/year). First real use case: adapting a short story ("Long Way Down") into a short-film screenplay.

**App name:** Slate Writer

## Platform order

1. Web app (build this first)
2. iOS
3. Mac

Structure the codebase so the screenplay editor is a self-contained module — this is what makes porting to iOS/Mac later tractable.

## v1 scope

In scope:
- Screenplay formatting (the editor)
- Outline / beat board
- PDF export
- Local-first storage, autosave, `.fountain` export (no vendor lock-in)

Explicitly out of scope for v1:
- Collaboration / multiplayer features
- Real search (see Project Switcher below)
- A real drag-and-drop library (see Outline below)

## Visual direction — "Production Deck"

Dark theme, Courier New throughout (body and UI chrome both — this was a deliberate choice after trying a sans-serif UI font and preferring full Courier consistency). Two other directions (a cream/paper "Script Page" style and a corkboard/index-card style) were explored and explicitly rejected. Don't resurrect them.

Rough palette (pull exact values from the mockup's CSS):
- Background: `#14161a` / `#101216` (darker panels)
- Surface: `#1e2127`, borders `#2a2d34` / `#2f333a`
- Text: `#e8e6e1` primary, `#a8ada8` / `#8a8d94` secondary
- Accent: `#5b8c7b` (sage green) — used for active states, current-item highlighting, and the drag drop-indicator line

## Layout shell

- **Left panel**: docked, not an overlay/slide-in drawer. Visible by default. Collapses via a small `‹` button in its own header (collapses to width 0, doesn't overlay content). A small `›` tab appears in the main content top bar to reopen it once collapsed — that's the *only* thing that should appear in the main top bar's left side. No app title/brand and no hamburger icon in the main screen itself; the app identity lives in the sidebar.
- **Top bar** (main content): just the reopen tab (when collapsed) and an Export PDF button, right-aligned.

### Left panel contents, top to bottom

1. **Sidebar header** — "Slate Writer" brand + collapse button.
2. **Project switcher** — a dropdown button showing the current project name (e.g. "Long Way Down"). Clicking it expands to show a search bar (visual only — **no search logic needed yet, John will pick a library later**) and a list of the 10 most recent projects.
3. **One unified file tree** for the current project (not split into a separate nav list + file list — this was explicitly merged after an earlier draft had them as two visually separate sections and it didn't make sense). Top to bottom:
   - **Outline / Beats** — fixed nav item, not a folder. Opens the outline board (default view).
   - **Screenplay** — fixed nav item, sits directly under Outline/Beats. Opens the read-only assembled screenplay view (see below).
   - **Character Bible** — folder, expands to one file per character. Reference doc per character (physical description, voice/speech patterns, backstory, relationships, arc notes) — helps keep continuity on longer pieces.
   - **Notes & Research** — folder, expands to files.
   - **Trash** — folder, collapsed by default.
   - **No "Scenes" folder.** This was deliberately removed — the Outline/Beats board is the single source of truth for scenes. Don't let a build add a duplicate scenes list back in.
4. **Settings** — separate from the tree, own row, pinned to the bottom (it's app-level, not project-level, so it shouldn't visually read as part of the project's file tree).
5. Small "autosaved Xm ago" footer text.

Revision History and Export were both considered as nav items and cut. Export lives on the main top bar instead. Revision history can come back later if it turns out to be needed — don't build it now.

## Outline / Beats (kanban board)

This is the most fleshed-out screen in the mockup — build closely to it.

- **Acts are columns.** Ships with 3 (Act I/II/III) but the user can add more via a "+ add act" button at the end of the row. Column titles are editable in place (click/tap to rename).
- **Beat cards** represent scenes. Each card: a small scene-number/status tag, a bold title, and a short description line. Cards should be sized generously — an earlier version had them small and cramped and that was explicitly called out as wrong.
- **Drag and drop**: implement with **native HTML5 drag-and-drop for v1** — this was a deliberate choice to defer pulling in a real library (dnd-kit, Pragmatic drag-and-drop, react-beautiful-dnd, etc.) until it's actually needed. The mockup implements a placeholder-line pattern: while dragging, a thin accent-colored line (not the card itself) tracks the pointer position and shows exactly where the card will land; the actual card only moves on drop. Reference the mockup's `dragCard`/`allowDrop`/`dropCard`/`getDragAfterElement` functions for the exact approach.
  - **Known limitation, flagged deliberately**: native HTML5 DnD generally does not support touch (iPad Safari, etc.) — it works with mouse/trackpad only. Since iOS is a planned platform, this needs a real solution eventually. Don't try to "fix" this in v1 — it's an accepted gap, not a bug.
- **Add card** button per column.

### Data model note

In the mockup, a beat card is just a title + description (no real content). In the real app, **each beat card needs to reference actual scene content** — a link/ID into the screenplay document, not free text living only on the card. This is the crux of the outline ↔ editor ↔ screenplay-view integration described below.

## Screenplay view (read-only)

New screen, sits alongside Outline/Beats (same nav level, see file tree above).

- Renders **all beats in their current column/card order as one continuous, properly formatted screenplay** — scene headings, action, character names, dialogue — using the same formatting rules as the real editor (this is meant to represent "the actual output" of the script, assembled live from the outline).
- **Not directly editable.** It's a read view.
- **Click anywhere** (any scene heading, action line, or dialogue block) → opens the Editor, scrolled to that exact spot.
- Because this view is *derived* from beat card order rather than being its own stored document, **reordering cards in the Outline needs to trigger a live re-render** of this view — the beat order is the real source of truth, not something synced separately.

## Editor (not yet built — this is the next thing)

Not mocked up yet; no screen exists for it in the HTML prototype. Two placeholder interactions exist and need real implementations:
- Double-clicking a beat card on the Outline board should open the Editor at that scene.
- Clicking any line in the Screenplay view should open the Editor at that exact scene *and* scroll position (not just the file — the line).

This means: **each scene needs a stable anchor/ID** that both the Outline (via its beat cards) and the Screenplay view (via its rendered lines) can reference, and the Editor needs a "scroll/focus to anchor" API. Design the editor's document structure with this in mind from the start rather than retrofitting it.

### Editor tech stack: ProseMirror

Decided after ruling out two alternatives:
- **CodeMirror 6** — tried on a prior project, rejected. Margins/indentation for screenplay elements (dialogue width-capped and indented, character names centered, scene headings full-width caps) get simulated via line-based padding/indent rules on top of a plain-text model, and that approach was "miserable" in practice — it's fighting the tool's fundamental model rather than working with it.
- **Structured `contenteditable` (roll-your-own)** — considered, not chosen; too much surface area (cursor handling, selection, undo/redo, line-type detection) to reimplement from scratch for a project this size.
- **ProseMirror** (chosen) — structured rich-text framework. Define real node types for scene-heading, action, character, dialogue, parenthetical, and transition, each with its own DOM element and CSS — margins/indentation become straightforward per-node-type styling instead of inferred-from-text-patterns. Tab-to-cycle-element-type is a natural fit for ProseMirror's input rules / keymap system. More proven in production than Slate.js, the other rich-text option considered.

**Trade-off accepted knowingly**: ProseMirror's document is its own JSON structure, not plain Fountain text. This means:
- Need a **serializer**: ProseMirror doc → `.fountain` (for save/export/portability)
- Need a **parser**: `.fountain` → ProseMirror doc (for load/import)
- This was explicitly called a small, well-scoped task ("two minutes" for Claude Code) — not a blocker, just needs to get built. Keep it as one clearly separated module so the Fountain round-trip logic doesn't leak into the rest of the editor.

**Formatting behavior for the editor** (from earlier planning, still applies): Tab/Enter should cycle through element types the way real screenwriting software does — auto-detecting scene heading vs. action vs. character vs. dialogue vs. parenthetical vs. transition as you type, with correct margins/caps/spacing baked into each node type's styling.

## Export

- **PDF export** button lives on the main top bar (not buried in a menu). Needs proper pagination, scene numbers, and a title page — this is non-negotiable for it to feel like real software, per earlier planning.
- `.fountain` export ties into the ProseMirror serializer above — same underlying logic.

## Naming brainstorm (for reference, decision already made)

App name is **Slate Writer** — settled, don't revisit. (For color: this came out of a ~50-option brainstorm across paper/craft terms, film/production terms, structure terms, and short brandable names — "Slate" was one of the film-production-term options and "Writer" got appended. Just context, not something to act on.)
