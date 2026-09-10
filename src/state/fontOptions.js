// Curated font list for Settings -> Appearance. Deliberately not
// exhaustive: every option here is either a genuine screenwriting/manuscript
// standard, a system font needing no download, or a well-established
// Google Fonts family with strong screen legibility -- no novelty/display
// faces. `google` is the family segment for the Google Fonts CSS2 URL (see
// index.html); system fonts leave it null and need no network request.
export const FONT_OPTIONS = [
  // Monospace -- the default. Courier Prime specifically is the modern
  // standard screenplay font (what Final Draft ships with today).
  {
    id: 'courier-new',
    label: 'Courier New',
    category: 'Monospace',
    stack: "'Courier New', Courier, monospace",
    google: null,
  },
  {
    id: 'courier-prime',
    label: 'Courier Prime',
    category: 'Monospace',
    stack: "'Courier Prime', 'Courier New', monospace",
    google: 'Courier+Prime:wght@400;700',
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    category: 'Monospace',
    stack: "'IBM Plex Mono', 'Courier New', monospace",
    google: 'IBM+Plex+Mono:wght@400;600;700',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'Monospace',
    stack: "'JetBrains Mono', 'Courier New', monospace",
    google: 'JetBrains+Mono:wght@400;600;700',
  },
  {
    id: 'space-mono',
    label: 'Space Mono',
    category: 'Monospace',
    stack: "'Space Mono', 'Courier New', monospace",
    google: 'Space+Mono:wght@400;700',
  },

  // Serif
  { id: 'georgia', label: 'Georgia', category: 'Serif', stack: "Georgia, 'Times New Roman', serif", google: null },
  {
    id: 'times-new-roman',
    label: 'Times New Roman',
    category: 'Serif',
    stack: "'Times New Roman', Times, serif",
    google: null,
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    category: 'Serif',
    stack: "'Merriweather', Georgia, serif",
    google: 'Merriweather:wght@400;700',
  },
  {
    id: 'lora',
    label: 'Lora',
    category: 'Serif',
    stack: "'Lora', Georgia, serif",
    google: 'Lora:wght@400;600;700',
  },
  {
    id: 'crimson-pro',
    label: 'Crimson Pro',
    category: 'Serif',
    stack: "'Crimson Pro', Georgia, serif",
    google: 'Crimson+Pro:wght@400;600;700',
  },

  // Sans-serif
  { id: 'helvetica', label: 'Helvetica', category: 'Sans-serif', stack: 'Helvetica, Arial, sans-serif', google: null },
  {
    id: 'inter',
    label: 'Inter',
    category: 'Sans-serif',
    stack: "'Inter', Helvetica, sans-serif",
    google: 'Inter:wght@400;600;700',
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    category: 'Sans-serif',
    stack: "'IBM Plex Sans', Helvetica, sans-serif",
    google: 'IBM+Plex+Sans:wght@400;600;700',
  },
  {
    id: 'work-sans',
    label: 'Work Sans',
    category: 'Sans-serif',
    stack: "'Work Sans', Helvetica, sans-serif",
    google: 'Work+Sans:wght@400;600;700',
  },
  {
    id: 'source-sans-3',
    label: 'Source Sans 3',
    category: 'Sans-serif',
    stack: "'Source Sans 3', Helvetica, sans-serif",
    google: 'Source+Sans+3:wght@400;600;700',
  },
];

export const DEFAULT_FONT_ID = 'courier-new';

export const FONT_BY_ID = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f]));

export function fontStack(id) {
  return FONT_BY_ID[id]?.stack ?? FONT_BY_ID[DEFAULT_FONT_ID].stack;
}
