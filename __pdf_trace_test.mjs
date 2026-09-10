const mod = await import('./src/export/screenplayPdf.js');
const project = {
  name: 'Trace Test',
  titlePage: { title: 'TRACE TEST' },
  acts: [{ id: 'act1', cards: [{ id: 'card1', sceneDoc: { content: [
    { type: 'scene_heading', content: [{ text: 'INT. ROOM - DAY' }] },
    { type: 'character', content: [{ text: 'ELI' }] },
    { type: 'dialogue', content: [{ text: 'Hello there.' }] },
    { type: 'character', content: [{ text: 'MARA' }] },
    { type: 'parenthetical', content: [{ text: '(beat)' }] },
    { type: 'dialogue', content: [{ text: 'Wait.' }] },
  ] } }] }],
};
const doc = mod.buildScreenplayPdf(project);
console.log('pages:', doc.internal.getNumberOfPages());
