import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema } from '../src/editor/schema.js';
import { editorKeymap } from '../src/editor/keymap.js';
import { autoCapsPlugin } from '../src/editor/autoCapsPlugin.js';
import { autoParentheticalPlugin } from '../src/editor/autoParentheticalPlugin.js';

function setup(blocks, { names = ['JOHN', 'JANE', 'MARA'], enabled = true } = {}) {
  const doc = schema.node('doc', null, blocks.map(([type, text], i) =>
    schema.node(type, { id: `b${i}` }, text ? schema.text(text) : null)));
  const plugins = [editorKeymap(() => names), autoCapsPlugin(), autoParentheticalPlugin({ current: enabled })];
  const view = {
    state: EditorState.create({ doc, selection: TextSelection.atEnd(doc), plugins }),
    dispatch(tr) { view.state = view.state.apply(tr); },
  };
  return {
    view,
    key(key, shiftKey = false) {
      return plugins[0].props.handleKeyDown(view, { key, shiftKey, keyCode: key === 'Tab' ? 9 : 13 });
    },
    type(text) {
      const { from, to } = view.state.selection;
      for (const plugin of plugins) {
        if (plugin.props.handleTextInput?.(view, from, to, text)) return;
      }
      view.dispatch(view.state.tr.insertText(text, from, to));
    },
    get block() { return view.state.selection.$from.parent; },
  };
}

test('Tab and Shift-Tab traverse recent names in opposite directions with wraparound', () => {
  const h = setup([['character', '']]);
  for (const [reverse, expected] of [[false,'JANE'],[false,'MARA'],[true,'JANE'],[true,'JOHN'],[true,'MARA'],[false,'JOHN']]) {
    assert.equal(h.key('Tab', reverse), true);
    assert.equal(h.block.type.name, 'character');
    assert.equal(h.block.textContent, expected);
    assert.equal(h.block.attrs.id, 'b0');
    assert.equal(h.view.state.selection.$from.parentOffset, expected.length);
  }
});

test('Shift-Tab on an empty cue starts at the most recent name', () => {
  const h = setup([['character', '']]);
  h.key('Tab', true);
  assert.equal(h.block.textContent, 'JOHN');
  h.key('Tab', true);
  assert.equal(h.block.textContent, 'MARA');
});

test('a single available name stays a Character in either direction', () => {
  const h = setup([['character', '']], { names: ['JOHN'] });
  h.key('Tab'); h.key('Tab', true);
  assert.equal(h.block.type.name, 'character');
  assert.equal(h.block.textContent, 'JOHN');
});

test('Shift-Tab retains type cycling for a new name or an empty recent list', () => {
  for (const [text, names] of [['NEW NAME',['JOHN']],['',[]]]) {
    const h = setup([['character', text]], { names });
    h.key('Tab', true);
    assert.equal(h.block.type.name, 'action');
    assert.equal(h.block.textContent, text);
  }
});

test('Shift-Tab outside a Character block still cycles the element type backward', () => {
  const h = setup([['dialogue', 'Hello.']]);
  h.key('Tab', true);
  assert.equal(h.block.type.name, 'character');
  assert.equal(h.block.textContent, 'HELLO.');
});

test('Enter then an opening parenthesis after dialogue creates a trailing parenthetical', () => {
  const h = setup([['character','JOHN'],['dialogue','I gotta listen.']]);
  h.key('Enter');
  assert.equal(h.block.type.name, 'character');
  const id = h.block.attrs.id;
  h.type('(');
  h.type('he takes his blood pressure)');
  assert.equal(h.block.type.name, 'parenthetical');
  assert.equal(h.block.textContent, '(he takes his blood pressure)');
  assert.equal(h.block.attrs.id, id);
  assert.equal(h.view.state.doc.child(1).textContent, 'I gotta listen.');
  h.key('Enter');
  assert.equal(h.block.type.name, 'dialogue');
  assert.equal(h.block.textContent, '');
});

test('leading parentheticals and the existing Action shortcut still work', () => {
  for (const type of ['dialogue','action']) {
    const h = setup([[type,'']]);
    h.type('('); h.type('quietly)');
    assert.equal(h.block.type.name, 'parenthetical');
    assert.equal(h.block.textContent, '(quietly)');
  }
});

test('the trailing shortcut respects the automatic-parentheticals setting', () => {
  const h = setup([['dialogue','Hello.']], { enabled: false });
  h.key('Enter'); h.type('('); h.type('quietly)');
  assert.equal(h.block.type.name, 'character');
  assert.equal(h.block.textContent, '(QUIETLY)');
});

test('parentheses in an existing character name do not retype the block', () => {
  const h = setup([['dialogue','Hello.'],['character','JOHN ']]);
  h.type('('); h.type('v.o.)');
  assert.equal(h.block.type.name, 'character');
  assert.equal(h.block.textContent, 'JOHN (V.O.)');
});

test('an empty Character unrelated to dialogue is not converted', () => {
  const h = setup([['action','He enters.'],['character','']]);
  h.type('(');
  assert.equal(h.block.type.name, 'character');
});
