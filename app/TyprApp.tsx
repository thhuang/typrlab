'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTypingSession } from '@/hooks/useTypingSession';
import { TypingBoard } from '@/ui/TypingBoard';
import { Keyboard } from '@/ui/Keyboard';
import { CoachRail } from '@/ui/CoachRail';
import { StatsPanel } from '@/ui/StatsPanel';
import { ZenView } from '@/ui/ZenView';
import { Analysis } from '@/ui/Analysis';
import { SettingsView } from '@/ui/SettingsView';

type View = 'practice' | 'analysis' | 'settings';

const PATHS: Record<View, string> = {
  practice: '/',
  analysis: '/analysis',
  settings: '/settings',
};

// Hints for the non-adaptive content modes (no unlock/focus; keyboard hidden).
const MODE_HINTS: Record<string, string> = {
  words: 'Words — real words from your frequency bank. Just type.',
  numbers: 'Numbers — random digit groups. Set group size/count in Settings.',
  custom: 'Custom — your own pasted text. Set it in Settings → Practice.',
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
    setPracticeView,
    clearAll,
    exportData,
    importData,
  } = useTypingSession();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const focusBtnRef = useRef<HTMLButtonElement | null>(null);
  // Dev convenience: deep-link into focus mode with #focus (e.g. /#seed&focus).
  const [focusMode, setFocusMode] = useState(
    () =>
      process.env.NODE_ENV === 'development' &&
      typeof location !== 'undefined' &&
      location.hash.includes('focus'),
  );

  // Leave focus mode and return focus to the control that opened it.
  const exitFocus = useCallback(() => {
    setFocusMode(false);
    requestAnimationFrame(() => focusBtnRef.current?.focus());
  }, []);

  // Capture keystrokes only while practicing (focus mode is still the practice view).
  useEffect(() => {
    if (view !== 'practice') return;
    const handler = (e: KeyboardEvent) => processKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, processKey]);

  // Esc leaves focus mode.
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, exitFocus]);

  const includedSet = new Set(plan?.included ?? []);
  const focusCp = plan?.focus ?? null;
  const focusChar = focusCp !== null ? String.fromCodePoint(focusCp) : null;
  const bigramFocus = plan?.bigramFocus ?? null;
  const drillLabel = bigramFocus
    ? `${String.fromCodePoint(bigramFocus[0])}→${String.fromCodePoint(bigramFocus[1])}`
    : (focusChar ?? '—');
  // Non-adaptive modes have no unlock/focus target → hide the keyboard, Coach rail,
  // and the Coach/Instrument layout toggle; show the board + a mode hint.
  const adaptive = settings.contentMode === 'adaptive';

  // Zen focus mode replaces the whole practice screen with a calm, chrome-free view.
  if (view === 'practice' && focusMode && plan) {
    return (
      <ZenView
        plan={plan}
        position={position}
        hasError={hasError}
        settings={settings}
        history={history}
        onExit={exitFocus}
      />
    );
  }

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
            {adaptive && (
              <div className="segmented" role="group" aria-label="Practice layout">
                {(['coach', 'instrument'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`seg${settings.practiceView === v ? ' active' : ''}`}
                    aria-pressed={settings.practiceView === v}
                    onClick={() => setPracticeView(v)}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <span className="actions-target">
              Target {Math.round(settings.targetSpeed / 5)} wpm
            </span>
            <span className="spacer" />
            <button
              ref={focusBtnRef}
              onClick={() => setFocusMode(true)}
              title="Zen focus mode (Esc to exit)"
            >
              Focus
            </button>
            <button onClick={() => startNext()} title="Skip lesson (Ctrl+→)">
              Skip
            </button>
          </div>

          {!adaptive ? (
            <main className="stage">
              {plan && (
                <TypingBoard
                  text={plan.text}
                  position={position}
                  hasError={hasError}
                  cursorStyle={settings.cursorStyle}
                />
              )}
              <p className="hint">{MODE_HINTS[settings.contentMode]}</p>
            </main>
          ) : settings.practiceView === 'instrument' ? (
            <div className="practice-instrument">
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
                  {bigramFocus ? <span className="dim"> (weak transition)</span> : null}
                </p>
              </main>

              <StatsPanel
                last={last}
                history={history}
                settings={settings}
                unlocked={includedSet.size}
                focus={focusChar}
              />
            </div>
          ) : (
            <main className="practice-coach">
              <div className="coach-main">
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
                <p className="hint hint-left">
                  Continuous flow — finishing a line generates the next automatically. A wrong key
                  holds the cursor until you fix it.
                </p>
              </div>
              {plan && (
                <CoachRail plan={plan} stats={stats} bigrams={bigrams} settings={settings} />
              )}
            </main>
          )}
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
