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
import { analyze, isDatable } from '../src/core/analytics';
import type { LessonResult } from '../src/core/types';

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

console.log('6) typrlab improvement: accuracy-aware unlocking');
const sloppy = new KeyStatsMap();
for (let i = 0; i < 3; i++) {
  for (const cp of plan.included) {
    // fast (2x target) but only 50% accurate
    sloppy.ingest({ codePoint: cp, hitCount: 5, missCount: 5, timeToType: fast });
  }
}
const incAware = guided.computeIncluded(sloppy, { ...settings, accuracyAware: true });
const incBlind = guided.computeIncluded(sloppy, { ...settings, accuracyAware: false });
assert(incAware.length === 6, 'fast-but-sloppy keys do NOT unlock when accuracy-aware (typrlab)');
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
// Out-of-enum policy (loadSettings spreads unvalidated JSON) must fall back, not crash.
const bogusOrder = 'bogus' as KeyOrder;
assert(
  seqOf(bogusOrder) === 'etaoinshrdlcumwfgypbvkjxqz',
  'unknown keyOrder falls back to the frequency order',
);
let orderThrew = false;
let bogusIncluded = 0;
try {
  bogusIncluded = guided.plan(new KeyStatsMap(), { ...settings, keyOrder: bogusOrder }, rng)
    .included.length;
} catch {
  orderThrew = true;
}
assert(
  !orderThrew && bogusIncluded >= 6,
  `guided.plan tolerates an unknown keyOrder (no throw, ${bogusIncluded} letters)`,
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
assert(
  lessonFor('custom', { customText: '' }).text ===
    'paste your own text in settings to practice it here',
  'custom mode with empty text shows the placeholder',
);
assert(
  lessonFor('custom', { customText: 'hello' }).text === 'hello',
  'custom mode with a single word returns just that word',
);
const clampGroups = lessonFor('numbers', { numberGroupSize: 99, numberGroupCount: 99 }).text.split(
  ' ',
);
assert(
  clampGroups.length === 12 && clampGroups.every((g) => g.length === 8),
  `numbers clamps to 12 groups of 8 digits at the max (got ${clampGroups.length}×${clampGroups[0]?.length})`,
);
assert(
  /[A-Z]/.test(lessonFor('adaptive', { capitalsPct: 100 }).text),
  'capitals modifier also applies to the adaptive stream',
);
const constRngWords = nextLesson({
  guided,
  stats: new KeyStatsMap(),
  bigrams: new BigramStatsMap(),
  settings: { ...settings, contentMode: 'words' as ContentMode },
  rng: () => 0, // pathological: always picks the same word — must still terminate
});
assert(constRngWords.text.length > 0, 'words mode terminates with a constant rng (bounded retry)');

console.log('15) capitalized practice credits the lowercase base key (case-fold)');
const tiCap = new TextInput('aEe', { stopOnError: true });
let tcap = 1000;
for (const ch of 'aee') {
  tiCap.onInput(ch, tcap); // input matched case-insensitively; expected 'E' folds to 'e'
  tcap += 120;
}
const resCap = tiCap.result(tcap, 'en');
assert(
  resCap.histogram.every((h) => h.codePoint !== 'E'.codePointAt(0)!),
  'no phantom uppercase-E key recorded',
);
assert(
  resCap.histogram.some((h) => h.codePoint === 'e'.codePointAt(0)!),
  'uppercase E folds into the lowercase e key',
);

console.log('16) analytics aggregates on a seeded history');
{
  const DAY = 86_400_000;
  const NOW = Date.UTC(2026, 0, 20, 12, 0, 0); // fixed noon → stable local days
  const cp = (c: string) => c.codePointAt(0)!;
  // Fixed per-lesson histogram/bigrams so EMA converges deterministically.
  const HIST = [
    { codePoint: cp('e'), hitCount: 8, missCount: 0, timeToType: 150 }, // fast
    { codePoint: cp('q'), hitCount: 6, missCount: 4, timeToType: 400 }, // slow + sloppy
    { codePoint: cp('z'), hitCount: 8, missCount: 0, timeToType: 450 }, // slowest
  ];
  const BG = [
    { from: cp('t'), to: cp('h'), hitCount: 5, timeToType: 350 }, // slow transition
    { from: cp('i'), to: cp('n'), hitCount: 5, timeToType: 150 }, // fast transition
  ];
  const aStats = new KeyStatsMap();
  const aBigrams = new BigramStatsMap();
  const real: LessonResult[] = [];
  for (let i = 0; i < 12; i++) {
    const speed = 200 + (220 * i) / 11; // CPM 200→420  (wpm 40→84)
    const accuracy = 0.9 + (0.09 * i) / 11; // 0.90→0.99
    const r: LessonResult = {
      timeStamp: NOW - (11 - i) * DAY, // 12 consecutive days, ending today
      layout: 'en',
      length: 24,
      time: 60_000, // 1 min each
      errors: 1,
      speed,
      accuracy,
      complexity: 3,
      score: 1,
      histogram: HIST,
      bigrams: BG,
    };
    aStats.ingestResult(r);
    aBigrams.ingestResult(r);
    real.push(r);
  }
  // One legacy result with a page-relative (non-wall-clock) timeStamp.
  const legacy: LessonResult = {
    timeStamp: 50_000,
    layout: 'en',
    length: 24,
    time: 30_000,
    errors: 0,
    speed: 100,
    accuracy: 0.95,
    complexity: 3,
    score: 1,
    histogram: [],
  };
  const history = [legacy, ...real];

  const a = analyze({
    history,
    stats: aStats,
    bigrams: aBigrams,
    targetSpeed: 300,
    included: new Set('etaoinshrd'.split('').map(cp)),
    dailyGoalMinutes: 1,
    now: NOW,
  });

  assert(Math.round(a.scorecards.bestWpm) === 84, `bestWpm is 84 (got ${a.scorecards.bestWpm})`);
  assert(
    a.scorecards.lettersUnlocked === 10,
    `lettersUnlocked counts a–z in included (got ${a.scorecards.lettersUnlocked})`,
  );
  assert(
    a.scorecards.avgDeltaPct === null,
    'avg delta is null below a full 20-lesson window (13 lessons here)',
  );
  const last = a.speed[a.speed.length - 1]!;
  assert(
    Math.abs(last.net - last.raw * 0.99) < 0.01,
    'net wpm = raw × accuracy for the last lesson',
  );
  assert(a.speed.length === history.length, 'one speed point per lesson');
  assert(
    a.slowestKeys[0]?.ch === 'z' && a.slowestKeys[1]?.ch === 'q',
    `slowest keys ordered z, q (got ${a.slowestKeys.map((s) => s.ch).join(',')})`,
  );
  assert(a.slowestKeys[0]!.deltaMs > 0, 'slowest key is slower than target (deltaMs > 0)');
  assert(
    a.lowestAccuracyKeys[0]?.ch === 'q',
    `lowest-accuracy key is q (got ${a.lowestAccuracyKeys[0]?.ch})`,
  );
  assert(
    a.slowestBigrams[0]?.from === 't' && a.slowestBigrams[0]?.to === 'h',
    `slowest transition is t→h (got ${a.slowestBigrams[0]?.from}→${a.slowestBigrams[0]?.to})`,
  );
  assert(
    a.keyboard.locked.has(cp('b')) && !a.keyboard.locked.has(cp('e')),
    'unlearned letters render locked, unlocked ones do not',
  );
  assert(
    isDatable(real[0]!) && !isDatable(legacy),
    'wall-clock guard: real datable, legacy excluded',
  );
  assert(
    a.calendar.activeDays === 12 &&
      a.calendar.goalMetDays === 12 &&
      a.calendar.currentStreak === 12 &&
      a.calendar.bestStreak === 12,
    `calendar: 12 active + goal-met days, streak 12 (got active=${a.calendar.activeDays}, met=${a.calendar.goalMetDays}, streak=${a.calendar.currentStreak})`,
  );
  assert(
    Math.round(a.calendar.totalMinutes) === 12,
    `calendar totals datable minutes only (got ${a.calendar.totalMinutes})`,
  );
  // Per-key progress: only unlocked keys with data (e ∈ included; q/z are not), real trend.
  assert(
    a.perKeyProgress.length === 1 &&
      a.perKeyProgress[0]?.ch === 'e' &&
      a.perKeyProgress[0]?.currentWpm === 80 &&
      a.perKeyProgress[0]?.trend.length === 12,
    `per-key progress: unlocked-with-data only, real current wpm + trend (got ${a.perKeyProgress.map((p) => p.ch).join(',')})`,
  );
}

console.log('17) analytics edge cases — deltas, streaks, goal threshold, per-key progress, empty');
{
  const DAY = 86_400_000;
  const NOW = Date.UTC(2026, 0, 20, 12, 0, 0);
  const inc = new Set('etaoin'.split('').map((c) => c.codePointAt(0)!));
  const empties = new KeyStatsMap();
  const ebig = new BigramStatsMap();
  const mk = (ts: number, speed: number, acc: number): LessonResult => ({
    timeStamp: ts,
    layout: 'en',
    length: 24,
    time: 60_000,
    errors: 1,
    speed,
    accuracy: acc,
    complexity: 3,
    score: 1,
    histogram: [],
    bigrams: [],
  });
  const run = (history: LessonResult[]) =>
    analyze({
      history,
      stats: empties,
      bigrams: ebig,
      targetSpeed: 300,
      included: inc,
      dailyGoalMinutes: 1, // 1 min/lesson day meets the goal → goal-met == active here
      now: NOW,
    });

  // (a) short history (<20): deltas are null (no full prior window).
  const sa = run(Array.from({ length: 5 }, (_, i) => mk(NOW - (4 - i) * DAY, 200 + i * 20, 0.95)));
  assert(
    sa.scorecards.avgDeltaPct === null && sa.scorecards.accuracyDeltaPct === null,
    'sub-20 history yields null avg/accuracy deltas',
  );

  // (b) 20 improving lessons: deltas present and positive (incl. accuracy delta).
  const la = run(
    Array.from({ length: 20 }, (_, i) => mk(NOW - (19 - i) * DAY, 200 + i * 8, 0.9 + i * 0.004)),
  );
  assert(
    (la.scorecards.avgDeltaPct ?? 0) > 0 && (la.scorecards.accuracyDeltaPct ?? 0) > 0,
    '20+ improving lessons → positive avg & accuracy deltas',
  );

  // (c) streak gap: bestStreak (run of 5) > currentStreak (tail of 3).
  const ga = run([0, 1, 2, 6, 7, 8, 9, 10].map((off) => mk(NOW - off * DAY, 250, 0.95)));
  assert(
    ga.calendar.currentStreak === 3,
    `current streak = unbroken tail (got ${ga.calendar.currentStreak})`,
  );
  assert(
    ga.calendar.bestStreak === 5 && ga.calendar.bestStreak > ga.calendar.currentStreak,
    `best streak exceeds current across a gap (got best=${ga.calendar.bestStreak})`,
  );

  // (d) grace: today empty but yesterday active → streak stays alive.
  const gra = run([1, 2, 3].map((off) => mk(NOW - off * DAY, 250, 0.95)));
  assert(
    gra.calendar.currentStreak === 3,
    `grace keeps the streak alive (got ${gra.calendar.currentStreak})`,
  );

  // (e) empty history: safe, zeroed.
  let threw = false;
  let ea: ReturnType<typeof run> | null = null;
  try {
    ea = run([]);
  } catch {
    threw = true;
  }
  assert(
    !threw && ea!.scorecards.bestWpm === 0 && ea!.calendar.activeDays === 0,
    'empty history: no throw, zeroed aggregates',
  );

  // (g) goal threshold: only days whose minutes meet the daily goal count.
  const gt = analyze({
    history: [
      { ...mk(NOW, 250, 0.95), time: 40 * 60_000 }, // today: 40 min ≥ 30 → met
      { ...mk(NOW - DAY, 250, 0.95), time: 5 * 60_000 }, // yesterday: 5 min < 30 → not
    ],
    stats: empties,
    bigrams: ebig,
    targetSpeed: 300,
    included: inc,
    now: NOW,
    dailyGoalMinutes: 30,
  });
  assert(
    gt.calendar.activeDays === 2 &&
      gt.calendar.goalMetDays === 1 &&
      gt.calendar.currentStreak === 1,
    `goal threshold: only days ≥ goal count (active=${gt.calendar.activeDays}, met=${gt.calendar.goalMetDays}, streak=${gt.calendar.currentStreak})`,
  );

  // (h) per-key progress: real per-session trend, weakest-first, positive gain on an improving key.
  const pkStats = new KeyStatsMap();
  const pkHist: LessonResult[] = [];
  for (let i = 0; i < 6; i++) {
    const r: LessonResult = {
      ...mk(NOW - (5 - i) * DAY, 250, 0.97),
      histogram: [
        { codePoint: 'a'.codePointAt(0)!, hitCount: 8, missCount: 0, timeToType: 300 - i * 25 }, // a improves 300→175ms
        { codePoint: 'e'.codePointAt(0)!, hitCount: 8, missCount: 0, timeToType: 400 }, // e steady slow
      ],
    };
    pkStats.ingestResult(r);
    pkHist.push(r);
  }
  const pk = analyze({
    history: pkHist,
    stats: pkStats,
    bigrams: ebig,
    targetSpeed: 300,
    included: inc,
    now: NOW,
    dailyGoalMinutes: 1,
  }).perKeyProgress;
  assert(
    pk.length === 2 && pk[0]?.ch === 'e',
    `per-key progress weakest-first (got ${pk.map((p) => p.ch).join(',')})`,
  );
  const aProg = pk.find((p) => p.ch === 'a');
  assert(
    !!aProg && aProg.trend.length === 6 && aProg.gainWpm > 0,
    `improving key: 6-session trend + positive gain (gain=${aProg?.gainWpm})`,
  );
}

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
