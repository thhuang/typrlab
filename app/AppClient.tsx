'use client';
// typrlab is a client-heavy, local-first app: its state lives in the browser
// (IndexedDB/localStorage) and the practice loop is pure client interaction.
// We load it with ssr:false so browser-only code never runs on the server — no
// hydration mismatches — while the layout still server-renders the shell + the
// no-flash theme script. It lives in the persistent layout, so in-memory engine
// state survives navigation between /, /analysis, /settings.
import dynamic from 'next/dynamic';

const TyprlabApp = dynamic(() => import('./TyprlabApp'), { ssr: false });

export function AppClient() {
  return <TyprlabApp />;
}
