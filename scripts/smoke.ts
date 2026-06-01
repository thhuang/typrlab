// Headless smoke test of the adaptive core. Run: npx tsx scripts/smoke.ts
import { PhoneticModel } from '../src/core/phonetic';
import { GuidedLesson } from '../src/core/guided';
import { KeyStatsMap } from '../src/core/keyStats';
import { BigramStatsMap } from '../src/core/bigramStats';
import { TextInput } from '../src/core/textInput';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/settings';
import { WORDS } from '../src/core/words';
import { speedToTime } from '../src/core/target';
import { projectLessonsToTarget } from '../src/core/learning';
import { orderedLetters, type KeyOrder } from '../src/core/keyOrder';
import { nextLesson, type ContentMode } from '../src/core/content';

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log('  ok  —', msg);
  } else {
    console.error('  FAIL —', msg);
    failures += 1;
  }
}

const model = new PhoneticModel(WORDS, 3);
const guided = new GuidedLesson(model, WORDS);
const stats = new KeyStatsMap();
// Engine-mechanics checks (1–12) assume the legacy FREQUENCY order so the expected
// letters are stable; the order policies themselves are tested in (13).
const settings = { ...DEFAULT_SETTINGS, keyOrder: 'frequency' as const };
const rng = () => 0.42; // deterministic

console.log('1) initial lesson');
const plan = guided.plan(stats, settings, rng);
assert(plan.included.length === 6, `start with 6 letters (got ${plan.included.length})`);
const letters = plan.included.map((cp) => String.fromCodePoint(cp)).join('');
assert(letters === 'etaoin', `first 6 are "etaoin" (got "${letters}")`);
const allowed = new Set(plan.included);
const onlyAllowed = Array.from(plan.text).every(
  (ch) => ch === ' ' || allowed.has(ch.codePointAt(0)!),
);
assert(onlyAllowed, 'generated text uses only unlocked letters');
assert(plan.focus !== null, 'a focus key is chosen');
console.log('     text:', JSON.stringify(plan.text));

console.log('2) banking confidence unlocks the next letter');
const fast = speedToTime(settings.targetSpeed) * 0.5; // 2x target -> confidence ~2
for (let i = 0; i < 3; i++) {
  for (const cp of plan.included) {
    stats.ingest({ codePoint: cp, hitCount: 5, missCount: 0, timeToType: fast });
  }
}
const plan2 = guided.plan(stats, settings, rng);
assert(plan2.included.length === 7, `included grows to 7 (got ${plan2.included.length})`);
assert(String.fromCodePoint(plan2.included[6]!) === 's', 'the 7th unlocked letter is "s"');
assert(plan2.focus === plan2.included[6], 'focus moves to the new (weakest) key "s"');

console.log('3) recoverKeys gate: decayed key blocks further unlock');
const decayStats = new KeyStatsMap();
const slightlySlow = speedToTime(settings.targetSpeed) / 0.9; // live conf 0.9, best 0.9
for (const cp of plan.included) {
  decayStats.ingest({ codePoint: cp, hitCount: 5, missCount: 0, timeToType: slightlySlow });
}
const offGate = guided.computeIncluded(decayStats, { ...settings, recoverKeys: false });
const onGate = guided.computeIncluded(decayStats, { ...settings, recoverKeys: true });
assert(
  offGate.length === 6 && onGate.length === 6,
  'below target on all keys -> no unlock either way',
);

console.log('4) TextInput aggregation (clean run)');
const ti = new TextInput('the and tea', { stopOnError: true });
let t = 1000;
for (const ch of 'the and tea') {
  ti.onInput(ch, t);
  t += 120;
}
const res = ti.result(t, 'en');
assert(ti.completed, 'completes on full input');
assert(res.length === 11, `length 11 (got ${res.length})`);
assert(res.errors === 0, `no errors (got ${res.errors})`);
assert(
  res.speed > 0,
  `speed computed (${Math.round(res.speed)} cpm / ${Math.round(res.speed / 5)} wpm)`,
);

console.log('5) stopOnError holds the cursor and counts the miss');
const ti2 = new TextInput('the', { stopOnError: true });
ti2.onInput('t', 1000);
ti2.onInput('x', 1100); // wrong; expected "h"
assert(ti2.position === 1, 'cursor stays put on a wrong key');
assert(ti2.hasErrorAtCursor, 'cursor flagged as error');
ti2.onInput('h', 1200);
ti2.onInput('e', 1300);
const r2 = ti2.result(1400, 'en');
assert(ti2.completed && r2.errors === 1, 'recovers after correction, 1 error counted');

console.log('6) typr improvement: accuracy-aware unlocking');
const sloppy = new KeyStatsMap();
for (let i = 0; i < 3; i++) {
  for (const cp of plan.included) {
    // fast (2x target) but only 50% accurate
    sloppy.ingest({ codePoint: cp, hitCount: 5, missCount: 5, timeToType: fast });
  }
}
const incAware = guided.computeIncluded(sloppy, { ...settings, accuracyAware: true });
const incBlind = guided.computeIncluded(sloppy, { ...settings, accuracyAware: false });
assert(incAware.length === 6, 'fast-but-sloppy keys do NOT unlock when accuracy-aware (typr)');
assert(incBlind.length === 7, 'same keys DO unlock with speed-only gating (keybr-style)');

console.log('7) learning-rate projection');
const improving = [80, 95, 110, 125, 140, 155, 170];
const p = projectLessonsToTarget(improving, 200);
assert(p !== null && p > 0, `projects lessons-to-target for an improving key (got ${p})`);
const flat = [150, 150, 150, 150, 150];
assert(projectLessonsToTarget(flat, 200) === null, 'no projection when a key is not improving');

console.log('8) bigram capture: TextInput records transitions');
const tib = new TextInput('the the', { stopOnError: true });
let tb = 1000;
for (const ch of 'the the') {
  tib.onInput(ch, tb);
  tb += 100;
}
const resb = tib.result(tb, 'en');
const th = resb.bigrams?.find(
  (b) => b.from === 't'.codePointAt(0)! && b.to === 'h'.codePointAt(0)!,
);
assert(!!th && th.hitCount >= 1, 'records the t→h transition');

console.log('9) bigram model: weakest transition is the slow one');
const bs = new BigramStatsMap();
for (let i = 0; i < 3; i++) {
  bs.ingest({ from: 'a'.codePointAt(0)!, to: 'b'.codePointAt(0)!, hitCount: 3, timeToType: 120 });
  bs.ingest({ from: 'c'.codePointAt(0)!, to: 'd'.codePointAt(0)!, hitCount: 3, timeToType: 400 });
}
const allowedABCD = new Set(['a', 'b', 'c', 'd'].map((c) => c.codePointAt(0)!));
const weak = bs.weakest(allowedABCD, 300);
assert(
  !!weak && weak.from === 'c'.codePointAt(0)! && weak.to === 'd'.codePointAt(0)!,
  'weakest transition is the slow c→d',
);

console.log('10) generation boost over-samples the targeted digraph');
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const model2 = new PhoneticModel(WORDS, 3);
const allowedSet = new Set('etaoinshrd'.split('').map((c) => c.codePointAt(0)!));
function countDigraph(filter: any, from: string, to: string, count: number, r: () => number) {
  let c = 0;
  for (let k = 0; k < count; k++) {
    const w = model2.nextWord(filter, r);
    for (let j = 1; j < w.length; j++) if (w[j - 1] === from && w[j] === to) c += 1;
  }
  return c;
}
const baseFilter = { allowed: allowedSet, focus: null, boost: null };
const boostFilter = {
  allowed: allowedSet,
  focus: null,
  boost: { from: 't'.codePointAt(0)!, to: 'h'.codePointAt(0)! },
};
const noBoost = countDigraph(baseFilter, 't', 'h', 600, makeRng(7));
const withBoost = countDigraph(boostFilter, 't', 'h', 600, makeRng(7));
assert(withBoost > noBoost, `boost raises t→h frequency (no=${noBoost}, boost=${withBoost})`);

console.log('11) guided drills the weakest transition');
const bs2 = new BigramStatsMap();
for (let i = 0; i < 4; i++) {
  bs2.ingest({ from: 'a'.codePointAt(0)!, to: 'o'.codePointAt(0)!, hitCount: 3, timeToType: 500 });
}
const planB = guided.plan(stats, { ...settings, bigramTargeting: true }, () => 0.5, bs2);
const bf = planB.bigramFocus;
assert(
  bf !== null && String.fromCodePoint(bf[0]) + String.fromCodePoint(bf[1]) === 'ao',
  'guided sets bigramFocus to the weak a→o transition',
);

console.log('12) natural-word lessons over-sample the weak transition (real-content targeting)');
const fullStats = new KeyStatsMap();
for (const ch of 'etaoinshrdlcumwfgypbvkjxqz') {
  for (let i = 0; i < 3; i++) {
    fullStats.ingest({
      codePoint: ch.codePointAt(0)!,
      hitCount: 5,
      missCount: 0,
      timeToType: fast,
    });
  }
}
const bsTH = new BigramStatsMap();
for (let i = 0; i < 4; i++) {
  bsTH.ingest({ from: 't'.codePointAt(0)!, to: 'h'.codePointAt(0)!, hitCount: 3, timeToType: 600 });
}
function thRate(bigramTargeting: boolean): number {
  let th = 0;
  let total = 0;
  for (let k = 0; k < 40; k++) {
    const p = guided.plan(
      fullStats,
      { ...settings, naturalWords: true, bigramTargeting },
      Math.random,
      bsTH,
    );
    for (let i = 1; i < p.text.length; i++) if (p.text[i - 1] === 't' && p.text[i] === 'h') th += 1;
    total += p.text.length;
  }
  return th / total;
}
const onTH = thRate(true);
const offTH = thRate(false);
assert(
  onTH > offTH,
  `natural-word targeting raises t→h frequency (on=${onTH.toFixed(4)} > off=${offTH.toFixed(4)})`,
);

console.log('13) key-introduction order policies');
const seqOf = (p: KeyOrder) =>
  orderedLetters(p)
    .map((cp) => String.fromCodePoint(cp))
    .join('');
const AZ = 'abcdefghijklmnopqrstuvwxyz';
for (const p of ['frequency', 'home-row', 'balanced'] as KeyOrder[]) {
  const seq = seqOf(p);
  const isPerm = seq.length === 26 && [...seq].sort().join('') === AZ;
  assert(isPerm, `${p}: permutation of all 26 letters (got "${seq}")`);
}
assert(seqOf('frequency') === 'etaoinshrdlcumwfgypbvkjxqz', 'frequency equals the legacy order');
assert(
  seqOf('home-row').slice(0, 6) === 'ashdlf',
  `home-row starts a,s,h,d,l,f (got ${seqOf('home-row').slice(0, 6)})`,
);
assert(DEFAULT_SETTINGS.keyOrder === 'balanced', `DEFAULT_SETTINGS.keyOrder === 'balanced'`);
// balanced: the first six letters alternate hands — no three consecutive same-hand.
const LEFT = new Set('qwertasdfgzxcvb');
const six = [...seqOf('balanced').slice(0, 6)];
let maxRun = 1;
for (let i = 1, run = 1; i < six.length; i++) {
  run = LEFT.has(six[i]!) === LEFT.has(six[i - 1]!) ? run + 1 : 1;
  maxRun = Math.max(maxRun, run);
}
assert(
  maxRun < 3,
  `balanced first six (${six.join('')}) alternate hands, no 3 in a row (maxRun=${maxRun})`,
);

console.log('14) content modes');
const lessonFor = (mode: ContentMode, extra: Partial<Settings> = {}) =>
  nextLesson({
    guided,
    stats: new KeyStatsMap(),
    bigrams: new BigramStatsMap(),
    settings: { ...settings, contentMode: mode, ...extra },
    rng: makeRng(1),
  });
const adaptiveL = lessonFor('adaptive');
assert(
  adaptiveL.included.length >= 6,
  `adaptive mode keeps a target (${adaptiveL.included.length} letters)`,
);
const wordsL = lessonFor('words');
assert(wordsL.included.length === 0 && wordsL.text.length > 0, 'words mode: text but no target');
assert(
  /^[a-z ]+$/.test(wordsL.text),
  `words text is lowercase words ("${wordsL.text.slice(0, 28)}")`,
);
const numL = lessonFor('numbers', { numberGroupSize: 3, numberGroupCount: 5 });
assert(/^[0-9 ]+$/.test(numL.text), `numbers mode is digit groups ("${numL.text}")`);
const groups = numL.text.split(' ');
assert(groups.length === 5 && groups.every((g) => g.length === 3), 'numbers: 5 groups of 3 digits');
const SRC = new Set('alpha beta gamma delta epsilon zeta theta'.split(' '));
const custL = lessonFor('custom', { customText: 'alpha beta gamma delta epsilon zeta theta' });
assert(
  custL.included.length === 0 && custL.text.split(' ').every((w) => SRC.has(w)),
  'custom mode draws only from the pasted text',
);
assert(
  /[A-Z]/.test(lessonFor('words', { capitalsPct: 100 }).text),
  'capitals modifier capitalises words',
);
assert(
  /[.,?!;:]/.test(lessonFor('words', { punctuationPct: 100 }).text),
  'punctuation modifier adds punctuation',
);

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
