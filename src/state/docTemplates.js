// Basic starting templates for new Character Bible / Notes & Research docs.
// Sections match the care package's spec for what a character doc is for:
// physical description, voice/speech patterns, backstory, relationships,
// arc notes.
export function characterTemplate(name = 'New Character') {
  return `# ${name}

## Physical Description

## Voice & Speech Patterns

## Backstory

## Relationships

## Arc Notes
`;
}

export function noteTemplate(title = 'New Note') {
  return `# ${title}

`;
}
