import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema } from '../src/editor/schema.js';
import { touchCaretPlugin } from '../src/editor/touchCaretPlugin.js';

// Exercise gesture and selection-event ordering with real PM transactions.
// Native hit testing and rendering need the iOS integration check described
// in CARET_INVESTIGATION.md; a synthetic DOM cannot reproduce that bug.
function setup(t) {
  const plugin = touchCaretPlugin();
  const document = new EventTarget();
  const textNode = {};
  document.createRange = () => ({
    selectNodeContents() {},
    getClientRects: () => [{ left: 90, right: 150, top: 90, bottom: 110 }],
  });
  const doc = schema.node('doc', null, [
    schema.node('action', null, schema.text('First line.')),
    schema.node('dialogue', null, schema.text('Second line.')),
  ]);
  let live = { anchorNode: textNode, focusNode: textNode, anchorOffset: 1, focusOffset: 1 };
  const nativeSelection = {
    get focusNode() { return live.focusNode; },
    get focusOffset() { return live.focusOffset; },
    get isCollapsed() { return live.anchorNode === live.focusNode && live.anchorOffset === live.focusOffset; },
    collapse(node, offset) {
      live = { anchorNode: node, focusNode: node, anchorOffset: offset, focusOffset: offset };
    },
  };
  document.getSelection = () => nativeSelection;
  let focusWrites = 0;
  const view = {
    state: EditorState.create({ doc }),
    dom: { ownerDocument: document, contains: node => node === textNode },
    composing: false,
    hasFocus: () => true,
    nodeDOM: pos => ({
      getBoundingClientRect: () => ({ top: pos === 0 ? 20 : 80, bottom: pos === 0 ? 40 : 120 }),
    }),
    posAtCoords: () => ({ pos: 25 }),
    coordsAtPos: () => ({ top: 100, bottom: 115, left: 100, right: 100 }),
    posAtDOM: (_, offset) => offset,
    domAtPos: pos => ({ node: textNode, offset: pos }),
    domSelectionRange: () => live,
    focus() {
      focusWrites++;
      live = { anchorNode: textNode, focusNode: textNode,
        anchorOffset: this.state.selection.anchor, focusOffset: this.state.selection.head };
    },
    dispatch(tr) {
      this.state = this.state.apply(tr);
      hooks.update();
    },
  };
  const hooks = plugin.spec.view(view);
  t.after(() => hooks.destroy());
  const touch = (x = 100, y = 100) => ({ identifier: 0, clientX: x, clientY: y });
  function send(type, { x = 100, y = 100, touches, changedTouches } = {}) {
    const point = touch(x, y);
    const event = {
      touches: touches ?? (type === 'touchend' ? [] : [point]),
      changedTouches: changedTouches ?? [point], cancelable: true,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
    };
    plugin.props.handleDOMEvents[type](view, event);
    return event;
  }
  return {
    view, document, hooks, send, nativeSelectionAPI: nativeSelection,
    tap() { send('touchstart'); return send('touchend'); },
    nativeSelection(anchor, head = anchor) {
      live = { anchorNode: textNode, focusNode: textNode, anchorOffset: anchor, focusOffset: head };
      document.dispatchEvent(new Event('selectionchange'));
    },
    get live() { return live; },
    get focusWrites() { return focusWrites; },
  };
}

test('a tap places the caret synchronously and repairs a late native overwrite before PM observes it', t => {
  const h = setup(t);
  assert.equal(h.tap().defaultPrevented, true);
  assert.equal(h.view.state.selection.head, 25);
  assert.equal(h.live.focusOffset, 25);
  // The plugin installs capture before PM's selectionchange observer.
  h.document.addEventListener('selectionchange', () => assert.equal(h.live.focusOffset, 25));
  h.nativeSelection(1);
  assert.equal(h.view.state.selection.head, 25);
  assert.equal(h.live.focusOffset, 25);
});

test('an already-correct model still synchronizes a stale native caret', t => {
  const h = setup(t);
  h.view.dispatch(h.view.state.tr.setSelection(TextSelection.create(h.view.state.doc, 25)));
  h.tap();
  assert.equal(h.live.focusOffset, 25);
});

test('touch release after a horizontal or vertical drag leaves native behavior alone', t => {
  for (const point of [{ x: 120 }, { y: 120 }]) {
    const h = setup(t);
    h.send('touchstart');
    h.send('touchmove', point);
    assert.equal(h.send('touchend', point).defaultPrevented, false);
    assert.equal(h.focusWrites, 0);
  }
});

test('long press, cancelled touch, and multitouch do not place a caret', t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const h = setup(t);
  h.send('touchstart'); now += 600;
  assert.equal(h.send('touchend').defaultPrevented, false);
  h.send('touchstart'); h.send('touchcancel'); h.send('touchend');
  h.send('touchstart', { touches: [{ identifier: 0 }, { identifier: 1 }] }); h.send('touchend');
  assert.equal(h.focusWrites, 0);
});

test('a second nearby tap can invoke native word selection', t => {
  const h = setup(t);
  h.tap();
  assert.equal(h.tap().defaultPrevented, false);
  h.nativeSelection(14, 20);
  assert.equal(h.live.focusOffset, 20);
  assert.equal(h.live.anchorOffset, 14);
});

test('rapid taps on adjacent blocks remain independent caret moves', t => {
  const h = setup(t);
  h.tap();
  h.view.posAtCoords = () => ({ pos: 12 });
  h.send('touchstart', { y: 30 });
  assert.equal(h.send('touchend', { y: 30 }).defaultPrevented, true);
  assert.equal(h.view.state.selection.head, 12);
});

test('a new gesture releases the old tap target immediately', t => {
  const h = setup(t);
  h.tap();
  h.send('touchstart', { y: 150 });
  h.nativeSelection(14);
  assert.equal(h.live.focusOffset, 14);
});

for (const event of ['keydown', 'beforeinput', 'compositionstart', 'pointerdown', 'wheel', 'blur']) {
  test(`${event} releases the tap target before the next input`, t => {
    const h = setup(t);
    h.tap();
    h.document.dispatchEvent(new Event(event));
    h.nativeSelection(24);
    assert.equal(h.live.focusOffset, 24);
  });
}

test('a native range selection is preserved', t => {
  const h = setup(t);
  h.tap();
  h.nativeSelection(14, 20);
  assert.equal(h.live.anchorOffset, 14);
  assert.equal(h.live.focusOffset, 20);
});

test('document edits and programmatic navigation release the tap target', t => {
  for (const edit of [true, false]) {
    const h = setup(t);
    h.tap();
    h.view.dispatch(edit ? h.view.state.tr.insertText('x') :
      h.view.state.tr.setSelection(TextSelection.create(h.view.state.doc, 14)));
    h.nativeSelection(15);
    assert.equal(h.live.focusOffset, 15);
  }
});

test('settling expires in wall-clock time without extending on late events', t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const h = setup(t);
  h.tap(); now += 1000;
  h.nativeSelection(14);
  assert.equal(h.live.focusOffset, 14);
});

test('destroy removes selection repair listeners', t => {
  const h = setup(t);
  h.tap(); h.hooks.destroy(); h.nativeSelection(14);
  assert.equal(h.live.focusOffset, 14);
});

// Captured on the physical iPad: an x beyond the dialogue's right edge
// returned the next block boundary (inside: -1), and near() picked its start.
test('a margin tap is hit-tested inside the rendered line, never at the next block boundary', t => {
  const h = setup(t);
  const points = [];
  h.view.posAtCoords = point => {
    points.push(point);
    return point.left > 150 ? { pos: 26, inside: -1 } : { pos: 25, inside: 13 };
  };
  h.send('touchstart', { x: 300, y: 115 });
  assert.equal(h.send('touchend', { x: 300, y: 115 }).defaultPrevented, true);
  assert.equal(h.view.state.selection.head, 25);
  assert.deepEqual(points, [{ left: 149.5, top: 100 }]);
});

test('an out-of-block hit is not converted into a selection in its neighbor', t => {
  const h = setup(t);
  h.view.posAtCoords = () => ({ pos: 13, inside: -1 });
  assert.equal(h.tap().defaultPrevented, false);
  assert.equal(h.focusWrites, 0);
});


test('a wrapped margin tap restores line-end affinity without changing the insertion offset', t => {
  const h = setup(t);
  const moves = [];
  h.nativeSelectionAPI.modify = function (...args) {
    moves.push({ args, seed: this.focusOffset });
    this.collapse(this.focusNode, 25);
  };
  h.send('touchstart', { x: 300 });
  h.send('touchend', { x: 300 });
  assert.deepEqual(moves, [{ args: ['move', 'forward', 'lineboundary'], seed: 24 }]);
  assert.equal(h.view.state.selection.head, 25);
  assert.equal(h.live.focusOffset, 25);
  h.nativeSelection(14);
  assert.equal(moves.length, 2);
  assert.equal(h.live.focusOffset, 25);
  // Affinity restoration's own selectionchange must not start a repair loop.
  h.document.dispatchEvent(new Event('selectionchange'));
  assert.equal(moves.length, 2);
});

test('native line navigation may not change the calculated insertion offset', t => {
  const h = setup(t);
  h.nativeSelectionAPI.modify = function () { this.collapse(this.focusNode, 14); };
  h.send('touchstart', { x: 300 });
  h.send('touchend', { x: 300 });
  assert.equal(h.view.state.selection.head, 25);
  assert.equal(h.live.focusOffset, 25);
});
