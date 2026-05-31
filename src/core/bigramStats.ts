// Per-transition (digraph) performance model — typr's edge over keybr, which
// only models single keys. A slow transition (e.g. a same-finger bigram) hides
// inside an otherwise-fine per-key average; tracking it lets us drill the real
// bottleneck. Same EMA (alpha = 0.1) and confidence definition as per-key stats.
import type { BigramEntry, CodePoint, LessonResult } from './types';
import { confidence as confidenceOf } from './target';

const ALPHA = 0.1;

export interface BigramStat {
  from: CodePoint;
  to: CodePoint;
  samples: number;
  hitCount: number;
  /** EMA-smoothed ms for the transition, or null. */
  timeToType: number | null;
}

export class BigramStatsMap {
  private readonly map = new Map<string, BigramStat>();

  private key(from: CodePoint, to: CodePoint): string {
    return `${from},${to}`;
  }

  ingestResult(result: LessonResult): void {
    if (!result.bigrams) return;
    for (const b of result.bigrams) this.ingest(b);
  }

  ingest(b: BigramEntry): void {
    const k = this.key(b.from, b.to);
    let s = this.map.get(k);
    if (!s) {
      s = { from: b.from, to: b.to, samples: 0, hitCount: 0, timeToType: null };
      this.map.set(k, s);
    }
    s.hitCount += b.hitCount;
    if (b.timeToType > 0) {
      s.timeToType =
        s.timeToType === null ? b.timeToType : ALPHA * b.timeToType + (1 - ALPHA) * s.timeToType;
      s.samples += 1;
    }
  }

  all(): BigramStat[] {
    return [...this.map.values()];
  }

  confidence(from: CodePoint, to: CodePoint, targetSpeed: number): number {
    const s = this.map.get(this.key(from, to));
    if (!s || s.timeToType === null) return 0;
    return confidenceOf(s.timeToType, targetSpeed);
  }

  /**
   * The weakest (lowest-confidence, < 1) transition whose BOTH letters are in
   * `allowed`, with at least `minSamples` observations. null if none qualify.
   */
  weakest(allowed: Set<CodePoint>, targetSpeed: number, minSamples = 2): BigramStat | null {
    let best: BigramStat | null = null;
    let bestConf = Infinity;
    for (const s of this.map.values()) {
      if (s.timeToType === null || s.samples < minSamples) continue;
      if (!allowed.has(s.from) || !allowed.has(s.to)) continue;
      const c = confidenceOf(s.timeToType, targetSpeed);
      if (c < 1 && c < bestConf) {
        bestConf = c;
        best = s;
      }
    }
    return best;
  }
}
