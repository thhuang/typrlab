// Dev-only: seed a realistic practice history so the Analysis view can be
// demoed/screenshotted without typing 40 lessons by hand. Loaded only when
// `import.meta.env.DEV` is true and the URL hash contains "seed" — never ships
// in a production build.
import type { BigramEntry, HistogramEntry, LessonResult } from '../core/types';
import { computeMetrics } from '../core/result';

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
  const N = 40;
  let ts = 1_700_000_000_000;

  for (let i = 0; i < N; i++) {
    const unlocked = letters.slice(0, Math.min(letters.length, 6 + Math.floor(i / 6)));
    const histogram: HistogramEntry[] = unlocked.map((ch) => {
      const base = weak.has(ch) ? 270 : 205;
      const improve = (weak.has(ch) ? 1.3 : 3.2) * i;
      const timeToType = Math.round(Math.max(70, base - improve));
      const missCount = weak.has(ch) ? (i < 26 ? 2 : 1) : i % 7 === 0 ? 1 : 0;
      return { codePoint: ch.codePointAt(0)!, hitCount: 8, missCount, timeToType };
    });
    const length = histogram.reduce((a, h) => a + h.hitCount, 0);
    const errors = histogram.reduce((a, h) => a + h.missCount, 0);
    const time = histogram.reduce((a, h) => a + h.hitCount * h.timeToType, 0);
    const metrics = computeMetrics(length, time, errors, histogram.length);
    const unlockedSet = new Set(unlocked);
    const bigrams: BigramEntry[] = BIGRAMS.filter(
      ([f, t]) => unlockedSet.has(f) && unlockedSet.has(t),
    ).map(([f, t, base, imp]) => ({
      from: f.codePointAt(0)!,
      to: t.codePointAt(0)!,
      hitCount: 5,
      timeToType: Math.round(Math.max(70, base - imp * i)),
    }));
    ts += 90_000;
    results.push({ timeStamp: ts, layout: 'en', length, time, errors, ...metrics, histogram, bigrams });
  }

  localStorage.setItem('typr.history', JSON.stringify(results));
  // Demo with a 60 wpm (300 CPM) target so weak keys show real projections.
  localStorage.setItem('typr.settings', JSON.stringify({ targetSpeed: 300 }));
}
