// Computes which exported-PDF page each script block falls on, across the
// whole project -- used to show live "Page N" break markers in the Editor
// (see src/editor/pageBreakPlugin.js) so a writer can see how the page count
// is accumulating without leaving the scene they're working on. Reuses
// buildScreenplayPdf's own layout constants and pagination decisions
// (blanksBefore, flattenScript, LAYOUT, TIGHT_AFTER) from screenplayPdf.js
// so this can never drift out of sync with what actually prints.
import { jsPDF } from 'jspdf';
import {
  LAYOUT,
  TIGHT_AFTER,
  PAGE_H,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  RIGHT_EDGE,
  FONT_SIZE,
  LINE_HEIGHT,
  blanksBefore,
  flattenScript,
} from './screenplayPdf.js';

// A throwaway jsPDF instance used purely to measure text wrapping
// (splitTextToSize reads the font/size currently set on the doc) -- nothing
// is ever drawn or saved from it.
function createMeasurer() {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);
  return doc;
}

// Returns `{ blocks, totalPages }`, where `blocks` is one entry per script
// block (in outline order) as `{ id, page, startsNewPage }`. `page` is
// 1-indexed and counts only script pages (the title page isn't page 1 here,
// matching how the PDF itself numbers -- see screenplayPdf.js's
// drawPageNumberIfNeeded, which only prints a number from script page 2 on).
export function computeScriptPagination(project) {
  const measurer = createMeasurer();
  const blocks = flattenScript(project);

  const wrapped = blocks.map((block, i, arr) => {
    const layout = LAYOUT[block.type];
    const text =
      block.type === 'scene_heading' || block.type === 'character' || block.type === 'transition'
        ? block.text.toUpperCase()
        : block.text;
    const wrapWidth = layout.width ?? RIGHT_EDGE - layout.left;
    const lines = measurer.splitTextToSize(text, wrapWidth);
    const next = arr[i + 1];
    const gluedToNext = next ? TIGHT_AFTER[next.type]?.has(block.type) : false;
    return { ...block, layout, lines, gluedToNext };
  });

  let page = 1;
  let y = MARGIN_TOP;
  let prevType = null;
  const results = [];

  for (const block of wrapped) {
    const { id, type, lines, gluedToNext } = block;
    const blanks = blanksBefore(type, prevType);
    let neededHeight = (lines.length + blanks) * LINE_HEIGHT;
    if (gluedToNext) neededHeight += LINE_HEIGHT;

    let startsNewPage = false;
    if (y + neededHeight > PAGE_H - MARGIN_BOTTOM) {
      page += 1;
      y = MARGIN_TOP;
      startsNewPage = true;
    } else {
      y += blanks * LINE_HEIGHT;
    }

    // A block too long to fit on one page by itself still paginates line by
    // line (mirrors screenplayPdf.js's own fallback) -- those extra breaks
    // land mid-block, so they're reflected in later blocks' page numbers but
    // don't get their own marker (there's no block boundary to hang one on).
    for (let i = 0; i < lines.length; i++) {
      if (y + LINE_HEIGHT > PAGE_H - MARGIN_BOTTOM) {
        page += 1;
        y = MARGIN_TOP;
      }
      y += LINE_HEIGHT;
    }

    results.push({ id, page, startsNewPage });
    prevType = type;
  }

  return { blocks: results, totalPages: page };
}
