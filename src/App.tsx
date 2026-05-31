import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { LessonResult } from './core/types';
import type { Settings } from './core/settings';
import { KeyStatsMap } from './core/keyStats';
import { BigramStatsMap } from './core/bigramStats';
import { PhoneticModel } from './core/phonetic';
import { GuidedLesson, type LessonPlan } from './core/guided';
import { TextInput } from './core/textInput';
import { isValidResult } from './core/result';
import { WORDS } from './core/words';
import {
  loadSettings,
  saveSettings,
  loadHistory,
  appendHistory,
  saveHistory,
  clearHistory,
} from './core/persist';
import { TypingBoard } from './ui/TypingBoard';
import { Keyboard } from './ui/Keyboard';
import { StatsPanel } from './ui/StatsPanel';
import { Analysis } from './ui/Analysis';
import { DARK_THEMES, LIGHT_THEMES } from './ui/themes';
import { fontStack, MONO_FONTS, SANS_FONTS, SERIF_FONTS } from './ui/fonts';

type View = 'practice' | 'analysis';

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const statsRef = useRef(new KeyStatsMap());
  const bigramsRef = useRef(new BigramStatsMap());
  const guidedRef = useRef<GuidedLesson | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const initRef = useRef(false);

  const [view, setView] = useState<View>(() =>
    typeof location !== 'undefined' && location.hash.includes('analysis') ? 'analysis' : 'practice',
  );
  const viewRef = useRef(view);
  viewRef.current = view;

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

  // One-time init: build the model, replay history into per-key stats.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
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
    startNext();
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

  // Apply the active color theme to the document root.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Apply the typing-surface font.
  useEffect(() => {
    document.documentElement.style.setProperty('--font-board', fontStack(settings.font));
  }, [settings.font]);

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
          <select
            className="theme-select"
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value })}
            title="Color theme"
            aria-label="Color theme"
          >
            <optgroup label="Dark">
              {DARK_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Light">
              {LIGHT_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="viewtoggle">
            <button className={view === 'practice' ? 'active' : ''} onClick={() => setView('practice')}>
              Practice
            </button>
            <button
              className={view === 'analysis' ? 'active' : ''}
              onClick={() => {
                setView('analysis');
                rerender();
              }}
            >
              Analysis
            </button>
          </div>
        </div>
      </header>

      {view === 'practice' ? (
        <>
          <div className="controls">
            <label className="rng">
              Target {Math.round(settings.targetSpeed / 5)} wpm
              <input
                type="range"
                min={75}
                max={500}
                step={5}
                value={settings.targetSpeed}
                onChange={(e) => updateSettings({ targetSpeed: Number(e.target.value) })}
              />
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={settings.accuracyAware}
                onChange={(e) => updateSettings({ accuracyAware: e.target.checked })}
              />
              accuracy-aware
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={settings.bigramTargeting}
                onChange={(e) => updateSettings({ bigramTargeting: e.target.checked })}
              />
              bigram targeting
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={settings.naturalWords}
                onChange={(e) => updateSettings({ naturalWords: e.target.checked })}
              />
              natural words
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={settings.recoverKeys}
                onChange={(e) => updateSettings({ recoverKeys: e.target.checked })}
              />
              recover keys
            </label>
            <label className="rng cursor-pick">
              Cursor
              <select
                className="theme-select"
                value={settings.cursorStyle}
                onChange={(e) =>
                  updateSettings({ cursorStyle: e.target.value as Settings['cursorStyle'] })
                }
                aria-label="Cursor style"
              >
                <option value="box">Box</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
                <option value="block">Block (reverse)</option>
              </select>
            </label>
            <label className="rng cursor-pick">
              Font
              <select
                className="theme-select"
                value={settings.font}
                onChange={(e) => updateSettings({ font: e.target.value })}
                aria-label="Typing font"
              >
                <optgroup label="Monospace">
                  {MONO_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Sans-serif">
                  {SANS_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Serif">
                  {SERIF_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button onClick={() => startNext()} title="Skip lesson (Ctrl+→)">
              Skip
            </button>
            <button className="danger" onClick={onClear} title="Erase local progress">
              Clear
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
      ) : (
        <Analysis
          stats={statsRef.current}
          bigrams={bigramsRef.current}
          settings={settings}
          history={history}
          onExport={onExport}
          onImportClick={() => fileRef.current?.click()}
        />
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
