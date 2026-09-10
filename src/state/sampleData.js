// Seed data. `createSampleProject()` is the one real project in this
// scaffold ("Long Way Down"); `createEmptyProject()` is what every other
// project (the rest of the switcher list, or anything created via "+ New
// Project") gets provisioned from — a standard 3-act board and no docs yet.
//
// The screenplay document (`screenplayDoc`, a ProseMirror-shaped JSON tree —
// see src/editor/schema.js) is the single source of real scene content. Each
// beat card only holds editorial summary (title/description) plus a
// `sceneId`, which is the `id` attr on that scene's scene_heading node in
// the document — the anchor the Outline, Screenplay view, and Editor all
// use to point at the same spot.
import { generateId } from '../utils/id.js';
import { emptyDoc } from '../editor/docJson.js';

function docNode(type, id, text) {
  return { type, attrs: { id }, content: text ? [{ type: 'text', text }] : undefined };
}

function docFile(content) {
  return { id: generateId('doc'), content };
}

// `elements[0]` is always the scene heading; it gets `sceneId` as its id so
// the beat card can reference it directly. Every other line gets its own
// freshly generated id. `seedKey` only seeds the sceneId string for
// readability while debugging — display numbering (SC. 01, etc.) is never
// stored on the card, it's derived live from card order (see OutlineBoard).
function buildScene({ seedKey, title, description, elements }) {
  const sceneId = `scene-${seedKey}`;
  const docNodes = elements.map((el, idx) =>
    docNode(el.type, idx === 0 ? sceneId : generateId('block'), el.text)
  );
  const card = {
    id: generateId('card'),
    title,
    description,
    isFlagged: false,
    sceneId,
  };
  return { card, docNodes };
}

export function createSampleProject() {
  const docContent = [];

  const scene1 = buildScene({
    seedKey: 1,
    title: 'Eli Finds the Letter',
    description: 'Looking for batteries in the junk drawer, he finds something else entirely.',
    elements: [
      { type: 'scene_heading', text: "INT. ELI'S APARTMENT — NIGHT" },
      {
        type: 'action',
        text: "Eli digs through a junk drawer. Batteries, dead pens, a broken watch. His hand stops on something else — an envelope, unopened, addressed in handwriting he knows too well.",
      },
    ],
  });

  const scene2 = buildScene({
    seedKey: 2,
    title: 'He Calls Mara',
    description: "She doesn't pick up. He leaves a voicemail he immediately regrets.",
    elements: [
      { type: 'scene_heading', text: "INT. ELI'S APARTMENT — CONTINUOUS" },
      { type: 'action', text: 'He dials. It rings out. The beep comes too fast.' },
      { type: 'character', text: 'ELI' },
      { type: 'dialogue', text: "Hey, it's — obviously it's me. Call me back. Please." },
    ],
  });

  const scene3 = buildScene({
    seedKey: 3,
    title: 'Setting the Meeting',
    description: 'She agrees to talk — but only at the diner, and only for twenty minutes.',
    elements: [
      { type: 'scene_heading', text: 'INT. DINER — NIGHT — ESTABLISHING' },
      { type: 'action', text: 'A phone call, unseen. The agreement is made.' },
    ],
  });

  const scene4 = buildScene({
    seedKey: 4,
    title: 'Diner Confrontation',
    description: 'Rain outside, coffee going cold. He finally shows her the letter.',
    elements: [
      { type: 'scene_heading', text: 'INT. DINER — NIGHT' },
      {
        type: 'action',
        text: 'Rain streaks the window. MARA (30s, exhausted) turns a coffee cup in slow circles. Across from her, ELI watches, waiting.',
      },
      { type: 'character', text: 'ELI' },
      { type: 'dialogue', text: "You're not going to say anything?" },
      { type: 'character', text: 'MARA' },
      { type: 'parenthetical', text: '(quietly)' },
      { type: 'dialogue', text: "What's left to say." },
      { type: 'transition', text: 'CUT TO:' },
    ],
  });

  const scene5 = buildScene({
    seedKey: 5,
    title: 'Parking Lot Standoff',
    description: "She won't get in the car. He won't leave without her.",
    elements: [
      { type: 'scene_heading', text: 'EXT. DINER PARKING LOT — CONTINUOUS' },
      {
        type: 'action',
        text: "Rain picks up. Mara stands by the passenger door, arms crossed. Eli waits at the driver's side, keys in hand.",
      },
      { type: 'character', text: 'MARA' },
      { type: 'dialogue', text: "I'm not getting in that car until you tell me the truth." },
    ],
  });

  const scene6 = buildScene({
    seedKey: 6,
    title: 'Highway Confession',
    description: 'Twelve silent miles, then everything comes out at once.',
    elements: [
      { type: 'scene_heading', text: 'INT. CAR — HIGHWAY — NIGHT' },
      {
        type: 'action',
        text: 'Twelve miles of silence. Headlights sweep the dashboard. Finally, Eli speaks without looking over.',
      },
      { type: 'character', text: 'ELI' },
      { type: 'dialogue', text: "It wasn't supposed to happen like this." },
    ],
  });

  for (const scene of [scene1, scene2, scene3, scene4, scene5, scene6]) {
    docContent.push(...scene.docNodes);
  }

  return {
    id: generateId('project'),
    name: 'Long Way Down',
    acts: [
      { id: generateId('act'), title: 'ACT I', cards: [scene1.card, scene2.card] },
      { id: generateId('act'), title: 'ACT II', cards: [scene3.card, scene4.card, scene5.card] },
      { id: generateId('act'), title: 'ACT III', cards: [scene6.card] },
    ],
    screenplayDoc: { type: 'doc', content: docContent },
    characterBible: [
      docFile(`# Mara

## Physical Description
30s. Exhausted in the specific way that comes from bracing for a conversation for weeks, not days.

## Voice & Speech Patterns
Clipped. Says less than she means, on purpose. Doesn't fill silence — makes Eli fill it instead.

## Backstory
Together with Eli long enough that the ending should have been simple. It wasn't.

## Relationships
Eli — the letter is the whole relationship, condensed. She's not at the diner to reconcile; she's there to find out if he'll finally say it.

## Arc Notes
Diner → parking lot → the car: each beat is her deciding, again, whether to stay in the scene.
`),
      docFile(`# Eli

## Physical Description
(TODO)

## Voice & Speech Patterns
Talks around things until he can't anymore. The voicemail in Scene 2 is the whole character in miniature.

## Backstory
Found the letter by accident, digging for batteries — the inciting incident is deliberately mundane.

## Relationships
Mara — see her file. He's driving, literally and otherwise, for most of the back half.

## Arc Notes
By the highway scene he's out of ways to avoid the conversation. That's the point of the drive.
`),
    ],
    notesResearch: [
      docFile(`# Character voice

Keep Eli's dialogue indirect until the highway scene — that's where he finally says the thing plainly. Mara gets fewer lines than Eli throughout; let the silences do the work (see the parenthetical in Scene 4).
`),
      docFile(`# Timeline

- Scene 1–2: same night, Eli's apartment
- Scene 3: phone call, unspecified gap (hours? a day?) — decide before locking the diner scene
- Scene 4–6: continuous, one night, diner → parking lot → highway
`),
    ],
  };
}

// A brand-new project (from "+ New Project" or picking an unprovisioned name
// from the switcher) starts with the standard 3-act structure and nothing
// else — Character Bible and Notes & Research start empty; individual docs
// get their own starter template when added (see docTemplates.js).
export function createEmptyProject(name) {
  return {
    id: generateId('project'),
    name,
    acts: [
      { id: generateId('act'), title: 'ACT I', cards: [] },
      { id: generateId('act'), title: 'ACT II', cards: [] },
      { id: generateId('act'), title: 'ACT III', cards: [] },
    ],
    screenplayDoc: emptyDoc(),
    characterBible: [],
    notesResearch: [],
  };
}

// Seeds the project switcher on first run. Only "Long Way Down" (the first
// entry) gets real content — the rest are provisioned as empty template
// projects up front, so the switcher is backed by real, switchable projects
// instead of decorative names.
export const SEED_PROJECT_NAMES = [
  'Long Way Down',
  'Diner Scene — Short',
  'Highway Confession',
  'The Rewrite Room — Pilot',
  'Untitled Feature Draft',
  'Spec Script — Half Hour',
  'Adaptation — Working Title',
  'Table Read Notes',
  'Old Pilot Draft',
  'Archive — 2024 Draft',
];

export const TRASH_FILES = ['Draft 1 — Original', 'Draft 2 — Notes pass'];
