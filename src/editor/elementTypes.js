// Canonical screenplay element types. This is the single list every other
// piece of the editor (schema, CSS, Tab-cycle order, slash menu, smart Enter)
// derives from, so a new element type only needs to be added here.
//
// `css` matches the class names already used by the read-only Screenplay
// view (src/styles/index.css) so editing and reading look identical.
export const ELEMENT_TYPES = [
  {
    name: 'scene_heading',
    label: 'Scene Heading',
    hint: 'INT./EXT. LOCATION — TIME',
    css: 'sp-scene',
  },
  {
    name: 'action',
    label: 'Action',
    hint: 'Describe what we see and hear.',
    css: 'sp-action',
  },
  {
    name: 'character',
    label: 'Character',
    hint: 'Who is speaking',
    css: 'sp-char',
  },
  {
    name: 'dialogue',
    label: 'Dialogue',
    hint: 'What they say',
    css: 'sp-dial',
  },
  {
    name: 'parenthetical',
    label: 'Parenthetical',
    hint: '(wryly)',
    css: 'sp-paren',
  },
  {
    name: 'transition',
    label: 'Transition',
    hint: 'CUT TO:',
    css: 'sp-trans',
  },
];

export const ELEMENT_TYPE_BY_NAME = Object.fromEntries(ELEMENT_TYPES.map((t) => [t.name, t]));

export const ELEMENT_CYCLE_ORDER = ELEMENT_TYPES.map((t) => t.name);

export function nextElementType(name, direction = 1) {
  const order = ELEMENT_CYCLE_ORDER;
  const idx = order.indexOf(name);
  const nextIdx = (idx + direction + order.length) % order.length;
  return order[nextIdx];
}

// What Enter should switch to next, based on the block you're leaving —
// mirrors the back-and-forth rhythm of a real script (character sets up
// dialogue, dialogue sets up the next character, a transition sets up the
// next scene). Anything not listed here continues as the same type.
export const ENTER_CONTINUATION = {
  scene_heading: 'action',
  character: 'dialogue',
  dialogue: 'character',
  parenthetical: 'dialogue',
  transition: 'scene_heading',
};
