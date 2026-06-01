// User settings. Defaults mirror keybr's verified defaults so behaviour
// matches the reference unless deliberately changed.
import type { KeyOrder } from './keyOrder';
import type { ContentMode } from './content';

export interface Settings {
  /** Target typing speed in CPM. keybr default 175 CPM (= 35 WPM). */
  targetSpeed: number;
  /** 0..1 "unlock more letters" slider; 0 = pure confidence-gated growth. */
  alphabetSize: number;
  /**
   * Order in which new letters are introduced during guided practice. The unlock
   * gate (master a few before advancing) is unchanged — only the sequence varies.
   * See src/core/keyOrder.ts.
   */
  keyOrder: KeyOrder;
  /**
   * false (keybr default): unlock gate uses each key's BEST historical
   * confidence (one good run banks a key). true: uses live confidence,
   * so decayed keys re-lock further progress.
   */
  recoverKeys: boolean;
  /** Prefer real dictionary words over phonetic pseudo-words when enough match. */
  naturalWords: boolean;
  /** Daily practice goal in minutes. keybr default 30. */
  dailyGoalMinutes: number;
  /** Hold the cursor on a wrong key until corrected (keybr default true). */
  stopOnError: boolean;
  /**
   * typr improvement over keybr: require a key to be both fast AND accurate
   * before it counts toward unlocking. keybr's confidence is speed-only, so a
   * fast-but-sloppy key unlocks the next letter prematurely. Default on.
   */
  accuracyAware: boolean;
  /**
   * typr improvement: once enough data exists, drill the weakest *transition*
   * (digraph) rather than only the weakest single key. keybr models single
   * keys only. Default on.
   */
  bigramTargeting: boolean;
  /** Keyboard layout id (informational for now). */
  layout: string;
  /** Active color theme id (see src/ui/themes.ts). */
  theme: string;
  /** Typing cursor indicator style. */
  cursorStyle: 'box' | 'underline' | 'bar' | 'block';
  /** Typing-surface font id (see src/ui/fonts.ts). */
  font: string;
  /** Practice text size in px (size is the evidence-backed lever, not typeface). */
  textSize: number;
  /** Practice layout: 'coach' (focus rail) or 'instrument' (full stat strip). */
  practiceView: 'coach' | 'instrument';
  /** What you practice on: adaptive stream, real words, numbers, or your own text. */
  contentMode: ContentMode;
  /** Custom-mode source text (chunked into practice lines). */
  customText: string;
  /** Numbers mode: digits per group, and groups per line. */
  numberGroupSize: number;
  numberGroupCount: number;
  /** Modifiers for the adaptive/words streams: % of words capitalised / punctuated. */
  capitalsPct: number;
  punctuationPct: number;
}

export const DEFAULT_SETTINGS: Settings = {
  targetSpeed: 175,
  alphabetSize: 0,
  keyOrder: 'balanced',
  recoverKeys: false,
  naturalWords: true,
  dailyGoalMinutes: 30,
  stopOnError: true,
  accuracyAware: true,
  bigramTargeting: true,
  layout: 'en',
  theme: 'paper',
  cursorStyle: 'box',
  font: 'atkinson',
  textSize: 32,
  practiceView: 'coach',
  contentMode: 'adaptive',
  customText: '',
  numberGroupSize: 3,
  numberGroupCount: 6,
  capitalsPct: 0,
  punctuationPct: 0,
};
