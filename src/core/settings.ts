// User settings. Defaults mirror keybr's verified defaults so behaviour
// matches the reference unless deliberately changed.

export interface Settings {
  /** Target typing speed in CPM. keybr default 175 CPM (= 35 WPM). */
  targetSpeed: number;
  /** 0..1 "unlock more letters" slider; 0 = pure confidence-gated growth. */
  alphabetSize: number;
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
  /** Keyboard layout id (informational for now). */
  layout: string;
}

export const DEFAULT_SETTINGS: Settings = {
  targetSpeed: 175,
  alphabetSize: 0,
  recoverKeys: false,
  naturalWords: true,
  dailyGoalMinutes: 30,
  stopOnError: true,
  layout: 'en',
};
