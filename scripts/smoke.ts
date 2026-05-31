// Headless smoke test of the adaptive core. Run: npx tsx scripts/smoke.ts
import { PhoneticModel } from '../src/core/phonetic';
import { GuidedLesson } from '../src/core/guided';
import { KeyStatsMap } from '../src/core/keyStats';
import { TextInput } from '../src/core/textInput';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { WORDS } from '../src/core/words';
import { speedToTime } from '../src/core/target';

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
const settings = { ...DEFAULT_SETTINGS };
const rng = () => 0.42; // deterministic

console.log('1) initial lesson');
const plan = guided.plan(stats, settings, rng);
assert(plan.included.length === 6, `start with 6 letters (got ${plan.included.length})`);
const letters = plan.included.map((cp) => String.fromCodePoint(cp)).join('');
assert(letters === 'etaoin', `first 6 are "etaoin" (got "${letters}")`);
const allowed = new Set(plan.included);
const onlyAllowed = Array.from(plan.text).every((ch) => ch === ' ' || allowed.has(ch.codePointAt(0)!));
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
assert(offGate.length === 6 && onGate.length === 6, 'below target on all keys -> no unlock either way');

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
assert(res.speed > 0, `speed computed (${Math.round(res.speed)} cpm / ${Math.round(res.speed / 5)} wpm)`);

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

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED ✅' : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
