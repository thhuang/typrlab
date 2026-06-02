// Dev-only seeders for demoing/screenshotting without typing dozens of lessons
// by hand. Dynamically imported by useTypingSession only when
// `process.env.NODE_ENV === 'development'` and the URL hash asks for a seed
// (`#seed` → seedDemo, `#seedfull` → seedFull) — so this is stripped from
// production builds.
import type { BigramEntry, HistogramEntry, LessonResult } from '../core/types';
import { computeMetrics } from '../core/result';
import { speedToTime } from '../core/target';

// Wall-clock completion times, oldest-first, spread across the last `spreadDays`
// and ending at "now" — so the practice calendar + day-streak demo look real
// (matches the wall-clock `Date.now()` the live commit path now records).
function spreadTimestamps(n: number, spreadDays: number): number[] {
  const now = Date.now();
  const DAY = 86_400_000;
  return Array.from({ length: n }, (_, i) => {
    const off = Math.round(((n - 1 - i) / Math.max(1, n - 1)) * spreadDays);
    return now - off * DAY - (n - 1 - i) * 2000; // monotonic; newest == now
  });
}

// from, to, base ms, ms improvement per lesson. th/er stay slow on purpose.
const BIGRAMS: Array<[string, string, number, number]> = [
  ['t', 'h', 330, 1.1],
  ['e', 'r', 320, 1.0],
  ['i', 'n', 180, 3.0],
  ['o', 'n', 180, 3.0],
  ['a', 't', 185, 2.8],
  ['h', 'e', 175, 3.0],
];

export function seedDemo(): void {
  const letters = 'etaoinshrd'.split('');
  const weak = new Set(['n', 'r']); // these stay slower & sloppier on purpose
  const results: LessonResult[] = [];
  const now = Date.now();
  const DAY = 86_400_000;
  const DAYS = 18;
  const GOAL = 10; // demo daily goal (minutes)
  const gaps = new Set([13, 16]); // days-ago with no practice (calendar texture)
  let idx = 0;

  // One day at a time, OLDEST first, generating several short (~30–50s) lessons per
  // day until the day's minutes hit a target — so daily volume (and the goal-met
  // streak) is realistic. Speed only depends on timeToType, so the larger hitCount
  // inflates minutes without changing the wpm curve.
  for (let d = DAYS - 1; d >= 0; d--) {
    if (gaps.has(d)) continue;
    const targetMin = d < 12 ? 14 : 5; // recent 12 days clear the 10-min goal; earlier are lighter
    let dayMin = 0;
    let perDay = 0;
    while (dayMin < targetMin && perDay < 40) {
      const unlocked = letters.slice(0, Math.min(letters.length, 6 + Math.floor(idx / 60)));
      const histogram: HistogramEntry[] = unlocked.map((ch) => {
        const base = weak.has(ch) ? 270 : 205;
        const improve = (weak.has(ch) ? 0.18 : 0.5) * idx; // gentle gain over many lessons
        const timeToType = Math.round(Math.max(70, base - improve));
        const missCount = weak.has(ch) ? 1 : idx % 9 === 0 ? 1 : 0;
        return { codePoint: ch.codePointAt(0)!, hitCount: 40, missCount, timeToType };
      });
      const length = histogram.reduce((a, h) => a + h.hitCount, 0);
      const errors = histogram.reduce((a, h) => a + h.missCount, 0);
      const time = histogram.reduce((a, h) => a + h.hitCount * h.timeToType, 0);
      const metrics = computeMetrics(length, time, errors, histogram.length);
      const unlockedSet = new Set(unlocked);
      const bigrams: BigramEntry[] = BIGRAMS.filter(
        ([f, t]) => unlockedSet.has(f) && unlockedSet.has(t),
      ).map(([f, t, b, imp]) => ({
        from: f.codePointAt(0)!,
        to: t.codePointAt(0)!,
        hitCount: 24,
        timeToType: Math.round(Math.max(70, b - imp * (idx / 8))),
      }));
      const ts = Math.min(now, now - d * DAY + perDay * 90_000); // within the day, never future
      results.push({
        timeStamp: ts,
        layout: 'en',
        length,
        time,
        errors,
        ...metrics,
        histogram,
        bigrams,
      });
      dayMin += time / 60_000;
      perDay += 1;
      idx += 1;
    }
  }

  localStorage.setItem('typrlab.history', JSON.stringify(results));
  // 60 wpm (300 CPM) target so weak keys show real projections; a 10-min daily goal
  // the recent days clear, so the calendar shows a live streak.
  localStorage.setItem(
    'typrlab.settings',
    JSON.stringify({ targetSpeed: 300, dailyGoalMinutes: GOAL }),
  );
}

// Fully-mastered history: every letter unlocked and comfortably above target.
// Used to exercise the "all keys at target" states (e.g. the Coach rail's
// empty "Weakest keys" panel), which the normal seedDemo never reaches because
// it keeps a couple of keys weak.
export function seedFull(): void {
  const target = 300; // CPM
  const fast = Math.round(speedToTime(target) * 0.6); // ~1.7x target → confidence > 1
  const letters = 'etaoinshrdlcumwfgypbvkjxqz'.split('');
  const results: LessonResult[] = [];
  const N = 12;
  const stamps = spreadTimestamps(N, 11); // 12 lessons over ~12 days → full streak

  for (let i = 0; i < N; i++) {
    const histogram: HistogramEntry[] = letters.map((ch) => ({
      codePoint: ch.codePointAt(0)!,
      hitCount: 200, // long sessions so each day clears the daily goal (calendar streak)
      missCount: 0,
      timeToType: fast,
    }));
    const length = histogram.reduce((a, h) => a + h.hitCount, 0);
    const time = histogram.reduce((a, h) => a + h.hitCount * h.timeToType, 0);
    const metrics = computeMetrics(length, time, 0, histogram.length);
    results.push({
      timeStamp: stamps[i]!,
      layout: 'en',
      length,
      time,
      errors: 0,
      ...metrics,
      histogram,
      bigrams: [],
    });
  }

  localStorage.setItem('typrlab.history', JSON.stringify(results));
  localStorage.setItem(
    'typrlab.settings',
    JSON.stringify({ targetSpeed: target, dailyGoalMinutes: 10 }),
  );
}
