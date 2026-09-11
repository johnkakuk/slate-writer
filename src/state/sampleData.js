// Seed data. `createSampleProject()` is the one real project in this
// scaffold ("Long Way Down"); `createEmptyProject()` is what every other
// project (the rest of the switcher list, or anything created via "+ New
// Project") gets provisioned from — a standard 3-act board and no docs yet.
//
// Each beat card owns its scene outright: `card.sceneDoc` is a
// ProseMirror-shaped JSON tree (see src/editor/schema.js) holding just that
// scene's content. There's no shared whole-script document — the Screenplay
// view is a live concatenation of every card's sceneDoc in current outline
// order (see ScreenplayView.jsx), so it never needs a separate sync step
// when cards are added, edited, deleted, or reordered.
import { generateId } from '../utils/id.js';
import { characterTemplate, noteTemplate } from './docTemplates.js';

function docNode(type, id, text) {
  return { type, attrs: { id }, content: text ? [{ type: 'text', text }] : undefined };
}

function docFile(content) {
  return { id: generateId('doc'), content };
}

// Character Bible / Notes & Research aren't hardcoded folders anymore --
// they're just the two document types every project starts with, same
// shape as any custom type a user adds later (see DocTypeModal.jsx). Kept
// as a factory (not a constant) so every project gets its own type ids and
// doc arrays rather than sharing references.
export function defaultDocTypes() {
  return seedDocTypes([], []);
}

function seedDocTypes(characterDocs, noteDocs) {
  return [
    {
      id: generateId('doctype'),
      pluralLabel: 'Character Bible',
      singularLabel: 'Character',
      template: characterTemplate(),
      docs: characterDocs,
    },
    {
      id: generateId('doctype'),
      pluralLabel: 'Notes & Research',
      singularLabel: 'Note',
      template: noteTemplate(),
      docs: noteDocs,
    },
  ];
}

// A blank title page defaults its Title field to the project name so
// there's always something sane to export even before anyone visits the
// Title Page editor -- everything else starts empty, filled in by hand.
export function defaultTitlePage(name) {
  return { title: name, credit: 'Written by', author: '', basedOn: '', contact: '', draftInfo: '' };
}

// `elements[0]` is always the scene heading. `seedKey` only seeds that
// heading's id for readability while debugging — display numbering
// (SC. 01, etc.) is never stored on the card, it's derived live from card
// order (see OutlineBoard).
function buildScene({ seedKey, title, description, elements }) {
  const headingId = `scene-${seedKey}`;
  const sceneDoc = {
    type: 'doc',
    content: elements.map((el, idx) => docNode(el.type, idx === 0 ? headingId : generateId('block'), el.text)),
  };
  return {
    id: generateId('card'),
    title,
    description,
    isFlagged: false,
    sceneDoc,
  };
}

export function createSampleProject() {
  const card1 = buildScene({
    seedKey: 1,
    title: 'Eli Finds the Letter',
    description: 'Looking for batteries in the junk drawer, he finds something else entirely.',
    elements: [
      { type: 'scene_heading', text: 'INT. BEAT ONE — APARTMENT' },
      { type: 'action', text: 'Placeholder content for Beat 1: Eli Finds the Letter.' },
    ],
  });

  const card2 = buildScene({
    seedKey: 2,
    title: 'He Calls Mara',
    description: "She doesn't pick up. He leaves a voicemail he immediately regrets.",
    elements: [
      { type: 'scene_heading', text: 'INT. BEAT TWO — APARTMENT' },
      { type: 'character', text: 'ELI' },
      { type: 'dialogue', text: 'This is beat two — He Calls Mara.' },
    ],
  });

  const card3 = buildScene({
    seedKey: 3,
    title: 'Setting the Meeting',
    description: 'She agrees to talk — but only at the diner, and only for twenty minutes.',
    elements: [
      { type: 'scene_heading', text: 'INT. BEAT THREE — DINER' },
      { type: 'action', text: 'Placeholder content for Beat 3: Setting the Meeting.' },
    ],
  });

  const card4 = buildScene({
    seedKey: 4,
    title: 'Diner Confrontation',
    description: 'Rain outside, coffee going cold. He finally shows her the letter.',
    elements: [
      { type: 'scene_heading', text: 'INT. BEAT FOUR — DINER' },
      { type: 'character', text: 'MARA' },
      { type: 'dialogue', text: 'This is beat four — Diner Confrontation.' },
    ],
  });

  const card5 = buildScene({
    seedKey: 5,
    title: 'Parking Lot Standoff',
    description: "She won't get in the car. He won't leave without her.",
    elements: [
      { type: 'scene_heading', text: 'EXT. BEAT FIVE — PARKING LOT' },
      { type: 'action', text: 'Placeholder content for Beat 5: Parking Lot Standoff.' },
    ],
  });

  const card6 = buildScene({
    seedKey: 6,
    title: 'Highway Confession',
    description: 'Twelve silent miles, then everything comes out at once.',
    elements: [
      { type: 'scene_heading', text: 'INT. BEAT SIX — CAR' },
      { type: 'character', text: 'ELI' },
      { type: 'dialogue', text: 'This is beat six — Highway Confession.' },
    ],
  });

  return {
    id: generateId('project'),
    name: 'Long Way Down',
    titlePage: defaultTitlePage('Long Way Down'),
    acts: [
      { id: generateId('act'), title: 'ACT I', cards: [card1, card2] },
      { id: generateId('act'), title: 'ACT II', cards: [card3, card4, card5] },
      { id: generateId('act'), title: 'ACT III', cards: [card6] },
    ],
    docTypes: seedDocTypes(
      [
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
      [
        docFile(`# Character voice

Keep Eli's dialogue indirect until the highway scene — that's where he finally says the thing plainly. Mara gets fewer lines than Eli throughout; let the silences do the work (see the parenthetical in Scene 4).
`),
        docFile(`# Timeline

- Scene 1–2: same night, Eli's apartment
- Scene 3: phone call, unspecified gap (hours? a day?) — decide before locking the diner scene
- Scene 4–6: continuous, one night, diner → parking lot → highway
`),
      ]
    ),
  };
}

// A brand-new project (from "+ New Project" or picking an unprovisioned name
// from the switcher) starts with the standard 3-act structure and the two
// default document types (Character Bible, Notes & Research), both empty --
// same starting point as every project, and just as deletable/renamable as
// any custom type added later.
export function createEmptyProject(name) {
  return {
    id: generateId('project'),
    name,
    titlePage: defaultTitlePage(name),
    acts: [
      { id: generateId('act'), title: 'ACT I', cards: [] },
      { id: generateId('act'), title: 'ACT II', cards: [] },
      { id: generateId('act'), title: 'ACT III', cards: [] },
    ],
    docTypes: defaultDocTypes(),
  };
}

