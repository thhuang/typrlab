// The adaptive engine. Implements keybr's GUIDED mode:
//  - letters are introduced in a configurable order (see keyOrder.ts); only the
//    sequence varies — the gate below is unchanged
//  - the active set starts at MIN_SIZE and grows one letter at a time, gated on
//    every included key reaching confidence >= 1 (bestConfidence by default)
//  - each lesson focuses the single weakest included key, which the text
//    generator over-samples via focus-prefix seeding.
import type { CodePoint } from './types';
import { PhoneticModel, type Filter } from './phonetic';
import { KeyStatsMap } from './keyStats';
import { BigramStatsMap } from './bigramStats';
import type { Settings } from './settings';
import { orderedLetters, type KeyOrder } from './keyOrder';

const MIN_SIZE = 6;
const LINE_MIN_CHARS = 45;
const NATURAL_WORD_THRESHOLD = 15;

export interface LessonPlan {
  text: string;
  included: CodePoint[];
  /** Weakest single key (drives the keyboard highlight / unlock display). */
  focus: CodePoint | null;
  /** Weakest transition being drilled this lesson, or null. */
  bigramFocus: [CodePoint, CodePoint] | null;
  /**
   * Progress toward growing the active set (for coaching UI): how many active
   * keys are still below target — and thus blocking the next unlock — plus the
   * next letter that will unlock, or null when every letter is already active.
   */
  nextUnlock: { remaining: number; nextKey: CodePoint | null };
}

export class GuidedLesson {
  // Letter-introduction sequence per policy, cached once (see keyOrder.ts). The
  // active set is sliced from the array for the current settings.keyOrder.
  private readonly orders: Record<KeyOrder, CodePoint[]>;

  constructor(
    private readonly model: PhoneticModel,
    private readonly words: string[],
  ) {
    this.orders = {
      frequency: orderedLetters('frequency'),
      'home-row': orderedLetters('home-row'),
      balanced: orderedLetters('balanced'),
    };
  }

  private chosenConfidence(cp: CodePoint, stats: KeyStatsMap, s: Settings): number {
    // recoverKeys => gate on live confidence, else best-ever (keybr's rule).
    // accuracyAware folds in accuracy (typr's improvement over keybr).
    return stats.effectiveConfidence(cp, s.targetSpeed, !s.recoverKeys, s.accuracyAware);
  }

  /** The active key-introduction order, with a defensive fallback for an
   *  out-of-enum persisted keyOrder (loadSettings spreads unvalidated JSON). */
  private order(s: Settings): CodePoint[] {
    return this.orders[s.keyOrder] ?? this.orders.balanced;
  }

  /** The set of letters active in the current lesson (in the active key order). */
  computeIncluded(stats: KeyStatsMap, s: Settings): CodePoint[] {
    const letters = this.order(s);
    const total = letters.length;
    const forced = MIN_SIZE + Math.round((total - MIN_SIZE) * clamp01(s.alphabetSize));
    let n = Math.max(MIN_SIZE, forced);
    while (n < total) {
      const allConfident = letters
        .slice(0, n)
        .every((cp) => this.chosenConfidence(cp, stats, s) >= 1);
      if (allConfident) n += 1;
      else break;
    }
    return letters.slice(0, n);
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

  plan(
    stats: KeyStatsMap,
    s: Settings,
    rng: () => number = Math.random,
    bigrams?: BigramStatsMap,
  ): LessonPlan {
    const included = this.computeIncluded(stats, s);
    const keyFocus = this.pickFocus(included, stats, s);
    const allowed = new Set(included);

    // Default: seed/over-sample the weakest single key (keybr behaviour).
    let genFocus = keyFocus;
    let boost: Filter['boost'] = null;
    let bigramFocus: [CodePoint, CodePoint] | null = null;

    // Better: if a weak transition exists among unlocked letters, drill that
    // digraph instead — seed its first letter and boost the transition.
    if (s.bigramTargeting && bigrams) {
      const weak = bigrams.weakest(allowed, s.targetSpeed);
      if (weak) {
        bigramFocus = [weak.from, weak.to];
        genFocus = weak.from;
        boost = { from: weak.from, to: weak.to };
      }
    }

    const filter: Filter = { allowed, focus: genFocus, boost };
    const text = this.generateLine(filter, s, rng);

    // Unlock progress, by the same gate computeIncluded uses: the next letter in
    // the active key order, and how many active keys are still below target.
    const letters = this.order(s);
    const nextKey = included.length < letters.length ? letters[included.length]! : null;
    let remaining = 0;
    for (const cp of included) {
      if (this.chosenConfidence(cp, stats, s) < 1) remaining += 1;
    }

    return {
      text,
      included,
      focus: keyFocus,
      bigramFocus,
      nextUnlock: { remaining, nextKey },
    };
  }

  private generateLine(filter: Filter, s: Settings, rng: () => number): string {
    const real = s.naturalWords ? this.realWords(filter) : [];
    const useReal = real.length >= NATURAL_WORD_THRESHOLD;

    // The weak target to over-sample in NATURAL-word lessons too ("adaptive real
    // content"): the focused digraph when drilling a transition, else the weak key.
    const target =
      filter.boost != null
        ? String.fromCodePoint(filter.boost.from) + String.fromCodePoint(filter.boost.to)
        : filter.focus != null
          ? String.fromCodePoint(filter.focus)
          : null;
    const matching = target != null ? real.filter((w) => w.includes(target)) : [];

    // ~70% of the time prefer a real word containing the weak key/transition.
    const pickReal = (): string =>
      matching.length > 0 && rng() < 0.7
        ? matching[Math.floor(rng() * matching.length)]!
        : real[Math.floor(rng() * real.length)]!;

    const words: string[] = [];
    let len = 0;
    let prev = '';
    while (len < LINE_MIN_CHARS) {
      let w = useReal ? pickReal() : this.model.nextWord(filter, rng);
      // Avoid obvious back-to-back repeats when the pool allows variety.
      for (let tries = 0; tries < 3 && w === prev; tries++) {
        w = useReal ? pickReal() : this.model.nextWord(filter, rng);
      }
      words.push(w);
      prev = w;
      len += w.length + 1;
    }
    return words.join(' ');
  }

  /** Bank words usable with the currently-unlocked letters (length >= 2). */
  private realWords(filter: Filter): string[] {
    const out: string[] = [];
    for (const w of this.words) {
      if (w.length < 2) continue;
      let ok = true;
      for (const ch of w) {
        if (!filter.allowed.has(ch.codePointAt(0)!)) {
          ok = false;
          break;
        }
      }
      if (ok) out.push(w);
    }
    return out;
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
