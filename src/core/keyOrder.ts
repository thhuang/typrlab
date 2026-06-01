// Key-introduction ORDER policy — the sequence in which new letters are unlocked
// during guided practice.
//
// There is NO proven-optimal letter order; it's a tradeoff between established
// philosophies:
//  - frequency / coverage-first: unlock the commonest letters first so real words
//    form early. Assumes you ALREADY touch-type; front-loads awkward cross-hand /
//    cross-row reaches.
//  - home-row / finger-zone-first: the classic touch-typing pedagogy — anchor on
//    the home row, expand by row. Best for beginners forming finger habits; weaker
//    early word variety.
//  - balanced: frequency-driven but alternated across hands — keeps coverage + real
//    words while removing early awkwardness. The no-regrets default for a broad
//    audience.
//
// The well-supported part — master a few keys before advancing — is the unlock
// GATE in guided.ts and is left untouched. Only this *sequence* is an untested
// assumption, so it's a named, A/B-testable policy. This module is pure (no UI /
// storage deps) and fully deterministic (no RNG).
import type { CodePoint } from './types';

export type KeyOrder = 'frequency' | 'home-row' | 'balanced';

// English letters by descending frequency (keybr's order). Also the frequency
// frontier the `balanced` walk consumes.
const FREQUENCY = 'etaoinshrdlcumwfgypbvkjxqz';

// Home row → top row → bottom row, frequency-ordered within each zone.
const HOME_ROW = 'ashdlfgkjetoiruwypqncmbvxz';

// Standard QWERTY 8-finger map: each letter → [hand, fingerId]. All 26 once.
type Hand = 'L' | 'R';
const FINGER_OF: Record<string, [Hand, string]> = (() => {
  const groups: Array<[Hand, string, string]> = [
    ['L', 'pinky', 'qaz'],
    ['L', 'ring', 'wsx'],
    ['L', 'middle', 'edc'],
    ['L', 'index', 'rtfgvb'],
    ['R', 'index', 'yuhjnm'],
    ['R', 'middle', 'ik'],
    ['R', 'ring', 'ol'],
    ['R', 'pinky', 'p'],
  ];
  const map: Record<string, [Hand, string]> = {};
  for (const [hand, finger, letters] of groups) {
    for (const ch of letters) map[ch] = [hand, `${hand}-${finger}`];
  }
  return map;
})();

// Greedy hand/finger-balanced walk of the frequency order: each step takes the
// top-K=4 frequency frontier and picks the candidate that least loads the hands,
// then fingers, with frequency rank as the final (deterministic) tiebreak. This
// keeps coverage near the frequency frontier while alternating hands early on —
// e.g. the first six come out e,o,t,i,a,n (L,R,L,R,L,R) instead of frequency's
// e,t,a,o,i,n (L,L,L,R,R,R).
function balancedOrder(): string {
  const remaining = FREQUENCY.split('');
  const rank = new Map<string, number>(remaining.map((c, i) => [c, i]));
  const handLoad: Record<Hand, number> = { L: 0, R: 0 };
  const fingerLoad: Record<string, number> = {};
  const order: string[] = [];

  const cost = (c: string): [number, number, number] => {
    const [hand, finger] = FINGER_OF[c]!;
    return [handLoad[hand], fingerLoad[finger] ?? 0, rank.get(c)!];
  };
  const less = (a: [number, number, number], b: [number, number, number]): boolean =>
    a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

  while (remaining.length) {
    const candidates = remaining.slice(0, 4); // top-4 frequency frontier
    let pick = candidates[0]!;
    for (const c of candidates) if (less(cost(c), cost(pick))) pick = c;
    order.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
    const [hand, finger] = FINGER_OF[pick]!;
    handLoad[hand] += 1;
    fingerLoad[finger] = (fingerLoad[finger] ?? 0) + 1;
  }
  return order.join('');
}

const SEQUENCES: Record<KeyOrder, string> = {
  frequency: FREQUENCY,
  'home-row': HOME_ROW,
  balanced: balancedOrder(),
};

/** The 26 a–z code points in the given policy's introduction order. */
export function orderedLetters(policy: KeyOrder): CodePoint[] {
  const seq = SEQUENCES[policy] ?? SEQUENCES.frequency;
  return Array.from(seq).map((c) => c.codePointAt(0)!);
}
