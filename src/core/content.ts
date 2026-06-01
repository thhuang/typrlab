// Content sources — what you practice ON. The typing engine is content-agnostic
// (TextInput, KeyStatsMap, BigramStatsMap, the board, and the cursor all work by
// code point), so a pluggable source layer in front is all that's needed. The
// 'adaptive' source is the existing GuidedLesson; the others return text with NO
// targeting metadata (empty `included` / null `focus`), so the on-screen keyboard
// and the Coach rail hide — but per-key/transition stats still accumulate across
// every mode. See docs/content-modes-plan.md.
import type { Settings } from './settings';
import type { KeyStatsMap } from './keyStats';
import type { BigramStatsMap } from './bigramStats';
import { GuidedLesson, type LessonPlan } from './guided';
import { WORDS } from './words';

export type ContentMode = 'adaptive' | 'words' | 'numbers' | 'custom';

export interface SourceCtx {
  guided: GuidedLesson;
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  settings: Settings;
  rng: () => number;
}

const LINE_MIN_CHARS = 45;

/** A lesson for a non-adaptive mode: text only, no unlock/focus target. */
function plain(text: string): LessonPlan {
  return {
    text,
    included: [],
    focus: null,
    bigramFocus: null,
    nextUnlock: { remaining: 0, nextKey: null },
  };
}

// ---- modifiers (apply to adaptive/words text, like keybr) ----
const PUNCT = ['.', ',', '?', '!', ';', ':'];
function applyModifiers(text: string, s: Settings, rng: () => number): string {
  if (s.capitalsPct <= 0 && s.punctuationPct <= 0) return text;
  return text
    .split(' ')
    .map((w) => {
      if (!w) return w;
      let out = w;
      if (s.capitalsPct > 0 && rng() < s.capitalsPct / 100)
        out = out[0]!.toUpperCase() + out.slice(1);
      if (s.punctuationPct > 0 && rng() < s.punctuationPct / 100)
        out += PUNCT[Math.floor(rng() * PUNCT.length)]!;
      return out;
    })
    .join(' ');
}

// ---- sources ----
function wordsLesson(s: Settings, rng: () => number): string {
  const words: string[] = [];
  let len = 0;
  let prev = '';
  let tries = 0;
  while (len < LINE_MIN_CHARS) {
    const w = WORDS[Math.floor(rng() * WORDS.length)]!;
    // Avoid obvious back-to-back repeats, but always make progress (any rng).
    if (w === prev && ++tries < 8) continue;
    tries = 0;
    words.push(w);
    prev = w;
    len += w.length + 1;
  }
  return applyModifiers(words.join(' '), s, rng);
}

function numbersLesson(s: Settings, rng: () => number): string {
  const size = Math.max(1, Math.min(8, Math.round(s.numberGroupSize)));
  const count = Math.max(1, Math.min(12, Math.round(s.numberGroupCount)));
  const groups: string[] = [];
  for (let i = 0; i < count; i++) {
    let g = '';
    for (let d = 0; d < size; d++) g += Math.floor(rng() * 10).toString();
    groups.push(g);
  }
  return groups.join(' ');
}

function customLesson(s: Settings, rng: () => number): string {
  const words = s.customText.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return 'paste your own text in settings to practice it here';
  // Walk a ~line-length window from a varied start so successive lessons cover the text.
  const start = Math.floor(rng() * words.length);
  const out: string[] = [];
  let len = 0;
  for (let i = 0; i < words.length && len < LINE_MIN_CHARS; i++) {
    const w = words[(start + i) % words.length]!;
    out.push(w);
    len += w.length + 1;
  }
  return out.join(' ');
}

/** Produce the next lesson for the active content mode. */
export function nextLesson(ctx: SourceCtx): LessonPlan {
  const { settings: s, rng } = ctx;
  switch (s.contentMode) {
    case 'words':
      return plain(wordsLesson(s, rng));
    case 'numbers':
      return plain(numbersLesson(s, rng));
    case 'custom':
      return plain(customLesson(s, rng));
    case 'adaptive':
    default: {
      const p = ctx.guided.plan(ctx.stats, s, rng, ctx.bigrams);
      // Modifiers also apply to the adaptive stream (keybr-like); no-op when 0%.
      return { ...p, text: applyModifiers(p.text, s, rng) };
    }
  }
}
