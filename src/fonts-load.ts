// Self-hosted fonts (Fontsource, Latin subset) — no external CDN. Imported once
// in app/layout.tsx so all picker fonts are bundled and served from typr's own origin.

// UI / display
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';

// Monospace (default board font + on-screen keys at 700 + caret at 800)
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-800.css';
import '@fontsource/fira-code/latin-400.css';
import '@fontsource/ubuntu-mono/latin-400.css';
import '@fontsource/source-code-pro/latin-400.css';
import '@fontsource/cascadia-code/latin-400.css';

// Sans-serif
import '@fontsource/inter/latin-400.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';

// Serif
import '@fontsource/literata/latin-400.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/lora/latin-400.css';

// Self-hosted Meslo LG (not on Fontsource)
import './meslo.css';
