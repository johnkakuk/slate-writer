// Renders a project to an industry-format screenplay PDF: a title page
// (from `project.titlePage`, see TitlePageEditor.jsx) followed by the script
// itself -- every beat card's sceneDoc, concatenated in outline order, the
// same order and content the Screenplay view reads live (see
// ScreenplayView.jsx). There's no separate "export document" to keep in
// sync; this always reflects exactly what's in the Outline right now.
//
// Layout follows the standard spec-script margins/indents (12pt Courier,
// 1.5in left / 1in top+right+bottom, 6 lines per vertical inch -- the
// convention behind "one page equals one minute"). Courier is one of
// jsPDF's built-in fonts, so no font file needs to be embedded.
import { jsPDF } from 'jspdf';
import { ELEMENT_TYPE_BY_NAME } from '../editor/elementTypes.js';

const PT = 72; // points per inch
const PAGE_W = 8.5 * PT;
const PAGE_H = 11 * PT;
const MARGIN_TOP = 1 * PT;
const MARGIN_BOTTOM = 1 * PT;
const RIGHT_EDGE = PAGE_W - 1 * PT; // 7.5in from the left page edge
const FONT_SIZE = 12;
const LINE_HEIGHT = 12; // 6 lines/inch -- standard single-spaced Courier 12pt

// Left edge (and, where relevant, width) of each element type, in points
// from the page's left edge -- the conventional Final Draft-style indents.
const LAYOUT = {
  scene_heading: { left: 1.5 * PT, width: 6 * PT },
  action: { left: 1.5 * PT, width: 6 * PT },
  character: { left: 3.7 * PT },
  parenthetical: { left: 3.1 * PT, width: 2.4 * PT },
  dialogue: { left: 2.5 * PT, width: 3.5 * PT },
  transition: { right: RIGHT_EDGE },
};

// Keyed by an element type, valued with the set of preceding types after
// which it stays glued -- no blank line inserted before it. Every other
// transition gets one blank line before it, matching how a real script
// visually separates scene headings, action, and each new speaker.
const TIGHT_AFTER = {
  dialogue: new Set(['character', 'parenthetical']),
  parenthetical: new Set(['character', 'dialogue']),
};

// Matches the in-app read-only Screenplay view's own styling (.sp-scene,
// .sp-char, .sp-trans in index.css all carry font-weight: 700) -- the PDF
// should look like the page the writer's been reading on screen, not a
// stripped-down version of it.
const BOLD_TYPES = new Set(['scene_heading', 'character', 'transition']);

// A new scene heading gets a full blank line more than any other element
// transition -- real scripts (and the in-app Screenplay view's own 16px
// top margin on .sp-scene, vs. ~12px for everything else) give a new scene
// more visual breathing room than just "next line, next character."
function blanksBefore(type, prevType) {
  if (prevType === null) return 0;
  if (type === 'scene_heading') return 2;
  return TIGHT_AFTER[type]?.has(prevType) ? 0 : 1;
}

function nodeText(node) {
  return (node.content ?? []).map((c) => c.text ?? '').join('');
}

function flattenScript(project) {
  const blocks = [];
  for (const act of project.acts) {
    for (const card of act.cards) {
      for (const node of card.sceneDoc?.content ?? []) {
        const text = nodeText(node).trim();
        if (!text || !ELEMENT_TYPE_BY_NAME[node.type]) continue;
        blocks.push({ type: node.type, text });
      }
    }
  }
  return blocks;
}

function drawTitlePage(doc, titlePage, fallbackTitle) {
  doc.setFont('courier', 'normal');
  const centerX = PAGE_W / 2;

  const title = (titlePage.title || fallbackTitle || 'Untitled').trim();
  const credit = (titlePage.credit || 'Written by').trim();
  const author = (titlePage.author || '').trim();
  const basedOn = (titlePage.basedOn || '').trim();

  // Title block sits a little above true vertical center, the usual spot.
  let y = PAGE_H * 0.42;
  doc.setFontSize(14);
  doc.text(title, centerX, y, { align: 'center' });
  y += LINE_HEIGHT * 3;

  doc.setFontSize(FONT_SIZE);
  if (credit) {
    doc.text(credit, centerX, y, { align: 'center' });
    y += LINE_HEIGHT * 1.5;
  }
  if (author) {
    doc.text(author, centerX, y, { align: 'center' });
    y += LINE_HEIGHT * 1.5;
  }
  if (basedOn) {
    y += LINE_HEIGHT * 0.5;
    doc.text(basedOn, centerX, y, { align: 'center' });
  }

  const bottomY = PAGE_H - MARGIN_BOTTOM;
  if (titlePage.contact) {
    const lines = titlePage.contact.split('\n').flatMap((line) => doc.splitTextToSize(line, 2.6 * PT));
    const startY = bottomY - (lines.length - 1) * LINE_HEIGHT;
    lines.forEach((line, i) => doc.text(line, 1.5 * PT, startY + i * LINE_HEIGHT));
  }
  if (titlePage.draftInfo) {
    doc.text(titlePage.draftInfo, RIGHT_EDGE, bottomY, { align: 'right' });
  }
}

export function buildScreenplayPdf(project) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  drawTitlePage(doc, project.titlePage ?? {}, project.name);

  doc.addPage();
  doc.setFont('courier', 'normal');
  doc.setFontSize(FONT_SIZE);

  let scriptPage = 1;
  let y = MARGIN_TOP;
  let prevType = null;

  function drawPageNumberIfNeeded() {
    if (scriptPage < 2) return;
    doc.setFont('courier', 'normal');
    doc.text(`${scriptPage}.`, RIGHT_EDGE, MARGIN_TOP * 0.6, { align: 'right' });
  }
  drawPageNumberIfNeeded();

  function newPage() {
    doc.addPage();
    scriptPage += 1;
    y = MARGIN_TOP;
    drawPageNumberIfNeeded();
  }

  // Wrap every block's text up front, and note whether it's glued to the
  // block right after it (character->dialogue, dialogue->parenthetical,
  // etc. -- see TIGHT_AFTER) -- needed below to look one block ahead.
  const wrapped = flattenScript(project).map((block, i, arr) => {
    const layout = LAYOUT[block.type];
    const text = block.type === 'scene_heading' || block.type === 'character' || block.type === 'transition'
      ? block.text.toUpperCase()
      : block.text;
    const wrapWidth = layout.width ?? RIGHT_EDGE - layout.left;
    const lines = doc.splitTextToSize(text, wrapWidth);
    const next = arr[i + 1];
    const gluedToNext = next ? TIGHT_AFTER[next.type]?.has(block.type) : false;
    return { type: block.type, layout, lines, gluedToNext };
  });

  for (let i = 0; i < wrapped.length; i++) {
    const { type, layout, lines, gluedToNext } = wrapped[i];
    const blanks = blanksBefore(type, prevType);
    let neededHeight = (lines.length + blanks) * LINE_HEIGHT;

    // A block that's glued to the one right after it (a Character cue
    // before its Dialogue, most commonly) must not be left as the last
    // thing on a page with its partner stranded on the next one -- reserve
    // room for at least the glued block's first line too when deciding
    // whether this one fits.
    if (gluedToNext) neededHeight += LINE_HEIGHT;

    // Elements are normally never split mid-block across a page break -- if
    // one doesn't fit, the whole thing (blank lines included) moves to the
    // next page, which also means no floating blank space stranded at a
    // page top. The one exception is a block too long to ever fit on a
    // single page by itself (an uninterrupted action paragraph or a long
    // monologue) -- the per-line check below still paginates it rather than
    // looping forever trying to find room that doesn't exist.
    if (y + neededHeight > PAGE_H - MARGIN_BOTTOM) {
      newPage();
    } else {
      y += blanks * LINE_HEIGHT;
    }

    const font = BOLD_TYPES.has(type) ? 'bold' : 'normal';
    doc.setFont('courier', font);
    for (const line of lines) {
      if (y + LINE_HEIGHT > PAGE_H - MARGIN_BOTTOM) {
        newPage();
        doc.setFont('courier', font); // newPage()'s page number draws in normal weight
      }
      if (type === 'transition') {
        doc.text(line, layout.right, y, { align: 'right' });
      } else {
        doc.text(line, layout.left, y);
      }
      y += LINE_HEIGHT;
    }

    prevType = type;
  }

  return doc;
}

export function exportScreenplayPdf(project) {
  const doc = buildScreenplayPdf(project);
  const filename = `${(project.name || 'Untitled').trim()}.pdf`;
  doc.save(filename);
}
