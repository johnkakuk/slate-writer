import assert from 'node:assert/strict';

// Run against the storage-free Vite fixture. Pass a Playwright module path if
// it is installed outside this repo: node tests/caretGeometry.browser.mjs PATH
// These synthetic touches test geometry; native iOS event ordering is separate.
const { chromium, webkit } = await import(process.argv[2] || 'playwright');
const origin = process.env.CARET_FIXTURE_ORIGIN || 'http://127.0.0.1:5187';

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1194, height: 1100 } });
    await page.goto(`${origin}/tests/caret-fixture.html`);
    await page.waitForFunction(() => window.caretFixture);
    const result = await page.evaluate(async () => {
      const { view } = window.caretFixture;
      const { activeLineKey } = await import('/src/editor/activeLinePlugin.js');
      const plugin = view.state.plugins.find(p => p.props.handleDOMEvents?.touchend);
      // Keep independent test taps outside the double-tap interval.
      let now = Date.now();
      Date.now = () => now;
      const failures = [];
      let count = 0;
      for (const style of ['none', 'line', 'paragraph', 'underline']) {
        view.dispatch(view.state.tr.setMeta(activeLineKey, { enabled: style !== 'none', style }));
        for (const el of view.dom.children) {
          const root = view.dom.getBoundingClientRect(), node = el.firstChild, lines = [];
          if (node.nodeType !== 3) continue;
          // Derive expected endpoints from individual characters, independently
          // of the production code's whole-line rectangle and native hit test.
          for (let i = 0; i < node.length; i++) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            for (const rect of range.getClientRects()) {
              if (rect.width <= 0 || rect.height <= 0) continue;
              let line = lines.find(l => Math.abs(l.top - rect.top) < 1);
              if (!line) {
                line = { top: rect.top, bottom: rect.bottom, start: i, end: i + 1 };
                lines.push(line);
              }
              line.end = i + 1;
            }
          }
          for (const line of lines) {
            const edges = [
              ['left', root.left + 2, line.start],
              ['right', root.right - 2, line.end],
            ];
            for (const [side, x, offset] of edges) {
              for (const y of [(line.top + line.bottom) / 2, line.bottom + 1]) {
                const expected = view.posAtDOM(node, offset);
                now += 1000;
                const touch = { identifier: 1, clientX: x, clientY: y };
                const event = {
                  touches: [touch], changedTouches: [touch], cancelable: true,
                  defaultPrevented: false,
                  preventDefault() { this.defaultPrevented = true; },
                };
                plugin.props.handleDOMEvents.touchstart(view, event);
                now += 80;
                event.touches = [];
                plugin.props.handleDOMEvents.touchend(view, event);
                count++;
                if (view.state.selection.head !== expected) {
                  failures.push({ id: el.dataset.id, side, y, expected, actual: view.state.selection.head });
                }
              }
            }
          }
        }
      }
      return { count, failures };
    });
    console.log(engine.name(), JSON.stringify(result));
    assert.equal(result.failures.length, 0);
  } finally {
    await browser.close();
  }
}
