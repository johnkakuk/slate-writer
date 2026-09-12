import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from '../src/editor/schema.js';
import { activeLinePlugin, activeLineKey } from '../src/editor/activeLinePlugin.js';
import { touchCaretPlugin } from '../src/editor/touchCaretPlugin.js';
import 'prosemirror-view/style/prosemirror.css';
import '../src/styles/index.css';

// A disposable editor with no React state, persistence, or scroll corrections.
// ?native=1 disables our touch handler. ?style=none disables the highlight.
const params = new URLSearchParams(location.search);
const blocks = [
  ['scene_heading', 'INT. KITCHEN - DAY'],
  ['action', 'The room is quiet.'],
  ['character', 'JANE'],
  ['dialogue', 'Are you coming?'],
  ['action', 'She waits by the door.'],
  ['character', 'JOHN'],
  ['dialogue', 'Just a moment.'],
  ['parenthetical', '(quietly)'],
  ['transition', 'CUT TO:'],
  ['action', 'A long line of action that wraps across several visual lines so that we can check the end of a wrapped line as well as the end of a paragraph.'],
  ['action', ''],
  ['dialogue', 'What, uh — that friend, the one who tells stories about the old house. What was her name?'],
  ['character', 'JANE'],
  ['dialogue', 'Kelly.'],
];
const doc = schema.node('doc', null, blocks.map(([type, text], i) =>
  schema.node(type, { id: `b${i}` }, text ? schema.text(text) : null)));
const trace = [];
const view = new EditorView(document.querySelector('.editor-page'), {
  state: EditorState.create({
    doc,
    plugins: [activeLinePlugin(), ...(params.has('native') ? [] : [touchCaretPlugin()])],
  }),
  dispatchTransaction(tr) {
    view.updateState(view.state.apply(tr));
    trace.push({ event: 'transaction', time: performance.now(), selection: view.state.selection.toJSON(),
      pointer: tr.getMeta('pointer') === true });
  },
});
const style = params.get('style') || 'line';
view.dispatch(view.state.tr.setMeta(activeLineKey, { enabled: style !== 'none', style }));

function snapshot() {
  const live = view.domSelectionRange();
  let anchor = null, head = null;
  if (live.focusNode && view.dom.contains(live.focusNode)) {
    anchor = view.posAtDOM(live.anchorNode, live.anchorOffset);
    head = view.posAtDOM(live.focusNode, live.focusOffset);
  }
  return { anchor, head, model: view.state.selection.toJSON(),
    scroll: document.querySelector('.editor-scroll').scrollTop,
    viewportTop: visualViewport?.offsetTop };
}
let tap = 0;
for (const event of ['touchstart', 'touchend', 'selectionchange']) {
  document.addEventListener(event, e => {
    trace.push({ event, time: performance.now(), ...snapshot(),
      x: e.changedTouches?.[0]?.clientX, y: e.changedTouches?.[0]?.clientY });
    if (event !== 'touchend') return;
    const id = ++tap;
    let frames = 0;
    function frame() {
      trace.push({ event: 'frame', tap: id, time: performance.now(), ...snapshot() });
      if (++frames < 24) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, true);
}
window.caretFixture = { view, trace, snapshot };
