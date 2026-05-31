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
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
