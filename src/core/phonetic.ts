// Phonetic pseudo-word generator: an n-gram letter-transition model trained on
// a word corpus, then sampled as a weighted random walk. Mirrors keybr's
// @keybr/phonetic-model (which uses order-4 over space + alphabet, with the
// space terminator boosted by 1.3^len). We default to order 3 so a small
// in-browser corpus still blends into novel pseudo-words.
import type { CodePoint } from './types';
import { SPACE } from './types';

/** Restricts generation to currently-unlocked letters, with one focus letter. */
export interface Filter {
  /** Unlocked letters (code points), excluding space. */
  allowed: Set<CodePoint>;
  /** The weakest key, seeded at word start so lessons over-sample it. */
  focus: CodePoint | null;
}

const MIN_LEN = 3;
const MAX_LEN = 10;
const SPACE_BOOST_BASE = 1.3;

export class PhoneticModel {
  private readonly order: number;
  // context (order-1 code points joined) -> { nextCodePoint -> count }
  private readonly table = new Map<string, Map<CodePoint, number>>();

  constructor(words: string[], order = 3) {
    this.order = Math.max(2, order);
    for (const w of words) this.train(w.toLowerCase());
  }

  private train(word: string): void {
    if (word.length < MIN_LEN) return;
    const ctx: CodePoint[] = new Array(this.order - 1).fill(SPACE);
    const seq: CodePoint[] = [...Array.from(word).map((c) => c.codePointAt(0)!), SPACE];
    for (const next of seq) {
      const key = ctx.join(',');
      let m = this.table.get(key);
      if (!m) {
        m = new Map();
        this.table.set(key, m);
      }
      m.set(next, (m.get(next) ?? 0) + 1);
      ctx.push(next);
      ctx.shift();
    }
  }

  /** Generate one word respecting the filter. */
  nextWord(filter: Filter, rng: () => number = Math.random): string {
    for (let attempt = 0; attempt < 6; attempt++) {
      const w = this.walk(filter, rng);
      if (w.length >= MIN_LEN) return w;
    }
    return this.fallback(filter, rng);
  }

  private walk(filter: Filter, rng: () => number): string {
    const out: CodePoint[] = [];
    const ctx: CodePoint[] = new Array(this.order - 1).fill(SPACE);
    const seed = (cp: CodePoint) => {
      out.push(cp);
      ctx.push(cp);
      ctx.shift();
    };
    if (filter.focus !== null && filter.allowed.has(filter.focus)) seed(filter.focus);

    while (out.length < MAX_LEN) {
      const seg = this.table.get(ctx.join(','));
      const choices: Array<[CodePoint, number]> = [];
      if (seg) {
        for (const [cp, w] of seg) {
          if (cp === SPACE) {
            if (out.length >= MIN_LEN) {
              choices.push([SPACE, w * Math.pow(SPACE_BOOST_BASE, out.length)]);
            }
          } else if (filter.allowed.has(cp)) {
            choices.push([cp, w]);
          }
        }
      }
      if (choices.length === 0) {
        if (out.length >= MIN_LEN) break;
        const a = this.randomAllowed(filter, out[out.length - 1] ?? null, rng);
        if (a === null) break;
        seed(a);
        continue;
      }
      const pick = weighted(choices, rng);
      if (pick === SPACE) break;
      seed(pick);
    }
    return codePointsToString(out);
  }

  private fallback(filter: Filter, rng: () => number): string {
    const out: CodePoint[] = [];
    if (filter.focus !== null && filter.allowed.has(filter.focus)) out.push(filter.focus);
    const target = MIN_LEN + Math.floor(rng() * (MAX_LEN - MIN_LEN));
    while (out.length < target) {
      const a = this.randomAllowed(filter, out[out.length - 1] ?? null, rng);
      if (a === null) break;
      out.push(a);
    }
    return out.length >= MIN_LEN ? codePointsToString(out) : 'the';
  }

  private randomAllowed(filter: Filter, avoid: CodePoint | null, rng: () => number): CodePoint | null {
    const all = [...filter.allowed];
    if (all.length === 0) return null;
    const pool = all.filter((c) => c !== avoid);
    const chosen = pool.length > 0 ? pool : all;
    return chosen[Math.floor(rng() * chosen.length)]!;
  }
}

function weighted(choices: Array<[CodePoint, number]>, rng: () => number): CodePoint {
  let total = 0;
  for (const [, w] of choices) total += w;
  let r = rng() * total;
  for (const [cp, w] of choices) {
    r -= w;
    if (r <= 0) return cp;
  }
  return choices[choices.length - 1]![0];
}

function codePointsToString(cps: CodePoint[]): string {
  return cps.map((cp) => String.fromCodePoint(cp)).join('');
}
