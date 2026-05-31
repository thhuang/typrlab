import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DEFAULT_SETTINGS } from './core/settings';
import { fontStack } from './ui/fonts';
import './theme.css';
import './app.css';

async function boot() {
  // Dev-only demo seeding (stripped from production builds).
  if (import.meta.env.DEV && location.hash.includes('seed')) {
    const { seedDemo } = await import('./dev/seed');
    seedDemo();
  }
  // Dev-only overrides via #...theme=<id>&cursor=<style>&font=<id> (for previews).
  if (import.meta.env.DEV) {
    const theme = location.hash.match(/theme=([a-z0-9-]+)/);
    const cursor = location.hash.match(/cursor=([a-z]+)/);
    const font = location.hash.match(/font=([a-z0-9-]+)/);
    if (theme || cursor || font) {
      const s = JSON.parse(localStorage.getItem('typr.settings') || '{}');
      if (theme) s.theme = theme[1];
      if (cursor) s.cursorStyle = cursor[1];
      if (font) s.font = font[1];
      localStorage.setItem('typr.settings', JSON.stringify(s));
    }
  }
  // Apply the persisted (or default) theme + font before first paint (no flash).
  let saved: { theme?: string; font?: string } = {};
  try {
    saved = JSON.parse(localStorage.getItem('typr.settings') || '{}');
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute('data-theme', saved.theme || DEFAULT_SETTINGS.theme);
  document.documentElement.style.setProperty('--font-board', fontStack(saved.font || DEFAULT_SETTINGS.font));

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
