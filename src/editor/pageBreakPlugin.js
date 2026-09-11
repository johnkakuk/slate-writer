import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const pageBreakKey = new PluginKey('pageBreaks');

// Pagination is computed externally (see src/export/paginate.js, run over
// the whole project) and pushed in via `tr.setMeta(pageBreakKey, blocks)`
// from Editor.jsx -- this plugin just renders whatever it's given as a
// widget decoration before each block that starts a new exported-PDF page.
// `blocks` is an array of `{ id, page }` scoped to blocks in *this* scene.
export function pageBreakPlugin() {
  return new Plugin({
    key: pageBreakKey,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(pageBreakKey);
        return meta !== undefined ? meta : value;
      },
    },
    props: {
      decorations(state) {
        const blocks = pageBreakKey.getState(state);
        if (!blocks || !blocks.length) return null;
        const pageById = new Map(blocks.map((b) => [b.id, b.page]));
        const decos = [];
        state.doc.forEach((node, offset) => {
          const page = pageById.get(node.attrs?.id);
          if (page == null) return;
          decos.push(
            Decoration.widget(
              offset,
              () => {
                const el = document.createElement('div');
                el.className = 'page-break-marker';
                el.textContent = `Page ${page}`;
                // Not part of the document -- keep the browser from treating
                // it as editable text (which would let the caret land inside
                // it or let it get selected/deleted like real content).
                el.contentEditable = 'false';
                return el;
              },
              { side: -1, key: `page-break-${node.attrs.id}` }
            )
          );
        });
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
