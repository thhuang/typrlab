'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTypingSession } from '@/hooks/useTypingSession';
import { TypingBoard } from '@/ui/TypingBoard';
import { Keyboard } from '@/ui/Keyboard';
import { StatsPanel } from '@/ui/StatsPanel';
import { Analysis } from '@/ui/Analysis';
import { SettingsView } from '@/ui/SettingsView';

type View = 'practice' | 'analysis' | 'settings';

const PATHS: Record<View, string> = {
  practice: '/',
  analysis: '/analysis',
  settings: '/settings',
};

export default function TyprApp() {
  const pathname = usePathname();
  const router = useRouter();
  const view: View =
    pathname === '/analysis' ? 'analysis' : pathname === '/settings' ? 'settings' : 'practice';

  const {
    settings,
    history,
    plan,
    position,
    hasError,
    last,
    stats,
    bigrams,
    startNext,
    processKey,
    updateSettings,
    clearAll,
    exportData,
    importData,
  } = useTypingSession();

  const fileRef = useRef<HTMLInputElement | null>(null);

  // Capture keystrokes only while practicing.
  useEffect(() => {
    if (view !== 'practice') return;
    const handler = (e: KeyboardEvent) => processKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, processKey]);

  const includedSet = new Set(plan?.included ?? []);
  const focusCp = plan?.focus ?? null;
  const focusChar = focusCp !== null ? String.fromCodePoint(focusCp) : null;
  const bigramFocus = plan?.bigramFocus ?? null;
  const drillLabel = bigramFocus
    ? `${String.fromCodePoint(bigramFocus[0])}→${String.fromCodePoint(bigramFocus[1])}`
    : (focusChar ?? '—');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          typr<span className="caret">_</span>
          <span className="tag">adaptive</span>
        </div>
        <div className="header-right">
          <nav className="viewtoggle">
            {(['practice', 'analysis', 'settings'] as const).map((v) => (
              <button
                key={v}
                className={view === v ? 'active' : ''}
                onClick={() => router.push(PATHS[v])}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {view === 'practice' ? (
        <>
          <div className="actions">
            <span className="actions-target">
              Target {Math.round(settings.targetSpeed / 5)} wpm
            </span>
            <span className="spacer" />
            <button onClick={() => startNext()} title="Skip lesson (Ctrl+→)">
              Skip
            </button>
          </div>

          <main className="stage">
            {plan && (
              <TypingBoard
                text={plan.text}
                position={position}
                hasError={hasError}
                cursorStyle={settings.cursorStyle}
              />
            )}
            <Keyboard
              stats={stats}
              targetSpeed={settings.targetSpeed}
              included={includedSet}
              focus={focusCp}
              recoverKeys={settings.recoverKeys}
            />
            <p className="hint">
              Just start typing — a wrong key holds the cursor until you fix it. Drilling:{' '}
              <b>{drillLabel}</b>
              {bigramFocus ? <span className="muted"> (weak transition)</span> : null}
            </p>
          </main>

          <StatsPanel
            last={last}
            history={history}
            settings={settings}
            unlocked={includedSet.size}
            focus={focusChar}
          />
        </>
      ) : view === 'analysis' ? (
        <Analysis
          stats={stats}
          bigrams={bigrams}
          settings={settings}
          history={history}
          onExport={exportData}
          onImportClick={() => fileRef.current?.click()}
        />
      ) : (
        <SettingsView settings={settings} update={updateSettings} onClear={clearAll} />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importData(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
