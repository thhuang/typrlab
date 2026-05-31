'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { LessonResult } from '@/core/types';
import type { Settings } from '@/core/settings';
import { KeyStatsMap } from '@/core/keyStats';
import { BigramStatsMap } from '@/core/bigramStats';
import { PhoneticModel } from '@/core/phonetic';
import { GuidedLesson, type LessonPlan } from '@/core/guided';
import { TextInput } from '@/core/textInput';
import { isValidResult } from '@/core/result';
import { WORDS } from '@/core/words';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  appendHistory,
  saveHistory,
  clearHistory,
} from '@/core/persist';
import { TypingBoard } from '@/ui/TypingBoard';
import { Keyboard } from '@/ui/Keyboard';
import { StatsPanel } from '@/ui/StatsPanel';
import { Analysis } from '@/ui/Analysis';
import { fontStack } from '@/ui/fonts';
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
  const viewRef = useRef(view);
  viewRef.current = view;

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const statsRef = useRef(new KeyStatsMap());
  const bigramsRef = useRef(new BigramStatsMap());
  const guidedRef = useRef<GuidedLesson | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initRef = useRef(false);

  const [history, setHistory] = useState<LessonResult[]>([]);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [position, setPosition] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [last, setLast] = useState<LessonResult | null>(null);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const startNext = useCallback(() => {
    const g = guidedRef.current;
    if (!g) return;
    const p = g.plan(statsRef.current, settingsRef.current, Math.random, bigramsRef.current);
    setPlan(p);
    inputRef.current = new TextInput(p.text, { stopOnError: settingsRef.current.stopOnError });
    setPosition(0);
    setHasError(false);
  }, []);

  // One-time init: (dev) apply hash hooks, build the model, replay history.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      if (process.env.NODE_ENV === 'development' && typeof location !== 'undefined') {
        try {
          const hash = location.hash;
          if (hash.includes('seed') && !localStorage.getItem('typr.history')) {
            const { seedDemo } = await import('@/dev/seed');
            seedDemo();
          }
          const grab = (re: RegExp) => hash.match(re)?.[1];
          const t = grab(/theme=([a-z0-9-]+)/);
          const f = grab(/font=([a-z0-9-]+)/);
          const c = grab(/cursor=([a-z]+)/);
          if (t || f || c) {
            const s = JSON.parse(localStorage.getItem('typr.settings') || '{}');
            if (t) s.theme = t;
            if (f) s.font = f;
            if (c) s.cursorStyle = c;
            localStorage.setItem('typr.settings', JSON.stringify(s));
          }
        } catch {
          /* ignore dev hash errors */
        }
      }

      const model = new PhoneticModel(WORDS, 3);
      guidedRef.current = new GuidedLesson(model, WORDS);
      const h = loadHistory();
      const stats = new KeyStatsMap();
      const bigrams = new BigramStatsMap();
      for (const r of h) {
        stats.ingestResult(r);
        bigrams.ingestResult(r);
      }
      statsRef.current = stats;
      bigramsRef.current = bigrams;
      setHistory(h);
      // Re-sync settings in case dev overrides changed localStorage.
      const s = loadSettings();
      settingsRef.current = s;
      setSettings(s);
      startNext();
    })();
  }, [startNext]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (viewRef.current !== 'practice') return;
      if (e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        startNext();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const input = inputRef.current;
      if (!input) return;
      const key = e.key;
      if (key === ' ') e.preventDefault();
      if (key.length !== 1) return;

      const fb = input.onInput(key, e.timeStamp);
      setPosition(input.position);
      setHasError(input.hasErrorAtCursor);

      if (fb === 'done') {
        const r = input.result(e.timeStamp, settingsRef.current.layout);
        setLast(r);
        if (isValidResult(r)) {
          statsRef.current.ingestResult(r);
          bigramsRef.current.ingestResult(r);
          setHistory((prev) => appendHistory(prev, r));
        }
        startNext();
        rerender();
      }
    },
    [startNext, rerender],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Apply theme / font / size on change (initial flash handled by ThemeScript).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-board', fontStack(settings.font));
  }, [settings.font]);
  useEffect(() => {
    document.documentElement.style.setProperty('--board-size', `${settings.textSize}px`);
  }, [settings.textSize]);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      settingsRef.current = next;
      return next;
    });
    startNext();
    rerender();
  }

  function onClear() {
    clearHistory();
    statsRef.current = new KeyStatsMap();
    bigramsRef.current = new BigramStatsMap();
    setHistory([]);
    setLast(null);
    startNext();
    rerender();
  }

  function onExport() {
    const data = JSON.stringify({ version: 1, settings: settingsRef.current, history });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'typr-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          history?: LessonResult[];
          settings?: Partial<Settings>;
        };
        const h = Array.isArray(parsed.history) ? parsed.history : [];
        const stats = new KeyStatsMap();
        const bigrams = new BigramStatsMap();
        for (const r of h) {
          stats.ingestResult(r);
          bigrams.ingestResult(r);
        }
        statsRef.current = stats;
        bigramsRef.current = bigrams;
        setHistory(h);
        saveHistory(h);
        if (parsed.settings) {
          const ns = { ...settingsRef.current, ...parsed.settings };
          settingsRef.current = ns;
          saveSettings(ns);
          setSettings(ns);
        }
        startNext();
        rerender();
      } catch {
        /* invalid file — ignore */
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

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
            <button
              className={view === 'practice' ? 'active' : ''}
              onClick={() => router.push(PATHS.practice)}
            >
              Practice
            </button>
            <button
              className={view === 'analysis' ? 'active' : ''}
              onClick={() => router.push(PATHS.analysis)}
            >
              Analysis
            </button>
            <button
              className={view === 'settings' ? 'active' : ''}
              onClick={() => router.push(PATHS.settings)}
            >
              Settings
            </button>
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
              stats={statsRef.current}
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
          stats={statsRef.current}
          bigrams={bigramsRef.current}
          settings={settings}
          history={history}
          onExport={onExport}
          onImportClick={() => fileRef.current?.click()}
        />
      ) : (
        <SettingsView settings={settings} update={updateSettings} onClear={onClear} />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />
    </div>
  );
}
