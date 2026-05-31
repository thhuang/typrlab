// Core domain types. The whole system revolves around `timeToType`
// (milliseconds per character) and the derived `confidence` ratio.
// WPM is only ever a display transform (CPM / 5).

export type CodePoint = number;

/** The space code point — used as the word boundary in the phonetic model. */
export const SPACE: CodePoint = 0x20;

/** Per-key tallies for a single completed lesson. */
export interface HistogramEntry {
  codePoint: CodePoint;
  hitCount: number;
  missCount: number;
  /** Mean ms/char for this key in this lesson; 0 if it had no timed hits. */
  timeToType: number;
}

/** The immutable record produced by one finished lesson. */
export interface LessonResult {
  timeStamp: number;
  layout: string;
  /** Number of characters in the lesson text. */
  length: number;
  /** Total typing time in ms (sum of counted keystroke intervals). */
  time: number;
  /** Total incorrect keystrokes. */
  errors: number;
  /** Characters per minute. */
  speed: number;
  /** 0..1 fraction typed without error. */
  accuracy: number;
  /** Distinct characters used (floored at 3), keybr's "complexity". */
  complexity: number;
  /** Composite score (faster + fewer errors + richer text => higher). */
  score: number;
  histogram: HistogramEntry[];
}
