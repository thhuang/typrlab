// Blocking inline script: applies the persisted theme + text size to <html>
// BEFORE first paint, so there is no light/dark flash on load (the next-themes
// pattern). The typing font is applied by a React effect (its default falls back
// cleanly via CSS, so any swap is unnoticeable).
const CODE = `(function(){try{
  var s = JSON.parse(localStorage.getItem('typrlab.settings') || localStorage.getItem('typr.settings') || '{}');
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', s.theme || (dark ? 'amber' : 'paper'));
  document.documentElement.style.setProperty('--board-size', (s.textSize || 32) + 'px');
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
