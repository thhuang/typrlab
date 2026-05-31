// The adaptive engine. Implements keybr's GUIDED mode:
//  - letters are ordered by language frequency
//  - the active set starts at MIN_SIZE and grows one letter at a time, gated on
//    every included key reaching confidence >= 1 (bestConfidence by default)
//  - each lesson focuses the single weakest included key, which the text
//    generator over-samples via focus-prefix seeding.
import type { CodePoint } from './types';
import { PhoneticModel, type Filter } from './phonetic';
import { KeyStatsMap } from './keyStats';
import type { Settings } from './settings';

// English letters ordered by descending frequency (keybr orders per language).
const FREQ_ORDER = 'etaoinshrdlcumwfgypbvkjxqz';
const MIN_SIZE = 6;
const LINE_MIN_CHARS = 45;
const NATURAL_WORD_THRESHOLD = 15;

export interface LessonPlan {
  text: string;
  included: CodePoint[];
  focus: CodePoint | null;
}

export class GuidedLesson {
  private readonly letters: CodePoint[];

  constructor(
    private readonly model: PhoneticModel,
    private readonly words: string[],
  ) {
    this.letters = Array.from(FREQ_ORDER).map((c) => c.codePointAt(0)!);
  }

  private chosenConfidence(cp: CodePoint, stats: KeyStatsMap, s: Settings): number {
    return s.recoverKeys
      ? stats.confidence(cp, s.targetSpeed)
      : stats.bestConfidence(cp, s.targetSpeed);
  }

  /** The set of letters active in the current lesson. */
  computeIncluded(stats: KeyStatsMap, s: Settings): CodePoint[] {
    const total = this.letters.length;
    const forced = MIN_SIZE + Math.round((total - MIN_SIZE) * clamp01(s.alphabetSize));
    let n = Math.max(MIN_SIZE, forced);
    while (n < total) {
      const allConfident = this.letters
        .slice(0, n)
        .every((cp) => this.chosenConfidence(cp, stats, s) >= 1);
      if (allConfident) n += 1;
      else break;
    }
    return this.letters.slice(0, n);
  }

  /** The single weakest (lowest-confidence, < 1) included key, or null. */
  pickFocus(included: CodePoint[], stats: KeyStatsMap, s: Settings): CodePoint | null {
    let best: CodePoint | null = null;
    let bestConf = Infinity;
    for (const cp of included) {
      const c = this.chosenConfidence(cp, stats, s);
      if (c < 1 && c < bestConf) {
        bestConf = c;
        best = cp;
      }
    }
    return best;
  }

  plan(stats: KeyStatsMap, s: Settings, rng: () => number = Math.random): LessonPlan {
    const included = this.computeIncluded(stats, s);
    const focus = this.pickFocus(included, stats, s);
    const filter: Filter = { allowed: new Set(included), focus };
    const text = this.generateLine(filter, s, rng);
    return { text, included, focus };
  }

  private generateLine(filter: Filter, s: Settings, rng: () => number): string {
    const real = s.naturalWords ? this.realWords(filter) : [];
    const useReal = real.length >= NATURAL_WORD_THRESHOLD;
    const words: string[] = [];
    let len = 0;
    let prev = '';
    while (len < LINE_MIN_CHARS) {
      let w = useReal ? real[Math.floor(rng() * real.length)]! : this.model.nextWord(filter, rng);
      // Avoid obvious back-to-back repeats when the pool allows variety.
      for (let tries = 0; tries < 3 && w === prev; tries++) {
        w = useReal ? real[Math.floor(rng() * real.length)]! : this.model.nextWord(filter, rng);
      }
      words.push(w);
      prev = w;
      len += w.length + 1;
    }
    return words.join(' ');
  }

  private realWords(filter: Filter): string[] {
    const out: string[] = [];
    for (const w of this.words) {
      if (w.length < 3) continue;
      let ok = true;
      for (const ch of w) {
        if (!filter.allowed.has(ch.codePointAt(0)!)) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(w);
    }
    if (filter.focus !== null) {
      const f = String.fromCodePoint(filter.focus);
      // Bubble words containing the focus letter to the front.
      out.sort((a, b) => (b.includes(f) ? 1 : 0) - (a.includes(f) ? 1 : 0));
    }
    return out;
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
