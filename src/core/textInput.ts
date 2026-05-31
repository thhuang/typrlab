// The typing engine — a plain class (NOT React state) that processes
// keystrokes synchronously. Implements keybr's stopOnError behaviour and
// per-keystroke timing, then aggregates a lesson into a LessonResult.
import type { BigramEntry, CodePoint, HistogramEntry, LessonResult } from './types';
import { computeMetrics } from './result';

interface Step {
  codePoint: CodePoint;
  /** ms since the previous correct keystroke (includes correction struggle). */
  time: number;
}

export type Feedback = 'hit' | 'miss' | 'done';

export interface TextInputOptions {
  stopOnError: boolean;
}

// Outlier rejection for per-key timing (>300 WPM / <1 WPM on a single key).
const MIN_KEY_MS = 40;
const MAX_KEY_MS = 12000;

export class TextInput {
  readonly text: string;
  private readonly chars: string[];
  private readonly stopOnError: boolean;
  private pos = 0;
  private lastTime: number | null = null;
  private errorsAtCursor = 0;
  private readonly steps: Step[] = [];
  private readonly misses = new Map<CodePoint, number>();
  completed = false;

  constructor(text: string, opts: TextInputOptions) {
    this.text = text;
    this.chars = Array.from(text);
    this.stopOnError = opts.stopOnError;
  }

  get position(): number {
    return this.pos;
  }
  get hasErrorAtCursor(): boolean {
    return this.errorsAtCursor > 0;
  }
  get length(): number {
    return this.chars.length;
  }

  /** Feed one typed character with its high-res timestamp (ms). */
  onInput(input: string, time: number): Feedback {
    if (this.completed) return 'done';
    const expected = this.chars[this.pos];
    if (expected === undefined) {
      this.completed = true;
      return 'done';
    }
    const cp = expected.codePointAt(0)!;
    const match = input.toLowerCase() === expected.toLowerCase();

    if (match) {
      const dt = this.lastTime === null ? 0 : time - this.lastTime;
      this.steps.push({ codePoint: cp, time: dt });
      this.lastTime = time;
      this.errorsAtCursor = 0;
      this.pos += 1;
      if (this.pos >= this.chars.length) {
        this.completed = true;
        return 'done';
      }
      return 'hit';
    }

    // Wrong key: count a miss against the expected char.
    this.misses.set(cp, (this.misses.get(cp) ?? 0) + 1);
    this.errorsAtCursor += 1;
    if (!this.stopOnError) {
      // Permissive mode: advance past the char with no timing sample.
      this.errorsAtCursor = 0;
      this.pos += 1;
      this.lastTime = time;
      if (this.pos >= this.chars.length) {
        this.completed = true;
        return 'done';
      }
    }
    // stopOnError mode: do NOT advance and do NOT move lastTime — the eventual
    // correct keystroke's time will span the whole correction.
    return 'miss';
  }

  /** Aggregate the finished lesson into an immutable LessonResult. */
  result(timeStamp: number, layout: string): LessonResult {
    // Discard the first "trigger" step (keybr does steps.slice(1)).
    const counted = this.steps.slice(1);

    const byCp = new Map<CodePoint, { hit: number; times: number[] }>();
    for (const s of counted) {
      let e = byCp.get(s.codePoint);
      if (!e) {
        e = { hit: 0, times: [] };
        byCp.set(s.codePoint, e);
      }
      e.hit += 1;
      if (s.time >= MIN_KEY_MS && s.time <= MAX_KEY_MS) e.times.push(s.time);
    }

    const histogram: HistogramEntry[] = [];
    const cps = new Set<CodePoint>([...byCp.keys(), ...this.misses.keys()]);
    for (const cp of cps) {
      const e = byCp.get(cp);
      const times = e?.times ?? [];
      const mean = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      histogram.push({
        codePoint: cp,
        hitCount: e?.hit ?? 0,
        missCount: this.misses.get(cp) ?? 0,
        timeToType: mean,
      });
    }

    // Per-transition (digraph) timing: consecutive counted steps. The interval
    // recorded on step i IS the time to type `to` given the preceding `from`.
    const byBigram = new Map<
      string,
      { from: CodePoint; to: CodePoint; hit: number; times: number[] }
    >();
    for (let i = 1; i < counted.length; i++) {
      const from = counted[i - 1]!.codePoint;
      const to = counted[i]!.codePoint;
      const dt = counted[i]!.time;
      const key = `${from},${to}`;
      let e = byBigram.get(key);
      if (!e) {
        e = { from, to, hit: 0, times: [] };
        byBigram.set(key, e);
      }
      e.hit += 1;
      if (dt >= MIN_KEY_MS && dt <= MAX_KEY_MS) e.times.push(dt);
    }
    const bigrams: BigramEntry[] = [];
    for (const e of byBigram.values()) {
      const mean = e.times.length
        ? Math.round(e.times.reduce((a, b) => a + b, 0) / e.times.length)
        : 0;
      bigrams.push({ from: e.from, to: e.to, hitCount: e.hit, timeToType: mean });
    }

    const length = this.chars.length;
    const time = counted.reduce((a, s) => a + s.time, 0);
    const errors = Array.from(this.misses.values()).reduce((a, b) => a + b, 0);
    const distinct = new Set(counted.map((s) => s.codePoint)).size;
    const metrics = computeMetrics(length, time, errors, distinct);

    return { timeStamp, layout, length, time, errors, ...metrics, histogram, bigrams };
  }
}
