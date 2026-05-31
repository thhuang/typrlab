// The Analysis view — typr's answer to keybr's /profile, focused on *action*
// rather than a vanity percentile: a learning curve plus a weakest-keys-first
// table with per-key speed, accuracy, confidence, and projected lessons-to-target.
import type { LessonResult } from '../core/types';
import type { Settings } from '../core/settings';
import { KeyStatsMap } from '../core/keyStats';
import { timeToSpeed } from '../core/target';
import { projectLessonsToTarget } from '../core/learning';
import { LineChart } from './LineChart';

interface Props {
  stats: KeyStatsMap;
  settings: Settings;
  history: LessonResult[];
  onExport: () => void;
  onImportClick: () => void;
}

const wpm = (cpm: number) => Math.round(cpm / 5);

export function Analysis({ stats, settings, history, onExport, onImportClick }: Props) {
  const curve = history.map((r) => r.speed / 5); // WPM per lesson
  const bestWpm = history.length ? Math.max(...history.map((r) => wpm(r.speed))) : 0;
  const avgWpm = history.length
    ? wpm(history.reduce((a, r) => a + r.speed, 0) / history.length)
    : 0;

  const rows = stats
    .allStats()
    .filter((s) => s.timeToType !== null)
    .map((s) => {
      const eff = stats.effectiveConfidence(
        s.codePoint,
        settings.targetSpeed,
        !settings.recoverKeys,
        settings.accuracyAware,
      );
      const speed = s.timeToType ? timeToSpeed(s.timeToType) : 0;
      const proj = projectLessonsToTarget(
        stats.series(s.codePoint).map(timeToSpeed),
        settings.targetSpeed,
      );
      return {
        ch: String.fromCodePoint(s.codePoint),
        wpm: wpm(speed),
        acc: s.accuracy ?? 1,
        eff,
        proj,
      };
    })
    .sort((a, b) => a.eff - b.eff);

  return (
    <section className="analysis">
      <div className="analysis-toolbar">
        <h2>Analysis</h2>
        <span className="muted">
          {history.length} lessons · best {bestWpm} · avg {avgWpm} wpm
        </span>
        <span className="spacer" />
        <button onClick={onImportClick}>Import</button>
        <button onClick={onExport}>Export</button>
      </div>

      <div className="acard">
        <div className="acard-head">
          <span>Learning curve</span>
          <span className="muted">words per minute over lessons</span>
        </div>
        {curve.length > 1 ? (
          <LineChart values={curve} />
        ) : (
          <p className="muted pad">Type a few lessons to see your curve build.</p>
        )}
      </div>

      <div className="acard">
        <div className="acard-head">
          <span>Keys to drill</span>
          <span className="muted">
            weakest first · accuracy-aware {settings.accuracyAware ? 'on' : 'off'}
          </span>
        </div>
        <table className="ktable">
          <thead>
            <tr>
              <th>Key</th>
              <th>Speed</th>
              <th>Accuracy</th>
              <th>Confidence</th>
              <th>Lessons → target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ch} className={r.eff >= 1 ? 'reached' : ''}>
                <td className="kcell">{r.ch}</td>
                <td>{r.wpm} wpm</td>
                <td>{Math.round(r.acc * 100)}%</td>
                <td>{Math.round(Math.min(1, r.eff) * 100)}%</td>
                <td>{r.eff >= 1 ? '✓ reached' : r.proj == null ? '—' : `~${r.proj}`}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted pad">
                  No key data yet — type a lesson.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
