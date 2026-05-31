// Local-first persistence. Results are the source of truth: per-key stats are
// rebuilt by replaying the history. keybr stores results in IndexedDB and
// settings in localStorage; for the MVP we keep both in localStorage and can
// graduate the results log to IndexedDB later.
import type { LessonResult } from './types';
import { type Settings, DEFAULT_SETTINGS } from './settings';

const SETTINGS_KEY = 'typr.settings';
const HISTORY_KEY = 'typr.history';
const HISTORY_CAP = 2000;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function loadHistory(): LessonResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LessonResult[]) : [];
  } catch {
    return [];
  }
}

export function appendHistory(history: LessonResult[], r: LessonResult): LessonResult[] {
  const next = [...history, r].slice(-HISTORY_CAP);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
