// Generates src/theme.css. Each preset's signature hex palette is converted to
// OKLCH (sRGB -> linear -> OKLab -> OKLCH, Björn Ottosson's matrices) so the
// design tokens are perceptually-uniform and exact. Run: node scripts/gen-themes.mjs
//
// typrlab serves programmers AND writers/students/professionals, so the set spans
// popular dark dev themes and calm, reading-friendly LIGHT themes (incl. a warm
// sepia "Paper"). Light vs dark is environment/person dependent — users choose.
// Palettes are each project's canonical colors; only the tokens typrlab needs are
// taken, and surface/edge/soft variants are derived by nudging OKLCH lightness.
import { writeFileSync } from 'node:fs';

const srgbToLinear = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, Math.hypot(A, B), H];
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r = (x, n) => Number(x.toFixed(n));
const css = ([L, C, H], a) =>
  a == null
    ? `oklch(${r(L, 3)} ${r(C, 4)} ${r(H, 1)})`
    : `oklch(${r(L, 3)} ${r(C, 4)} ${r(H, 1)} / ${a})`;
const setL = ([, C, H], nl) => [clamp(nl, 0, 1), C, H];
const lighten = ([L, C, H], d) => [clamp(L + d, 0, 1), C, H];

// id, label, scheme, and the signature hexes typrlab needs.
const THEMES = [
  // --- Dark ---
  {
    id: 'amber',
    label: 'Amber',
    scheme: 'dark',
    def: true,
    bg: '#0a0b0e',
    panel: '#14171d',
    line: '#242a34',
    text: '#eef1f6',
    muted: '#828d9c',
    accent: '#ffb000',
    hit: '#74e0a0',
    miss: '#ff6b6b',
  },
  {
    id: 'dracula',
    label: 'Dracula',
    scheme: 'dark',
    bg: '#282a36',
    panel: '#343746',
    line: '#44475a',
    text: '#f8f8f2',
    muted: '#6272a4',
    accent: '#bd93f9',
    hit: '#50fa7b',
    miss: '#ff5555',
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    scheme: 'dark',
    bg: '#1a1b26',
    panel: '#24283b',
    line: '#414868',
    text: '#c0caf5',
    muted: '#565f89',
    accent: '#7aa2f7',
    hit: '#9ece6a',
    miss: '#f7768e',
  },
  {
    id: 'nord',
    label: 'Nord',
    scheme: 'dark',
    bg: '#2e3440',
    panel: '#3b4252',
    line: '#434c5e',
    text: '#d8dee9',
    muted: '#6c7689',
    accent: '#88c0d0',
    hit: '#a3be8c',
    miss: '#bf616a',
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    scheme: 'dark',
    bg: '#1e1e2e',
    panel: '#292a3d',
    line: '#45475a',
    text: '#cdd6f4',
    muted: '#7f849c',
    accent: '#cba6f7',
    hit: '#a6e3a1',
    miss: '#f38ba8',
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    scheme: 'dark',
    bg: '#282c34',
    panel: '#31363f',
    line: '#3b4048',
    text: '#abb2bf',
    muted: '#5c6370',
    accent: '#61afef',
    hit: '#98c379',
    miss: '#e06c75',
  },
  // --- Light ---
  {
    id: 'paper',
    label: 'Paper',
    scheme: 'light',
    bg: '#f3ead6',
    panel: '#faf4e6',
    line: '#e4d9bf',
    text: '#433a2a',
    muted: '#8a7c61',
    accent: '#b5762a',
    hit: '#5f8b3a',
    miss: '#c0533b',
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    scheme: 'light',
    bg: '#fdf6e3',
    panel: '#eee8d5',
    line: '#d9d2bc',
    text: '#073642',
    muted: '#93a1a1',
    accent: '#268bd2',
    hit: '#859900',
    miss: '#dc322f',
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    scheme: 'light',
    bg: '#ffffff',
    panel: '#f6f8fa',
    line: '#d0d7de',
    text: '#1f2328',
    muted: '#656d76',
    accent: '#0969da',
    hit: '#1a7f37',
    miss: '#cf222e',
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    scheme: 'light',
    bg: '#eff1f5',
    panel: '#e6e9ef',
    line: '#ccd0da',
    text: '#4c4f69',
    muted: '#8c8fa1',
    accent: '#8839ef',
    hit: '#40a02b',
    miss: '#d20f39',
  },
];

function tokens(t) {
  const light = t.scheme === 'light';
  const bg = hexToOklch(t.bg);
  const panel = hexToOklch(t.panel);
  const line = hexToOklch(t.line);
  const text = hexToOklch(t.text);
  const muted = hexToOklch(t.muted);
  const accent = hexToOklch(t.accent);
  const hit = hexToOklch(t.hit);
  const miss = hexToOklch(t.miss);
  const untyped = [clamp((muted[0] + text[0]) / 2, 0, 1), muted[1], muted[2]];
  const accentSoft = [clamp(accent[0] + (light ? -0.08 : 0.1), 0, 1), accent[1] * 0.95, accent[2]];
  // Cursor/active text must contrast the accent: dark text on a light accent, else near-white.
  const onAccent =
    accent[0] > 0.68 ? [0.2, Math.min(accent[1], 0.05), accent[2]] : [0.985, 0.012, accent[2]];
  const keyEdge = setL(panel, panel[0] - 0.05);
  return [
    ['color-scheme', t.scheme],
    ['--bg', css(bg)],
    ['--panel', css(panel)],
    ['--panel-2', css(lighten(panel, light ? 0.02 : 0.03))],
    ['--line', css(line)],
    ['--line-2', css(lighten(line, light ? -0.05 : 0.05))],
    ['--text', css(text)],
    ['--muted', css(muted)],
    ['--untyped', css(untyped)],
    ['--accent', css(accent)],
    ['--accent-soft', css(accentSoft)],
    ['--accent-dim', css(accent, light ? 0.18 : 0.16)],
    ['--accent-line', css(accent, 0.4)],
    ['--on-accent', css(onAccent)],
    ['--key-edge', css(keyEdge)],
    ['--hit', css(hit)],
    ['--miss', css(miss)],
    // Confidence ramp endpoints = this theme's own red/green (mixed in OKLCH at
    // use sites). --on-confidence is the legible text color over those fills.
    ['--slow-key-color', css(miss)],
    ['--fast-key-color', css(hit)],
    ['--on-confidence', light ? 'oklch(0.99 0 0)' : 'oklch(0.16 0.012 265)'],
    ['--glow-1', css(accent, light ? 0.05 : 0.1)],
    ['--glow-2', css(hit, light ? 0.04 : 0.08)],
    ['--grain-opacity', light ? '0.02' : '0.04'],
    // Floating-panel shadow for the board. Light themes need a far softer, tighter
    // shadow than dark ones, or it smears onto the component below.
    [
      '--board-shadow',
      light
        ? '0 12px 28px -20px rgba(0, 0, 0, 0.13)'
        : '0 18px 42px -26px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    ],
  ];
}

const block = (sel, pairs, extra = []) =>
  `${sel} {\n${[...extra, ...pairs].map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`;

const CONSTS = [
  ['--radius', '14px'],
  ['--font-display', `'Space Grotesk', ui-sans-serif, system-ui, sans-serif`],
  ['--font-mono', `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`],
];

const STRUCTURAL = `
*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body,
#root {
  height: 100%;
  margin: 0;
}
body {
  position: relative;
  font-family: var(--font-display);
  color: var(--text);
  background-color: var(--bg);
  background-image:
    radial-gradient(900px 520px at 10% -10%, var(--glow-1), transparent 60%),
    radial-gradient(1000px 620px at 100% -6%, var(--glow-2), transparent 55%),
    radial-gradient(760px 760px at 50% 118%, var(--glow-1), transparent 62%);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 240ms ease, color 240ms ease;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: var(--grain-opacity);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
#root {
  position: relative;
  z-index: 1;
}
::selection {
  background: var(--accent-dim);
}`;

const def = THEMES.find((t) => t.def);
const others = THEMES.filter((t) => !t.def);

const out = [
  '/* GENERATED by scripts/gen-themes.mjs — do not edit by hand. */',
  block(':root', tokens(def), CONSTS),
  ...others.map((t) => block(`[data-theme='${t.id}']`, tokens(t))),
  STRUCTURAL,
  '',
].join('\n\n');

writeFileSync(new URL('../src/theme.css', import.meta.url), out);
console.log(
  `Wrote src/theme.css — ${THEMES.length} themes (${THEMES.filter((t) => t.scheme === 'dark').length} dark, ${THEMES.filter((t) => t.scheme === 'light').length} light)`,
);
