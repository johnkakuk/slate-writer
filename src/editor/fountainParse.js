// Turns pasted plain text written in (or resembling) Fountain syntax into
// a sequence of { type, text } pairs matching our element types, so a
// multi-line paste from an AI assistant or a .fountain-flavored source
// lands as real scene headings/character cues/dialogue instead of one flat
// block. Deliberately a plain function with no ProseMirror dependency --
// easy to test on its own, and reusable if `.fountain` import ever needs
// the same line-classification logic (see README roadmap).
//
// Follows the actual Fountain spec's own heuristics where they exist
// (character cues need a blank line before and no blank line after,
// scene headings need an INT./EXT.-family prefix, etc.) rather than
// inventing new ones -- Fountain is an inherently a bit ambiguous format
// (e.g. a short all-caps ACTION line can look like a character cue), and
// these are the same trade-offs every Fountain parser accepts.

const SCENE_HEADING_RE = /^(int|ext|est|i\/e|int\.?\/ext\.?)[.\s]/i;
const FADE_RE = /^fade (in|out)[:.]?$|^fade to black[:.]?$/i;

function isAllCaps(line) {
  return line === line.toUpperCase() && /[A-Z]/.test(line);
}

function isTransition(line) {
  if (FADE_RE.test(line)) return true;
  return isAllCaps(line) && /TO:$/.test(line);
}

function isParenthetical(line) {
  return line.startsWith('(') && line.endsWith(')');
}

// Real character names are short, even with an extension like "(V.O.)" --
// caps this out so a long all-caps ACTION line (rare, but real) isn't
// mistaken for one.
function isCharacterCandidate(line) {
  return isAllCaps(line) && line.length <= 40;
}

export function parseFountainText(text) {
  const rawLines = text.split(/\r\n|\r|\n/);
  const results = [];
  let prevBlank = true; // top of the pasted text counts as a fresh start

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      prevBlank = true;
      continue;
    }

    // Forced-type markers (Fountain's own escape hatches): a line starting
    // with one of these characters skips detection entirely.
    if (line[0] === '@') {
      results.push({ type: 'character', text: line.slice(1).trim() });
      prevBlank = false;
      continue;
    }
    if (line[0] === '>' ) {
      results.push({ type: 'transition', text: line.slice(1).trim() });
      prevBlank = false;
      continue;
    }
    if (line[0] === '.' && line[1] !== '.') {
      results.push({ type: 'scene_heading', text: line.slice(1).trim() });
      prevBlank = false;
      continue;
    }
    if (line[0] === '!') {
      results.push({ type: 'action', text: line.slice(1).trim() });
      prevBlank = false;
      continue;
    }

    if (SCENE_HEADING_RE.test(line)) {
      results.push({ type: 'scene_heading', text: line });
      prevBlank = false;
      continue;
    }

    if (isTransition(line)) {
      results.push({ type: 'transition', text: line });
      prevBlank = false;
      continue;
    }

    if (isParenthetical(line)) {
      results.push({ type: 'parenthetical', text: line });
      prevBlank = false;
      continue;
    }

    // A character cue needs a blank line before it and a non-blank line
    // after it (i.e. dialogue actually follows) -- the same disambiguation
    // real Fountain parsers use to tell it apart from a short all-caps
    // action line.
    const nextLine = (rawLines[i + 1] ?? '').trim();
    if (prevBlank && nextLine && isCharacterCandidate(line)) {
      results.push({ type: 'character', text: line });
      prevBlank = false;
      continue;
    }

    // Otherwise: dialogue if we're continuing straight on from a
    // character cue or parenthetical (no blank line in between), action
    // if not.
    const prev = results[results.length - 1];
    const continuingSpeech = !prevBlank && prev && (prev.type === 'character' || prev.type === 'parenthetical' || prev.type === 'dialogue');
    results.push({ type: continuingSpeech ? 'dialogue' : 'action', text: line });
    prevBlank = false;
  }

  return results;
}
