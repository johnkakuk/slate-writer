import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { history, undo } from 'prosemirror-history';
import { schema } from '../src/editor/schema.js';
import { autoCapsPlugin } from '../src/editor/autoCapsPlugin.js';
import { editorKeymap } from '../src/editor/keymap.js';
import { findMatches, searchPlugin, searchKey, replaceMatches, navigateMatch } from '../src/editor/searchPlugin.js';

function setup(blocks) {
  const doc = schema.node('doc', null, blocks.map(([type, text], i) => schema.node(type, { id: String(i) }, text ? schema.text(text) : null)));
  const view = { state: EditorState.create({ doc, plugins: [editorKeymap(), history(), autoCapsPlugin(), searchPlugin()] }), dispatch(tr) { view.state = view.state.apply(tr); }, endOfTextblock() { return view.state.selection.$from.parentOffset === 0; } };
  return view;
}
const query = (view, text, caseSensitive = false) => view.dispatch(view.state.tr.setMeta(searchKey, { query: text, caseSensitive }));

test('literal search handles punctuation, case, and document offsets without spanning blocks', () => {
  const view = setup([['action', 'A.b a.b'], ['dialogue', 'A.b']]);
  assert.deepEqual(findMatches(view.state.doc, 'a.b'), [{ from: 1, to: 4 }, { from: 5, to: 8 }, { from: 10, to: 13 }]);
  assert.equal(findMatches(view.state.doc, 'a.b', true).length, 1);
  assert.equal(findMatches(view.state.doc, 'bA').length, 0);
});
test('navigation wraps and sequential replacement advances to the next original match', () => {
  const view = setup([['action', 'cat cat cat']]);
  query(view, 'cat'); navigateMatch(view, -1);
  assert.equal(searchKey.getState(view.state).active, 2);
  navigateMatch(view, 1);
  replaceMatches(view, 'catapult');
  assert.equal(view.state.doc.textContent, 'catapult cat cat');
  assert.equal(searchKey.getState(view.state).active, 1);
});
test('replace all is one undo event, supports deletion, and keeps block identities/types', () => {
  const view = setup([['action', 'cat cat'], ['dialogue', 'cat']]);
  const original = view.state.doc.toJSON();
  query(view, 'cat'); replaceMatches(view, '', true);
  assert.equal(view.state.doc.textContent, ' ');
  assert.equal(view.state.doc.child(1).type.name, 'dialogue');
  assert.equal(view.state.doc.child(1).attrs.id, '1');
  undo(view.state, tr => view.dispatch(tr));
  assert.deepEqual(view.state.doc.toJSON(), original);
  assert.equal(searchKey.getState(view.state).matches.length, 3);
});
test('pasted lowercase text is stored uppercase and caret stays at insertion, including expanding Unicode', () => {
  const view = setup([['character', 'JANE']]);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
  view.dispatch(view.state.tr.insertText('ß'));
  assert.equal(view.state.doc.textContent, 'JASSNE');
  assert.equal(view.state.selection.from, 5);
  undo(view.state, tr => view.dispatch(tr));
  assert.equal(view.state.doc.textContent, 'JANE');
});
test('replacement normalizes character headings while leaving dialogue casing alone', () => {
  const view = setup([['character', 'JANE'], ['dialogue', 'JANE']]);
  query(view, 'JANE'); replaceMatches(view, 'mara', true);
  assert.equal(view.state.doc.child(0).textContent, 'MARA');
  assert.equal(view.state.doc.child(1).textContent, 'mara');
});
test('blank Character Backspace first becomes Action, then joins the preceding block', () => {
  const view = setup([['action', 'Hello'], ['character', '']]);
  view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
  const key = () => view.state.plugins[0].props.handleKeyDown(view, { key: 'Backspace', keyCode: 8 });
  assert.equal(key(), true);
  assert.equal(view.state.doc.childCount, 2);
  assert.equal(view.state.selection.$from.parent.type.name, 'action');
  assert.equal(view.state.selection.$from.parent.attrs.id, '1');
  assert.equal(key(), true);
  assert.equal(view.state.doc.childCount, 1);
  assert.equal(view.state.selection.$from.parentOffset, 5);
});
test('software-keyboard deletion also converts blank Character without removing it', () => {
  const view = setup([['character', '']]);
  let prevented = false;
  assert.equal(view.state.plugins[0].props.handleDOMEvents.beforeinput(view, { inputType: 'deleteContentBackward', preventDefault() { prevented = true; } }), true);
  assert.equal(prevented, true);
  assert.equal(view.state.doc.childCount, 1);
  assert.equal(view.state.doc.firstChild.type.name, 'action');
});
