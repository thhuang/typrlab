// Compact stats strip: last-lesson gauges plus running aggregates and the
// daily-goal bar. A fuller analysis page (learning curve, heatmaps) comes next.
import type { LessonResult } from '../core/types';
import type { Settings } from '../core/settings';

interface Props {
  last: LessonResult | null;
  history: LessonResult[];
  settings: Settings;
  unlocked: number;
  focus: string | null;
}

const wpm = (cpm: number) => Math.round(cpm / 5);

export function StatsPanel({ last, history, settings, unlocked, focus }: Props) {
  const bestWpm = history.length ? wpm(Math.max(...history.map((r) => r.speed))) : 0;
  const avgWpm = history.length
    ? wpm(history.reduce((a, r) => a + r.speed, 0) / history.length)
    : 0;
  const totalMin = history.reduce((a, r) => a + r.time, 0) / 60000;
  const goalPct =
    settings.dailyGoalMinutes > 0
      ? Math.min(100, Math.round((totalMin / settings.dailyGoalMinutes) * 100))
      : 0;

  return (
    <section className="stats">
      <div className="cards">
        <Stat label="Last" value={last ? `${wpm(last.speed)} wpm` : '—'} />
        <Stat label="Accuracy" value={last ? `${Math.round(last.accuracy * 100)}%` : '—'} />
        <Stat label="Score" value={last ? `${Math.round(last.score)}` : '—'} />
        <Stat label="Best" value={`${bestWpm} wpm`} />
        <Stat label="Average" value={`${avgWpm} wpm`} />
        <Stat label="Letters" value={`${unlocked}/26`} />
        <Stat label="Lessons" value={`${history.length}`} />
        <Stat label="Focus" value={focus ?? '—'} />
      </div>
      <div className="goal">
        <div className="goalbar">
          <div className="goalfill" style={{ width: `${goalPct}%` }} />
        </div>
        <span className="goaltext">
          {Math.round(totalMin)} / {settings.dailyGoalMinutes} min today
        </span>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <span className="card-label">{label}</span>
      <span className="card-value">{value}</span>
    </div>
  );
}
