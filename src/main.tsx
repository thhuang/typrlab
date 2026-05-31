import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DEFAULT_SETTINGS } from './core/settings';
import './theme.css';
import './app.css';

async function boot() {
  // Dev-only demo seeding (stripped from production builds).
  if (import.meta.env.DEV && location.hash.includes('seed')) {
    const { seedDemo } = await import('./dev/seed');
    seedDemo();
  }
  // Dev-only overrides via #...theme=<id>&cursor=<style> (for previews).
  if (import.meta.env.DEV) {
    const theme = location.hash.match(/theme=([a-z0-9-]+)/);
    const cursor = location.hash.match(/cursor=([a-z]+)/);
    if (theme || cursor) {
      const s = JSON.parse(localStorage.getItem('typr.settings') || '{}');
      if (theme) s.theme = theme[1];
      if (cursor) s.cursorStyle = cursor[1];
      localStorage.setItem('typr.settings', JSON.stringify(s));
    }
  }
  // Apply the persisted (or default) theme before first paint to avoid a flash.
  let savedTheme = DEFAULT_SETTINGS.theme;
  try {
    savedTheme = JSON.parse(localStorage.getItem('typr.settings') || '{}').theme || savedTheme;
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-theme', savedTheme);

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
