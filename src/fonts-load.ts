// Self-hosted fonts (Fontsource, Latin subset) — no external CDN. Imported once
// in app/layout.tsx so all picker fonts are bundled and served from typr's own origin.

// UI / display
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';

// Monospace board fonts. JetBrains Mono also powers --font-mono (UI chrome:
// keys at 700, caret at 800), so it keeps its extra weights.
import '@fontsource/atkinson-hyperlegible-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-800.css';
import '@fontsource/cascadia-code/latin-400.css';
import '@fontsource/source-code-pro/latin-400.css';

// Sans-serif
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/lexend/latin-400.css';

// Serif
import '@fontsource/literata/latin-400.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/lora/latin-400.css';
