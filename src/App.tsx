import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonResult } from './core/types';
import type { Settings } from './core/settings';
import { KeyStatsMap } from './core/keyStats';
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
  clearHistory,
} from './core/persist';
import { TypingBoard } from './ui/TypingBoard';
import { Keyboard } from './ui/Keyboard';
import { StatsPanel } from './ui/StatsPanel';

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const statsRef = useRef(new KeyStatsMap());
  const guidedRef = useRef<GuidedLesson | null>(null);
  const inputRef = useRef<TextInput | null>(null);
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
    const p = g.plan(statsRef.current, settingsRef.current);
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
    for (const r of h) stats.ingestResult(r);
    statsRef.current = stats;
    setHistory(h);
    startNext();
  }, [startNext]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+Arrow shortcuts: reset / skip the current lesson.
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
    setHistory([]);
    setLast(null);
    startNext();
    rerender();
  }

  const includedSet = new Set(plan?.included ?? []);
  const focusCp = plan?.focus ?? null;
  const focusChar = focusCp !== null ? String.fromCodePoint(focusCp) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          typr <span className="tag">adaptive</span>
        </div>
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
          <button onClick={() => startNext()} title="Skip lesson (Ctrl+→)">
            Skip
          </button>
          <button className="danger" onClick={onClear} title="Erase local progress">
            Clear
          </button>
        </div>
      </header>

      <main className="stage">
        {plan && <TypingBoard text={plan.text} position={position} hasError={hasError} />}
        <Keyboard
          stats={statsRef.current}
          targetSpeed={settings.targetSpeed}
          included={includedSet}
          focus={focusCp}
          recoverKeys={settings.recoverKeys}
        />
        <p className="hint">
          Just start typing — a wrong key holds the cursor until you fix it. Drilling:{' '}
          <b>{focusChar ?? '—'}</b>
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
  );
}
