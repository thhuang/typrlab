// Typing-surface font registry. Applied to the practice board only (the text
// you read/type), via the --font-board CSS variable. All are self-hosted
// (Fontsource, loaded in src/fonts-load.ts); the browser only downloads the one
// actually in use. The picker is comfort/preference — typeface barely affects
// reading speed (see docs/font-research.md) — so accessibility-oriented faces
// are the ones we label. Default: Atkinson Hyperlegible Mono (a disambiguated
// monospace built for legibility: typing-friendly + best for a broad audience).
export type FontCategory = 'mono' | 'sans' | 'serif';

export interface FontDef {
  id: string;
  label: string;
  category: FontCategory;
  stack: string;
}

const MONO = ", ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = ', ui-sans-serif, system-ui, sans-serif';
const SERIF = ', ui-serif, Georgia, Cambria, serif';

export const FONTS: FontDef[] = [
  // Monospace — fixed width, best for typing accuracy. Default first (also the
  // fallback in fontStack), so an unknown/retired saved font lands here.
  {
    id: 'atkinson-mono',
    label: 'Atkinson Hyperlegible Mono',
    category: 'mono',
    stack: `'Atkinson Hyperlegible Mono'${MONO}`,
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'mono',
    stack: `'JetBrains Mono'${MONO}`,
  },
  {
    id: 'cascadia-code',
    label: 'Cascadia Code',
    category: 'mono',
    stack: `'Cascadia Code'${MONO}`,
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    category: 'mono',
    stack: `'Source Code Pro'${MONO}`,
  },
  // Sans-serif.
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible (low-vision)',
    category: 'sans',
    stack: `'Atkinson Hyperlegible'${SANS}`,
  },
  { id: 'inter', label: 'Inter', category: 'sans', stack: `'Inter'${SANS}` },
  { id: 'lexend', label: 'Lexend', category: 'sans', stack: `'Lexend'${SANS}` },
  // Serif.
  { id: 'literata', label: 'Literata', category: 'serif', stack: `'Literata'${SERIF}` },
  { id: 'merriweather', label: 'Merriweather', category: 'serif', stack: `'Merriweather'${SERIF}` },
  { id: 'lora', label: 'Lora', category: 'serif', stack: `'Lora'${SERIF}` },
];

export const MONO_FONTS = FONTS.filter((f) => f.category === 'mono');
export const SANS_FONTS = FONTS.filter((f) => f.category === 'sans');
export const SERIF_FONTS = FONTS.filter((f) => f.category === 'serif');

export function fontStack(id: string): string {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]!).stack;
}

/** Coerce a (possibly retired) saved font id to a valid one, so the picker and
 *  the board never disagree after a shelf change. Falls back to the default. */
export function resolveFontId(id: string): string {
  return FONTS.some((f) => f.id === id) ? id : FONTS[0]!.id;
}
