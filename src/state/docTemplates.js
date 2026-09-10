// Basic starting templates for new Character Bible / Notes & Research docs.
// Sections match the care package's spec for what a character doc is for:
// physical description, voice/speech patterns, backstory, relationships,
// arc notes.
//
// The blank line under each heading is a real (if invisible) paragraph --
// see the NBSP trick in markdownSerde.js -- not just adjacent newlines, so
// there's an actual clickable line to land the cursor on and start typing
// without hitting Enter first, and it survives save/reload rather than
// collapsing away like an ordinary blank markdown line would. Written as an
// escape sequence, not the literal glyph, so it can't get silently
// normalized to a plain space by an editor/tool along the way.
const BLANK = ' ';

export function characterTemplate(name = 'New Character') {
  return `# ${name}

## Physical Description
${BLANK}

## Voice & Speech Patterns
${BLANK}

## Backstory
${BLANK}

## Relationships
${BLANK}

## Arc Notes
${BLANK}
`;
}

export function noteTemplate(title = 'New Note') {
  return `# ${title}

${BLANK}
`;
}
