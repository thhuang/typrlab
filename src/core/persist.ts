// Local-first persistence. Results are the source of truth: per-key stats are
// rebuilt by replaying the history. keybr stores results in IndexedDB and
// settings in localStorage; for the MVP we keep both in localStorage and can
// graduate the results log to IndexedDB later.
import type { LessonResult } from './types';
import { type Settings, DEFAULT_SETTINGS } from './settings';

const SETTINGS_KEY = 'typrlab.settings';
const HISTORY_KEY = 'typrlab.history';
const HISTORY_CAP = 2000;

// Pre-rebrand keys (the product was renamed typr → typrlab). Kept for a one-time,
// non-destructive migration so existing local data survives the rename.
const LEGACY_SETTINGS_KEY = 'typr.settings';
const LEGACY_HISTORY_KEY = 'typr.history';

// Read a key, transparently migrating from its pre-rebrand counterpart the first
// time (copies legacy → current; leaves the legacy copy in place as a backstop).
function readMigrated(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current != null) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (legacy != null) {
    try {
      localStorage.setItem(key, legacy);
    } catch {
      /* storage unavailable — still return the legacy value */
    }
    return legacy;
  }
  return null;
}

export function loadSettings(): Settings {
  try {
    const raw = readMigrated(SETTINGS_KEY, LEGACY_SETTINGS_KEY);
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
    const raw = readMigrated(HISTORY_KEY, LEGACY_HISTORY_KEY);
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

export function saveHistory(history: LessonResult[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_CAP)));
  } catch {
    /* ignore */
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
