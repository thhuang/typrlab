// The Analysis view — typr's answer to keybr's /profile, focused on *action*
// rather than a vanity percentile: a learning curve plus a weakest-keys-first
// table with per-key speed, accuracy, confidence, and projected lessons-to-target.
import type { LessonResult } from '../core/types';
import type { Settings } from '../core/settings';
import { KeyStatsMap } from '../core/keyStats';
import { BigramStatsMap } from '../core/bigramStats';
import { timeToSpeed } from '../core/target';
import { projectLessonsToTarget } from '../core/learning';
import { LineChart } from './LineChart';
import { HeatmapChart, type HeatRow } from './HeatmapChart';
import { BarChart, type Bar } from './BarChart';
import { KeyboardHeatmap } from './KeyboardHeatmap';
import { confidenceColor } from './color';

const FREQ_ORDER = 'etaoinshrdlcumwfgypbvkjxqz';
const HEATMAP_MAX_COLS = 60;

interface Props {
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  settings: Settings;
  history: LessonResult[];
  onExport: () => void;
  onImportClick: () => void;
}

const SPACE_CP = 0x20;

const wpm = (cpm: number) => Math.round(cpm / 5);

export function Analysis({ stats, bigrams, settings, history, onExport, onImportClick }: Props) {
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

  const bigramRows = bigrams
    .all()
    .filter((b) => b.timeToType !== null && b.from !== SPACE_CP && b.to !== SPACE_CP)
    .map((b) => ({
      label: `${String.fromCodePoint(b.from)}→${String.fromCodePoint(b.to)}`,
      wpm: wpm(b.timeToType ? timeToSpeed(b.timeToType) : 0),
      conf: bigrams.confidence(b.from, b.to, settings.targetSpeed),
      samples: b.samples,
    }))
    .sort((a, b) => a.conf - b.conf)
    .slice(0, 8);

  // Per-key learning heatmap: replay history, snapshotting each key's live
  // confidence after every lesson.
  const replay = new KeyStatsMap();
  const columns: Array<Map<number, number>> = [];
  for (const r of history) {
    replay.ingestResult(r);
    const snap = new Map<number, number>();
    for (const ch of FREQ_ORDER) {
      const cp = ch.codePointAt(0)!;
      const st = replay.get(cp);
      if (st && st.timeToType !== null) snap.set(cp, replay.confidence(cp, settings.targetSpeed));
    }
    columns.push(snap);
  }
  const shownColumns = columns.slice(Math.max(0, columns.length - HEATMAP_MAX_COLS));
  const heatRows: HeatRow[] = Array.from(FREQ_ORDER)
    .map((ch) => ch.codePointAt(0)!)
    .filter((cp) => replay.get(cp)?.timeToType != null)
    .map((cp) => ({
      label: String.fromCodePoint(cp),
      cells: shownColumns.map((col) => col.get(cp) ?? null),
    }));

  // Per-key speed histogram (slowest first), bars tinted by confidence.
  const speedBars: Bar[] = stats
    .allStats()
    .filter((s) => s.timeToType !== null)
    .map((s) => {
      const conf = stats.effectiveConfidence(
        s.codePoint,
        settings.targetSpeed,
        !settings.recoverKeys,
        settings.accuracyAware,
      );
      return {
        label: String.fromCodePoint(s.codePoint),
        value: wpm(s.timeToType ? timeToSpeed(s.timeToType) : 0),
        color: confidenceColor(Math.min(1, conf)),
      };
    })
    .sort((a, b) => a.value - b.value);

  // Per-key accuracy, for the keyboard heatmap.
  const accValues = new Map<number, number>();
  for (const s of stats.allStats()) if (s.accuracy !== null) accValues.set(s.codePoint, s.accuracy);

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
          <span>Learning progress</span>
          <span className="muted">per-key confidence over lessons · red → green</span>
        </div>
        {heatRows.length > 0 ? (
          <HeatmapChart rows={heatRows} />
        ) : (
          <p className="muted pad">Type a few lessons to see your progress map.</p>
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

      <div className="acard">
        <div className="acard-head">
          <span>Key speed</span>
          <span className="muted">average words per minute per key · slowest first</span>
        </div>
        {speedBars.length > 0 ? (
          <BarChart bars={speedBars} unit="wpm" />
        ) : (
          <p className="muted pad">No key data yet — type a lesson.</p>
        )}
      </div>

      <div className="acard">
        <div className="acard-head">
          <span>Transitions to drill</span>
          <span className="muted">slowest digraphs — the transitions costing you the most</span>
        </div>
        <table className="ktable">
          <thead>
            <tr>
              <th>Transition</th>
              <th>Speed</th>
              <th>Confidence</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {bigramRows.map((r) => (
              <tr key={r.label} className={r.conf >= 1 ? 'reached' : ''}>
                <td className="kcell">{r.label}</td>
                <td>{r.wpm} wpm</td>
                <td>{Math.round(Math.min(1, r.conf) * 100)}%</td>
                <td>{r.samples}</td>
              </tr>
            ))}
            {bigramRows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted pad">
                  No transition data yet — type a few lessons.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="acard">
        <div className="acard-head">
          <span>Accuracy by key</span>
          <span className="muted">how cleanly you hit each key · red → green</span>
        </div>
        {accValues.size > 0 ? (
          <div className="kb-heatmap-wrap">
            <KeyboardHeatmap values={accValues} />
          </div>
        ) : (
          <p className="muted pad">No accuracy data yet — type a lesson.</p>
        )}
      </div>
    </section>
  );
}
