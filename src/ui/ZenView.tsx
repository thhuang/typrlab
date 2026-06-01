// Zen focus mode — a calm, chrome-free full-screen take on the practice view.
// Same engine and flow (continuous lessons, drilling), but no rail, keyboard, or
// nav: just an eyebrow telling you what's being drilled, the naked text line, a
// thin progress rule, three minimal gauges, and the daily-goal bar. Toggled from
// the practice view; Esc or "exit focus" returns to the Coach layout.
import { useEffect, useRef } from 'react';
import type { LessonPlan } from '@/core/guided';
import type { Settings } from '@/core/settings';
import type { LessonResult } from '@/core/types';
import { TypingBoard } from '@/ui/TypingBoard';

interface Props {
  plan: LessonPlan;
  position: number;
  hasError: boolean;
  settings: Settings;
  history: LessonResult[];
  onExit: () => void;
}

const wpm = (cpm: number) => Math.round(cpm / 5);
const chr = (cp: number) => String.fromCodePoint(cp);

export function ZenView({ plan, position, hasError, settings, history, onExit }: Props) {
  // Move focus into the focus screen on enter, so keyboard/AT users have an
  // anchor and the view change is announced (TyprlabApp restores focus on exit).
  const centerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    centerRef.current?.focus();
  }, []);

  // Only the adaptive stream has a drill target; words/numbers/custom are ungated,
  // so the eyebrow names the mode instead of claiming "guided · drilling —".
  const adaptive = settings.contentMode === 'adaptive';
  const bf = plan.bigramFocus;
  const drill = bf ? `${chr(bf[0])}→${chr(bf[1])}` : plan.focus != null ? chr(plan.focus) : '—';

  const total = Array.from(plan.text).length;
  const progress = total > 0 ? Math.min(100, Math.round((position / total) * 100)) : 0;

  // Gauges read the last two completed (valid) lessons for value + delta.
  const cur = history.length ? history[history.length - 1]! : null;
  const prev = history.length >= 2 ? history[history.length - 2]! : null;
  const speedDelta = cur && prev ? wpm(cur.speed) - wpm(prev.speed) : null;
  const accDelta =
    cur && prev ? Math.round(cur.accuracy * 100) - Math.round(prev.accuracy * 100) : null;
  const scoreDelta = cur && prev ? Math.round(cur.score) - Math.round(prev.score) : null;

  const totalMin = history.reduce((a, r) => a + r.time, 0) / 60000;
  const goalPct =
    settings.dailyGoalMinutes > 0
      ? Math.min(100, Math.round((totalMin / settings.dailyGoalMinutes) * 100))
      : 0;

  return (
    <div className="zen">
      <header className="zen-top">
        <div className="brand">
          typr<span className="caret">_</span>lab
        </div>
        <button type="button" className="zen-exit" onClick={onExit} title="Exit focus (Esc)">
          exit focus
        </button>
      </header>

      <main className="zen-center" aria-label="Zen focus practice" tabIndex={-1} ref={centerRef}>
        <span className="zen-eyebrow">
          {adaptive ? (
            <>
              guided · drilling <b>{drill}</b>
            </>
          ) : (
            settings.contentMode
          )}
        </span>

        <TypingBoard
          bare
          text={plan.text}
          position={position}
          hasError={hasError}
          cursorStyle={settings.cursorStyle}
        />

        <div className="zen-progress" aria-hidden="true">
          <div className="zen-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="zen-gauges">
          <Gauge
            value={cur ? `${wpm(cur.speed)}` : '—'}
            label="wpm"
            cls="accent"
            delta={speedDelta}
          />
          <Gauge
            value={cur ? `${Math.round(cur.accuracy * 100)}%` : '—'}
            label="accuracy"
            cls="hit"
            delta={accDelta}
          />
          <Gauge value={cur ? `${Math.round(cur.score)}` : '—'} label="score" delta={scoreDelta} />
        </div>
      </main>

      <footer className="zen-bottom">
        <div className="goal">
          <span className="goaltext">today</span>
          <div className="goalbar">
            <div className="goalfill" style={{ width: `${goalPct}%` }} />
          </div>
          <span className="goaltext">
            {Math.round(totalMin)} / {settings.dailyGoalMinutes} min
          </span>
        </div>
      </footer>
    </div>
  );
}

function Gauge({
  value,
  label,
  cls,
  delta,
}: {
  value: string;
  label: string;
  cls?: string;
  delta: number | null;
}) {
  const dir = delta == null || delta === 0 ? null : delta > 0 ? 'up' : 'down';
  return (
    <div className="zen-gauge">
      <span className={`zen-gauge-val${cls ? ` ${cls}` : ''}`}>{value}</span>
      <span className="zen-gauge-label">{label}</span>
      {dir && (
        <span className={`zen-delta ${dir}`}>
          {dir === 'up' ? '▲' : '▼'} {Math.abs(delta!)}
        </span>
      )}
    </div>
  );
}
