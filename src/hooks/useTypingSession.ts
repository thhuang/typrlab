// All of typr's stateful logic — the engine, per-key/transition stats, lesson
// generation, persistence, keystroke handling, and settings — lives here, so the
// route component stays thin and presentational. Browser-only (runs client-side).
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { fontStack } from '@/ui/fonts';

export interface TypingSession {
  settings: Settings;
  history: LessonResult[];
  plan: LessonPlan | null;
  position: number;
  hasError: boolean;
  last: LessonResult | null;
  /** Live per-key / per-transition stats (mutated in place during practice). */
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  /** Generate the next lesson. */
  startNext: () => void;
  /** Feed a keydown event (caller attaches the listener only while practicing). */
  processKey: (e: KeyboardEvent) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Switch practice layout (coach/instrument) without regenerating the lesson. */
  setPracticeView: (view: Settings['practiceView']) => void;
  clearAll: () => void;
  exportData: () => void;
  importData: (file: File) => void;
}

/** Dev-only: apply #seed / #seedfull / #theme= / #font= / #cursor= / #view= hash hooks for previews. */
async function applyDevHash(): Promise<void> {
  if (process.env.NODE_ENV !== 'development' || typeof location === 'undefined') return;
  try {
    const hash = location.hash;
    // #seedfull = fully-mastered history (must be checked before #seed, which it contains).
    if (!localStorage.getItem('typr.history')) {
      if (hash.includes('seedfull')) {
        const { seedFull } = await import('@/dev/seed');
        seedFull();
      } else if (hash.includes('seed')) {
        const { seedDemo } = await import('@/dev/seed');
        seedDemo();
      }
    }
    const grab = (re: RegExp) => hash.match(re)?.[1];
    const t = grab(/theme=([a-z0-9-]+)/);
    const f = grab(/font=([a-z0-9-]+)/);
    const c = grab(/cursor=([a-z]+)/);
    const v = grab(/view=(coach|instrument)/);
    if (t || f || c || v) {
      const s = JSON.parse(localStorage.getItem('typr.settings') || '{}');
      if (t) s.theme = t;
      if (f) s.font = f;
      if (c) s.cursorStyle = c;
      if (v) s.practiceView = v;
      localStorage.setItem('typr.settings', JSON.stringify(s));
    }
  } catch {
    /* ignore dev hash errors */
  }
}

export function useTypingSession(): TypingSession {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const statsRef = useRef(new KeyStatsMap());
  const bigramsRef = useRef(new BigramStatsMap());
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
      await applyDevHash();
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
      const s = loadSettings();
      settingsRef.current = s;
      setSettings(s);
      startNext();
    })();
  }, [startNext]);

  const processKey = useCallback(
    (e: KeyboardEvent) => {
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

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveSettings(next);
        settingsRef.current = next;
        return next;
      });
      startNext();
      rerender();
    },
    [startNext, rerender],
  );

  // View-only preference: persist + re-render, but keep the current lesson.
  const setPracticeView = useCallback((practiceView: Settings['practiceView']) => {
    setSettings((prev) => {
      if (prev.practiceView === practiceView) return prev;
      const next = { ...prev, practiceView };
      saveSettings(next);
      settingsRef.current = next;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    clearHistory();
    statsRef.current = new KeyStatsMap();
    bigramsRef.current = new BigramStatsMap();
    setHistory([]);
    setLast(null);
    startNext();
    rerender();
  }, [startNext, rerender]);

  const exportData = useCallback(() => {
    const data = JSON.stringify({ version: 1, settings: settingsRef.current, history });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'typr-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [history]);

  const importData = useCallback(
    (file: File) => {
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
    },
    [startNext, rerender],
  );

  return {
    settings,
    history,
    plan,
    position,
    hasError,
    last,
    stats: statsRef.current,
    bigrams: bigramsRef.current,
    startNext,
    processKey,
    updateSettings,
    setPracticeView,
    clearAll,
    exportData,
    importData,
  };
}
