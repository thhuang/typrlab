// Typing-surface font registry. Applied to the practice board only (the text
// you read/type), via the --font-board CSS variable. All are free Google Fonts
// loaded in index.html; the browser only downloads the one actually in use.
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
  // Monospace — fixed width, best for typing accuracy.
  { id: 'jetbrains-mono', label: 'JetBrains Mono', category: 'mono', stack: `'JetBrains Mono'${MONO}` },
  { id: 'fira-code', label: 'Fira Code', category: 'mono', stack: `'Fira Code'${MONO}` },
  { id: 'ubuntu-mono', label: 'Ubuntu Mono', category: 'mono', stack: `'Ubuntu Mono'${MONO}` },
  { id: 'source-code-pro', label: 'Source Code Pro', category: 'mono', stack: `'Source Code Pro'${MONO}` },
  { id: 'cascadia-code', label: 'Cascadia Code', category: 'mono', stack: `'Cascadia Code'${MONO}` },
  { id: 'meslo', label: 'Meslo LG', category: 'mono', stack: `'Meslo LG'${MONO}` },
  // Sans-serif.
  { id: 'lexend', label: 'Lexend', category: 'sans', stack: `'Lexend'${SANS}` },
  { id: 'atkinson', label: 'Atkinson Hyperlegible (low-vision)', category: 'sans', stack: `'Atkinson Hyperlegible'${SANS}` },
  { id: 'inter', label: 'Inter', category: 'sans', stack: `'Inter'${SANS}` },
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
