// Per-key performance model. Each key has an exponential moving average
// (alpha = 0.1, keybr's value) over its per-lesson mean times, a running
// minimum of the *smoothed* values (bestTimeToType), a smoothed accuracy, and
// a capped series of smoothed samples for trend/projection.
//
// typr improvement: `effectiveConfidence` folds accuracy into the speed ratio,
// so a fast-but-sloppy key cannot bank confidence the way it can on keybr.
import type { CodePoint, HistogramEntry, LessonResult } from './types';
import { confidence as confidenceOf } from './target';

const ALPHA = 0.1;
const SERIES_CAP = 30;
const ACC_FULL = 0.97; // at/above this accuracy => no penalty
const ACC_ZERO = 0.5; // at/below this accuracy => confidence fully suppressed

/** 1.0 when accurate, ramping to 0 as accuracy falls toward ACC_ZERO. */
export function accuracyPenalty(accuracy: number): number {
  if (accuracy >= ACC_FULL) return 1;
  return Math.max(0, (accuracy - ACC_ZERO) / (ACC_FULL - ACC_ZERO));
}

export interface KeyStat {
  codePoint: CodePoint;
  samples: number;
  hitCount: number;
  missCount: number;
  /** EMA-smoothed ms/char, or null if no timed samples yet. */
  timeToType: number | null;
  /** Min of the smoothed values, or null. Drives default unlocking. */
  bestTimeToType: number | null;
  /** EMA-smoothed accuracy (0..1), or null if no events yet. */
  accuracy: number | null;
  /** Last SERIES_CAP smoothed times, oldest first (for trend/projection). */
  series: number[];
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
        accuracy: null,
        series: [],
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

    const events = h.hitCount + h.missCount;
    if (events > 0) {
      const lessonAcc = h.hitCount / events;
      s.accuracy = s.accuracy === null ? lessonAcc : ALPHA * lessonAcc + (1 - ALPHA) * s.accuracy;
    }

    if (h.timeToType > 0) {
      const prev = s.timeToType;
      const v = prev === null ? h.timeToType : ALPHA * h.timeToType + (1 - ALPHA) * prev;
      s.timeToType = v;
      s.samples += 1;
      s.bestTimeToType = s.bestTimeToType === null ? v : Math.min(s.bestTimeToType, v);
      s.series.push(v);
      if (s.series.length > SERIES_CAP) s.series.shift();
    }
  }

  get(cp: CodePoint): KeyStat | undefined {
    return this.map.get(cp);
  }

  allStats(): KeyStat[] {
    return [...this.map.values()];
  }

  series(cp: CodePoint): number[] {
    return this.map.get(cp)?.series ?? [];
  }

  keyAccuracy(cp: CodePoint): number | null {
    return this.map.get(cp)?.accuracy ?? null;
  }

  /** Live confidence from the current smoothed time (speed only). */
  confidence(cp: CodePoint, targetSpeed: number): number {
    const s = this.map.get(cp);
    if (!s || s.timeToType === null) return 0;
    return confidenceOf(s.timeToType, targetSpeed);
  }

  /** Best-ever confidence from the smoothed minimum (speed only). */
  bestConfidence(cp: CodePoint, targetSpeed: number): number {
    const s = this.map.get(cp);
    if (!s || s.bestTimeToType === null) return 0;
    return confidenceOf(s.bestTimeToType, targetSpeed);
  }

  /**
   * Speed confidence optionally scaled by accuracy. With accuracyAware off this
   * is exactly keybr's behaviour; with it on, a sloppy key is held back.
   */
  effectiveConfidence(
    cp: CodePoint,
    targetSpeed: number,
    useBest: boolean,
    accuracyAware: boolean,
  ): number {
    const speedConf = useBest
      ? this.bestConfidence(cp, targetSpeed)
      : this.confidence(cp, targetSpeed);
    if (!accuracyAware) return speedConf;
    const acc = this.keyAccuracy(cp);
    if (acc === null) return speedConf;
    return speedConf * accuracyPenalty(acc);
  }
}
