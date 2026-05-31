// Per-key performance model. Each key has an exponential moving average
// (alpha = 0.1, keybr's value) over its per-lesson mean times, plus a
// running minimum of the *smoothed* values (bestTimeToType).
import type { CodePoint, HistogramEntry, LessonResult } from './types';
import { confidence as confidenceOf } from './target';

const ALPHA = 0.1;

export interface KeyStat {
  codePoint: CodePoint;
  samples: number;
  hitCount: number;
  missCount: number;
  /** EMA-smoothed ms/char, or null if no timed samples yet. */
  timeToType: number | null;
  /** Min of the smoothed values, or null. Drives default unlocking. */
  bestTimeToType: number | null;
}

export class KeyStatsMap {
  private readonly map = new Map<CodePoint, KeyStat>();

  private ensure(cp: CodePoint): KeyStat {
    let s = this.map.get(cp);
    if (!s) {
      s = {
        codePoint: cp,
        samples: 0,
        hitCount: 0,
        missCount: 0,
        timeToType: null,
        bestTimeToType: null,
      };
      this.map.set(cp, s);
    }
    return s;
  }

  ingestResult(result: LessonResult): void {
    for (const h of result.histogram) this.ingest(h);
  }

  ingest(h: HistogramEntry): void {
    const s = this.ensure(h.codePoint);
    s.hitCount += h.hitCount;
    s.missCount += h.missCount;
    if (h.timeToType > 0) {
      const prev = s.timeToType;
      const v = prev === null ? h.timeToType : ALPHA * h.timeToType + (1 - ALPHA) * prev;
      s.timeToType = v;
      s.samples += 1;
      s.bestTimeToType = s.bestTimeToType === null ? v : Math.min(s.bestTimeToType, v);
    }
  }

  get(cp: CodePoint): KeyStat | undefined {
    return this.map.get(cp);
  }

  /** Live confidence from the current smoothed time. */
  confidence(cp: CodePoint, targetSpeed: number): number {
    const s = this.map.get(cp);
    if (!s || s.timeToType === null) return 0;
    return confidenceOf(s.timeToType, targetSpeed);
  }

  /** Best-ever confidence from the smoothed minimum. */
  bestConfidence(cp: CodePoint, targetSpeed: number): number {
    const s = this.map.get(cp);
    if (!s || s.bestTimeToType === null) return 0;
    return confidenceOf(s.bestTimeToType, targetSpeed);
  }
}
