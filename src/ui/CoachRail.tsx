// Coach rail — the adaptive engine made visible. Sits beside the board in the
// practice view and answers "what is typr drilling, and why?": the current
// target (weak transition or key) with a confidence ring, your four weakest
// keys, and how close you are to unlocking the next letter. Purely
// presentational — every value comes from useTypingSession (plan + live stats);
// no engine calls, no new colors (tokens + confidenceColor only).
import type { LessonPlan } from '@/core/guided';
import type { KeyStatsMap } from '@/core/keyStats';
import type { BigramStatsMap } from '@/core/bigramStats';
import type { Settings } from '@/core/settings';
import { confidenceColor } from '@/ui/color';

interface Props {
  plan: LessonPlan;
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  settings: Settings;
}

const pct = (c: number) => Math.max(0, Math.min(100, Math.round(c * 100)));
const chr = (cp: number) => String.fromCodePoint(cp);

export function CoachRail({ plan, stats, bigrams, settings }: Props) {
  const { targetSpeed, recoverKeys } = settings;

  // Match the keyboard heatmap exactly (it sits right beside this rail): speed-only
  // confidence — best-ever, unless recoverKeys gates on live decay.
  const keyConf = (cp: number) =>
    recoverKeys ? stats.confidence(cp, targetSpeed) : stats.bestConfidence(cp, targetSpeed);

  // Ring shows the drilled target's progress "of target" by SPEED, matching the
  // keyboard + the weakest-keys list (so the same key never shows two different
  // %). The single-key focus is chosen by the engine's accuracy-aware gate, so it
  // isn't necessarily the speed-minimum — hence the single-key caption below says
  // "drilling now", not "slowest". A weak transition (bf) is speed-selected, so
  // its caption can honestly say "slowest".
  const bf = plan.bigramFocus;
  const drillConf = bf
    ? bigrams.confidence(bf[0], bf[1], targetSpeed)
    : plan.focus != null
      ? keyConf(plan.focus)
      : 0;
  const ringPct = pct(drillConf);

  // Four weakest active keys, lowest confidence first — only those still below
  // target (< 1), so a key at/above target never shows up in a "weakest" list.
  const weak = plan.included
    .map((cp) => ({ cp, c: keyConf(cp) }))
    .filter((k) => k.c < 1)
    .sort((a, b) => a.c - b.c)
    .slice(0, 4);

  const { remaining, nextKey } = plan.nextUnlock;

  return (
    <aside className="coachrail" aria-label="Coaching">
      <section className="coach-card">
        <h2 className="coach-h">Now drilling</h2>
        <div className="coach-bigram">
          {bf ? (
            <>
              <span className="coach-glyph">{chr(bf[0])}</span>
              <span className="coach-arrow" aria-hidden="true">
                →
              </span>
              <span className="coach-glyph">{chr(bf[1])}</span>
            </>
          ) : (
            <span className="coach-glyph">{plan.focus != null ? chr(plan.focus) : '—'}</span>
          )}
        </div>
        <div
          className="coach-ring"
          style={{
            background: `conic-gradient(var(--accent) 0% ${ringPct}%, var(--line) ${ringPct}% 100%)`,
          }}
        >
          <div className="coach-ring-inner">
            <span className="coach-ring-val">{ringPct}%</span>
            <span className="coach-ring-label">of target</span>
          </div>
        </div>
        <p className="coach-note coach-note-center">
          {bf ? 'Your slowest transition right now.' : 'The key typr is drilling right now.'}
        </p>
      </section>

      <section className="coach-card">
        <h2 className="coach-h">Weakest keys</h2>
        {weak.length > 0 ? (
          <div className="coach-weak">
            {weak.map(({ cp, c }) => (
              <div className="coach-weakrow" key={cp}>
                <span className="coach-key">{chr(cp)}</span>
                <div className="coach-track">
                  <div
                    className="coach-fill"
                    style={{ width: `${pct(c)}%`, background: confidenceColor(c) }}
                  />
                </div>
                <span className="coach-val">{pct(c)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="coach-note">All active keys at target — keep going.</p>
        )}
      </section>

      <section className="coach-card">
        <h2 className="coach-h">Next unlock</h2>
        {nextKey != null ? (
          // `remaining` is >= 1 whenever a next letter exists: the gate grows the
          // active set the moment every key reaches target, and the freshly
          // unlocked key starts unsampled (confidence 0), so it always counts here.
          <p className="coach-note">
            <b>
              {remaining} {remaining === 1 ? 'key' : 'keys'}
            </b>{' '}
            from unlocking <b className="coach-mono">{chr(nextKey)}</b>. Get every active key to
            target speed.
          </p>
        ) : (
          <p className="coach-note">All letters unlocked. Keep every key above target speed.</p>
        )}
      </section>
    </aside>
  );
}
