// Derived analytics for the Analysis dashboard — a PURE module (no I/O, no React)
// so every aggregate is unit-testable. It reads only data the engine already
// exposes via useTypingSession: the lesson `history`, the live `KeyStatsMap` /
// `BigramStatsMap`, the target speed, and the unlocked-letter set.
//
// Speed is stored as CPM (`LessonResult.speed`); WPM is CPM/5. "raw" wpm is the
// gross rate; "net" wpm folds in accuracy (raw × accuracy), matching keybr's
// net/gross distinction — both derive from existing fields, no new tracking.
import type { CodePoint, LessonResult } from './types';
import type { KeyStatsMap } from './keyStats';
import type { BigramStatsMap } from './bigramStats';
import { timeToSpeed, speedToTime } from './target';

const SPACE_CP = 0x20;
const CPM_PER_WPM = 5;
// Wall-clock guard: real commits now store Date.now() (≥ ~1.7e12). Older saved
// results carried a page-relative DOMHighResTimeStamp (tiny) — those are excluded
// from the calendar only, never from the per-key/speed stats.
const MIN_WALLCLOCK_MS = 1_000_000_000_000; // 2001-09-09; epoch ms are far above this
const DAY_MS = 86_400_000;

const wpm = (cpm: number) => cpm / CPM_PER_WPM;
const isLetter = (cp: CodePoint) => cp >= 0x61 && cp <= 0x7a;
const chr = (cp: CodePoint) => String.fromCodePoint(cp);

// ---- timestamps / days ----

/** Whether a result's timeStamp is a usable wall-clock time (vs. legacy relative). */
export function isDatable(r: LessonResult): boolean {
  return typeof r.timeStamp === 'number' && r.timeStamp >= MIN_WALLCLOCK_MS;
}

/** Stable integer index for the LOCAL calendar day a timestamp falls in. */
export function dayIndex(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

// ---- speed / accuracy / consistency series ----

export interface SpeedPoint {
  raw: number;
  net: number;
}

/** Per-lesson raw + net wpm, oldest first. */
export function speedSeries(history: LessonResult[]): SpeedPoint[] {
  return history.map((r) => {
    const raw = wpm(r.speed);
    return { raw, net: raw * r.accuracy };
  });
}

/** Per-lesson accuracy as a percentage (0–100), oldest first. */
export function accuracySeries(history: LessonResult[]): number[] {
  return history.map((r) => r.accuracy * 100);
}

/** Sample standard deviation of a window. */
function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Rolling std-dev of net wpm (lower = steadier). One value per lesson once the
 *  window fills; emits the partial window early so the line starts at lesson 1. */
export function consistencySeries(history: LessonResult[], window = 5): number[] {
  const net = speedSeries(history).map((p) => p.net);
  return net.map((_, i) => stdDev(net.slice(Math.max(0, i - window + 1), i + 1)));
}

// ---- scorecards ----

const meanWpm = (rs: LessonResult[]) =>
  rs.length ? rs.reduce((a, r) => a + wpm(r.speed), 0) / rs.length : 0;

export interface Scorecards {
  bestWpm: number;
  avgLast10: number;
  /** % change of last-10 avg vs the prior 10, or null if no prior window. */
  avgDeltaPct: number | null;
  recentAccuracy: number; // 0..1, last 10
  accuracyDeltaPct: number | null;
  totalHours: number;
  lessonCount: number;
  lettersUnlocked: number; // a–z count in `included`
  sparkline: number[]; // last 12 net wpm
}

export function scorecards(history: LessonResult[], included: Set<CodePoint>): Scorecards {
  const last10 = history.slice(-10);
  const prev10 = history.slice(-20, -10);
  // Only show a delta once a like-for-like 10-vs-10 comparison exists (i.e. ≥20
  // lessons); below that the "prior 10" window is partial and the % is misleading.
  const hasPrior = prev10.length === 10;
  const avgLast10 = meanWpm(last10);
  const avgPrev10 = meanWpm(prev10);
  const recentAccuracy = last10.length
    ? last10.reduce((a, r) => a + r.accuracy, 0) / last10.length
    : 0;
  const prevAccuracy = prev10.length
    ? prev10.reduce((a, r) => a + r.accuracy, 0) / prev10.length
    : 0;
  return {
    bestWpm: history.length ? Math.max(...history.map((r) => wpm(r.speed))) : 0,
    avgLast10,
    avgDeltaPct: hasPrior && avgPrev10 ? ((avgLast10 - avgPrev10) / avgPrev10) * 100 : null,
    recentAccuracy,
    accuracyDeltaPct:
      hasPrior && prevAccuracy ? ((recentAccuracy - prevAccuracy) / prevAccuracy) * 100 : null,
    totalHours: history.reduce((a, r) => a + r.time, 0) / 3_600_000,
    lessonCount: history.length,
    lettersUnlocked: [...included].filter(isLetter).length,
    sparkline: speedSeries(history)
      .slice(-12)
      .map((p) => p.net),
  };
}

// ---- per-key / per-transition tables ----

export interface SlowKey {
  ch: string;
  ms: number;
  wpm: number;
  deltaMs: number; // vs the target ms/char (positive = slower than target)
}

/** Slowest keys by smoothed ms/char, descending. Excludes space. */
export function slowestKeys(stats: KeyStatsMap, targetSpeed: number, k = 5): SlowKey[] {
  const targetMs = speedToTime(targetSpeed);
  return stats
    .allStats()
    .filter((s) => s.timeToType !== null && s.codePoint !== SPACE_CP)
    .map((s) => ({
      ch: chr(s.codePoint),
      ms: Math.round(s.timeToType!),
      wpm: wpm(timeToSpeed(s.timeToType!)),
      deltaMs: Math.round(s.timeToType! - targetMs),
    }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, k);
}

export interface KeyAccuracy {
  ch: string;
  accuracy: number; // 0..1
}

/** Lowest-accuracy keys, ascending. Excludes space. */
export function lowestAccuracyKeys(stats: KeyStatsMap, k = 5): KeyAccuracy[] {
  return stats
    .allStats()
    .filter((s) => s.accuracy !== null && s.codePoint !== SPACE_CP)
    .map((s) => ({ ch: chr(s.codePoint), accuracy: s.accuracy! }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, k);
}

export interface SlowBigram {
  from: string;
  to: string;
  confidence: number; // 0..1+ (clamp at use site)
  wpm: number;
}

/** Slowest transitions by confidence, ascending. Excludes space on either side. */
export function slowestBigrams(bigrams: BigramStatsMap, targetSpeed: number, k = 5): SlowBigram[] {
  const targetMs = speedToTime(targetSpeed);
  return bigrams
    .all()
    .filter((b) => b.timeToType !== null && b.from !== SPACE_CP && b.to !== SPACE_CP)
    .map((b) => ({
      from: chr(b.from),
      to: chr(b.to),
      confidence: targetMs / b.timeToType!,
      wpm: wpm(timeToSpeed(b.timeToType!)),
    }))
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, k);
}

// ---- per-key speed heatmap (keyboard) ----

export interface KeyboardSpeed {
  /** code point → live speed confidence (0..1+), for the OKLCH color ramp. */
  confidence: Map<CodePoint, number>;
  /** code point → current wpm, for the mini key label. */
  perKeyWpm: Map<CodePoint, number>;
  /** a–z code points NOT in the unlocked set (rendered dim/locked). */
  locked: Set<CodePoint>;
  /** the 3 weakest unlocked letters (lowest confidence), as chars. */
  weakest: string[];
}

export function keyboardSpeed(
  stats: KeyStatsMap,
  targetSpeed: number,
  included: Set<CodePoint>,
): KeyboardSpeed {
  const confidence = new Map<CodePoint, number>();
  const perKeyWpm = new Map<CodePoint, number>();
  const locked = new Set<CodePoint>();
  for (let cp = 0x61; cp <= 0x7a; cp++) {
    const s = stats.get(cp);
    if (!s || s.timeToType === null) {
      if (!included.has(cp)) locked.add(cp);
      continue;
    }
    confidence.set(cp, stats.confidence(cp, targetSpeed));
    perKeyWpm.set(cp, wpm(timeToSpeed(s.timeToType)));
    if (!included.has(cp)) locked.add(cp);
  }
  const weakest = [...confidence.entries()]
    .filter(([cp]) => included.has(cp))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([cp]) => chr(cp));
  return { confidence, perKeyWpm, locked, weakest };
}

// ---- practice calendar ----

export interface Calendar {
  /** local day index → total practice minutes that day (datable results only). */
  dayMinutes: Map<number, number>;
  activeDays: number;
  totalMinutes: number;
  currentStreak: number;
  bestStreak: number;
}

export function calendar(history: LessonResult[], now: number): Calendar {
  const dayMinutes = new Map<number, number>();
  for (const r of history) {
    if (!isDatable(r)) continue;
    const d = dayIndex(r.timeStamp);
    dayMinutes.set(d, (dayMinutes.get(d) ?? 0) + r.time / 60_000);
  }
  const days = [...dayMinutes.keys()].sort((a, b) => a - b);
  const active = new Set(days);

  // Best streak: longest run of consecutive day indices.
  let bestStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  // Current streak: count back from today (with a one-day grace if today is empty
  // but yesterday isn't, so "haven't practiced yet today" doesn't zero it).
  const today = dayIndex(now);
  let cursor = active.has(today) ? today : active.has(today - 1) ? today - 1 : null;
  let currentStreak = 0;
  while (cursor !== null && active.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }

  return {
    dayMinutes,
    activeDays: days.length,
    totalMinutes: [...dayMinutes.values()].reduce((a, b) => a + b, 0),
    currentStreak,
    bestStreak,
  };
}

// ---- top-level composition ----

export interface AnalyticsInput {
  history: LessonResult[];
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  targetSpeed: number;
  included: Set<CodePoint>;
  /** wall-clock "now" for streak math; injectable for tests. */
  now?: number;
}

export interface Analytics {
  scorecards: Scorecards;
  speed: SpeedPoint[];
  accuracy: number[];
  consistency: number[];
  goalWpm: number;
  keyboard: KeyboardSpeed;
  slowestKeys: SlowKey[];
  lowestAccuracyKeys: KeyAccuracy[];
  slowestBigrams: SlowBigram[];
  calendar: Calendar;
}

export function analyze(input: AnalyticsInput): Analytics {
  const { history, stats, bigrams, targetSpeed, included, now = Date.now() } = input;
  return {
    scorecards: scorecards(history, included),
    speed: speedSeries(history),
    accuracy: accuracySeries(history),
    consistency: consistencySeries(history),
    goalWpm: wpm(targetSpeed),
    keyboard: keyboardSpeed(stats, targetSpeed, included),
    slowestKeys: slowestKeys(stats, targetSpeed),
    lowestAccuracyKeys: lowestAccuracyKeys(stats),
    slowestBigrams: slowestBigrams(bigrams, targetSpeed),
    calendar: calendar(history, now),
  };
}
