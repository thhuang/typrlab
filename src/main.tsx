import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme.css';
import './app.css';

async function boot() {
  // Dev-only demo seeding (stripped from production builds).
  if (import.meta.env.DEV && location.hash.includes('seed')) {
    const { seedDemo } = await import('./dev/seed');
    seedDemo();
  }
  // Dev-only theme override via #...theme=<id> (for previews/screenshots).
  if (import.meta.env.DEV) {
    const m = location.hash.match(/theme=([a-z0-9-]+)/);
    if (m) {
      const s = JSON.parse(localStorage.getItem('typr.settings') || '{}');
      s.theme = m[1];
      localStorage.setItem('typr.settings', JSON.stringify(s));
    }
  }
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
