// The Analysis view — a progress dashboard answering: Am I improving? (speed +
// per-key trends), What's still slow? (heatmap + slow-key/transition tables), and
// Have I been consistent? (practice calendar with a daily goal). All figures come
// from useTypingSession via the pure src/core/analytics module.
import type { ReactNode } from 'react';
import type { LessonResult } from '../core/types';
import { type Settings, DAILY_GOALS } from '../core/settings';
import type { AdaptiveProgress } from '../core/guided';
import { KeyStatsMap } from '../core/keyStats';
import { BigramStatsMap } from '../core/bigramStats';
import { analyze, type KeyProgress } from '../core/analytics';
import { confidenceColor } from './color';
import { LineChart } from './LineChart';
import { KeyboardHeatmap } from './KeyboardHeatmap';

interface Props {
  stats: KeyStatsMap;
  bigrams: BigramStatsMap;
  settings: Settings;
  history: LessonResult[];
  progress: AdaptiveProgress | null;
  update: (patch: Partial<Settings>) => void;
  onExport: () => void;
  onImportClick: () => void;
}

const chr = (cp: number) => String.fromCodePoint(cp);
const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
// Calendar intensity — mixed in sRGB (mixing in OKLCH detours through pink).
const calColor = (level: number) =>
  level === 0
    ? 'var(--panel-2)'
    : `color-mix(in srgb, var(--accent) ${[0, 30, 62, 100][level]}%, var(--panel-2))`;
const calLevel = (min: number) => (min <= 0 ? 0 : min < 8 ? 1 : min < 20 ? 2 : 3);

export function Analysis({
  stats,
  bigrams,
  settings,
  history,
  progress,
  update,
  onExport,
  onImportClick,
}: Props) {
  // The unlocked set comes from `progress` (derived from stats), NOT the current
  // lesson plan — otherwise every per-key panel goes blank in non-adaptive modes,
  // whose lesson plan carries an empty `included`.
  const included = new Set(progress?.included ?? []);
  const a = analyze({
    history,
    stats,
    bigrams,
    targetSpeed: settings.targetSpeed,
    included,
    dailyGoalMinutes: settings.dailyGoalMinutes,
  });

  const head = (
    <div className="pagehead">
      <div>
        <h2 className="dash-title">Your progress</h2>
        <p>
          Where you&rsquo;ve improved, what&rsquo;s still slow, and how consistent you&rsquo;ve
          been.
        </p>
      </div>
      <div className="dash-actions">
        <button type="button" onClick={onImportClick}>
          Import
        </button>
        <button type="button" onClick={onExport}>
          Export
        </button>
      </div>
    </div>
  );

  if (history.length === 0) {
    return (
      <section className="dash">
        {head}
        <div className="panel">
          <p className="note">Type a few lessons to build your progress dashboard.</p>
        </div>
      </section>
    );
  }

  const sc = a.scorecards;
  const cal = a.calendar;
  const next = progress?.nextUnlock;
  const lettersSub =
    next && next.nextKey != null
      ? `${next.remaining} to unlock ${chr(next.nextKey)}`
      : 'all letters unlocked';

  const goalWpm = a.goalWpm;
  const lastIdx = a.speed.length - 1;
  const xLabels: Array<[number, string]> =
    lastIdx >= 2
      ? [
          [0, `${a.speed.length} ago`],
          [Math.floor(lastIdx / 2), `${Math.ceil(a.speed.length / 2)} ago`],
          [lastIdx, 'now'],
        ]
      : [];
  const weakest3 = a.perKeyProgress.slice(0, 3).map((k) => k.ch);
  // ~18 markers regardless of history length (avoids a dot per lesson on long histories).
  const markerEvery = Math.max(1, Math.round(a.speed.length / 18));

  return (
    <section className="dash">
      {head}

      {/* Scorecards */}
      <section className="kpis">
        <Kpi label="Best speed" value={Math.round(sc.bestWpm)} unit="wpm" sub="all-time" hero>
          <Sparkline values={sc.sparkline} />
        </Kpi>
        <Kpi
          label="Avg (last 10)"
          value={Math.round(sc.avgLast10)}
          unit="wpm"
          sub={fmtDelta(sc.avgDeltaPct)}
          dir={dirOf(sc.avgDeltaPct)}
        />
        <Kpi
          label="Accuracy"
          value={(sc.recentAccuracy * 100).toFixed(1)}
          unit="%"
          sub={fmtDelta(sc.accuracyDeltaPct)}
          dir={dirOf(sc.accuracyDeltaPct)}
        />
        <Kpi
          label="Time invested"
          value={sc.totalHours.toFixed(1)}
          unit="h"
          sub={`${sc.lessonCount} lessons`}
        />
        <Kpi
          label="Day streak"
          value={cal.currentStreak}
          unit={cal.currentStreak === 1 ? 'day' : 'days'}
          sub={`best ${cal.bestStreak}`}
        />
        <Kpi label="Letters" value={sc.lettersUnlocked} unit="/26" sub={lettersSub} />
      </section>

      {/* Speed over time */}
      <section className="panel">
        <div className="ph">
          <h3>Typing speed over time</h3>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--accent)' }} />
              net wpm
            </span>
            <span>
              <i style={{ background: 'var(--muted)' }} />
              raw wpm
            </span>
            <span>
              <i style={{ background: 'var(--hit)' }} />
              goal {Math.round(goalWpm)}
            </span>
          </div>
        </div>
        <LineChart
          height={240}
          goal={goalWpm}
          markerEvery={markerEvery}
          xLabels={xLabels}
          unit="wpm"
          series={[
            { values: a.speed.map((p) => p.raw), color: 'var(--muted)', width: 1.8, opacity: 0.55 },
            {
              values: a.speed.map((p) => p.net),
              color: 'var(--accent)',
              fill: true,
              markers: true,
            },
          ]}
        />
      </section>

      {/* Per-key progress — small multiples */}
      <section className="panel">
        <div className="ph">
          <h3>Per-key progress</h3>
          <span className="sub">each key&rsquo;s speed trend · weakest first</span>
        </div>
        {a.perKeyProgress.length > 0 ? (
          <>
            <div className="kprog-grid">
              {a.perKeyProgress.map((k) => (
                <KeyProgressCard key={k.cp} k={k} />
              ))}
            </div>
            <p className="note keyprognote">
              Each card is one unlocked key&rsquo;s speed trend across sessions, weakest first.{' '}
              {weakest3.length > 0 && (
                <>
                  <b className="bg">{weakest3.join(' · ')}</b> are furthest from target — drill
                  these next.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="note">Type a few lessons to see per-key trends.</p>
        )}
      </section>

      {/* Accuracy over time */}
      <section className="panel">
        <div className="ph">
          <h3>Accuracy over time</h3>
          <span className="sub">avg {(sc.recentAccuracy * 100).toFixed(1)}% · last 10</span>
        </div>
        <LineChart
          height={180}
          min={Math.min(90, Math.floor(Math.min(...a.accuracy)))}
          max={100}
          unit="%"
          markerEvery={markerEvery}
          series={[{ values: a.accuracy, color: 'var(--hit)', fill: true, markers: true }]}
        />
      </section>

      {/* Per-key speed heatmap + slowest transitions */}
      <section className="grid-keys">
        <div className="panel">
          <div className="ph">
            <h3>Per-key speed</h3>
            <div className="legend">
              <span>
                <i style={{ background: 'var(--slow-key-color)' }} />
                slow
              </span>
              <span>
                <i style={{ background: 'var(--fast-key-color)' }} />
                fast
              </span>
              <span>
                <i style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }} />
                locked
              </span>
            </div>
          </div>
          <KeyboardHeatmap
            values={a.keyboard.confidence}
            mini={a.keyboard.perKeyWpm}
            locked={a.keyboard.locked}
          />
          <p className="note kbnote">
            {a.keyboard.weakest.length
              ? `Weakest keys: ${a.keyboard.weakest.join(' · ')} — these gate your next unlock.`
              : 'All active keys are at target — keep going.'}
          </p>
        </div>
        <div className="panel">
          <div className="ph">
            <h3>Slowest transitions</h3>
            <span className="sub">bigrams to drill</span>
          </div>
          <table className="dtable">
            <thead>
              <tr>
                <th>Transition</th>
                <th>Mastery</th>
                <th className="tdr">wpm</th>
              </tr>
            </thead>
            <tbody>
              {a.slowestBigrams.map((b) => (
                <tr key={`${b.from}${b.to}`}>
                  <td>
                    <span className="kc">{b.from}</span> <span className="bg">→</span>{' '}
                    <span className="kc">{b.to}</span>
                  </td>
                  <td>
                    <MiniTrack value={Math.min(1, b.confidence)} />
                  </td>
                  <td className="tdr">{Math.round(b.wpm)}</td>
                </tr>
              ))}
              {a.slowestBigrams.length === 0 && (
                <tr>
                  <td colSpan={3} className="note">
                    No transition data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Slowest keys + accuracy by key */}
      <section className="grid2">
        <div className="panel">
          <div className="ph">
            <h3>Slowest keys</h3>
            <span className="sub">avg ms / keystroke</span>
          </div>
          <table className="dtable">
            <thead>
              <tr>
                <th>Key</th>
                <th>Avg</th>
                <th className="tdr">vs target</th>
              </tr>
            </thead>
            <tbody>
              {a.slowestKeys.map((k) => (
                <tr key={k.ch}>
                  <td>
                    <span className="kc">{k.ch}</span>
                  </td>
                  <td>{k.ms} ms</td>
                  <td className="tdr">{k.deltaMs > 0 ? `+${k.deltaMs}` : k.deltaMs} ms</td>
                </tr>
              ))}
              {a.slowestKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="note">
                    No key data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="ph">
            <h3>Accuracy by key</h3>
            <span className="sub">lowest 5 · % correct</span>
          </div>
          <table className="dtable">
            <thead>
              <tr>
                <th>Key</th>
                <th>Accuracy</th>
                <th className="tdr">%</th>
              </tr>
            </thead>
            <tbody>
              {a.lowestAccuracyKeys.map((k) => {
                const p = pct(k.accuracy * 100);
                return (
                  <tr key={k.ch}>
                    <td>
                      <span className="kc">{k.ch}</span>
                    </td>
                    <td>
                      <MiniTrack
                        value={k.accuracy}
                        color={p < 90 ? 'var(--miss)' : 'var(--accent)'}
                      />
                    </td>
                    <td className="tdr">{p}%</td>
                  </tr>
                );
              })}
              {a.lowestAccuracyKeys.length === 0 && (
                <tr>
                  <td colSpan={3} className="note">
                    No accuracy data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Practice calendar + daily goal */}
      <section className="panel">
        <div className="ph">
          <h3>Practice activity</h3>
          <div className="calhead">
            <GoalControl
              value={settings.dailyGoalMinutes}
              onChange={(g) => update({ dailyGoalMinutes: g })}
            />
            <div className="callegend">
              Less
              {[0, 1, 2, 3].map((l) => (
                <span key={l} className="cell" style={{ background: calColor(l) }} />
              ))}
              More
            </div>
          </div>
        </div>
        <Calendar dayMinutes={cal.dayMinutes} goalMinutes={cal.dailyGoalMinutes} />
        <p className="note calnote">
          <b>{cal.activeDays} active days</b> · <b className="bg">{cal.goalMetDays}</b> hit your{' '}
          {cal.dailyGoalMinutes}-min goal · current streak{' '}
          <b className="bg">
            {cal.currentStreak} {cal.currentStreak === 1 ? 'day' : 'days'}
          </b>
        </p>
      </section>
    </section>
  );
}

// ---- small presentational helpers ----

type Dir = 'up' | 'down' | 'flat';
const dirOf = (pctDelta: number | null): Dir =>
  pctDelta == null || Math.abs(pctDelta) < 0.05 ? 'flat' : pctDelta > 0 ? 'up' : 'down';
const fmtDelta = (pctDelta: number | null): string =>
  pctDelta == null ? '—' : `${pctDelta >= 0 ? '+' : ''}${pctDelta.toFixed(1)}%`;

function Kpi({
  label,
  value,
  unit,
  sub,
  dir = 'flat',
  hero = false,
  children,
}: {
  label: string;
  value: string | number;
  unit: string;
  sub: string;
  dir?: Dir;
  hero?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`kpi${hero ? ' hero' : ''}`}>
      <span className="kl">{label}</span>
      <span className="kv">
        {value}
        <span className="u">{unit}</span>
      </span>
      <span className={`kd ${dir}`}>
        {dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''} {sub}
      </span>
      {children}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 70;
  const h = 34;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const pts = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - mn) / (mx - mn || 1)) * h).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}

function MiniTrack({ value, color }: { value: number; color?: string }) {
  return (
    <div className="minitrack">
      <div
        className="minifill"
        style={{
          width: `${pct(value * 100)}%`,
          background:
            color ??
            `color-mix(in oklch, var(--fast-key-color) ${pct(value * 100)}%, var(--slow-key-color))`,
        }}
      />
    </div>
  );
}

// ---- per-key progress card ----

function KeyProgressCard({ k }: { k: KeyProgress }) {
  const tint = confidenceColor(Math.min(1, k.confidence));
  return (
    <div className="kprog">
      <div className="ktop">
        <span className="kcap" style={{ background: tint }}>
          {k.ch}
        </span>
        <span className="kfig">
          <span className="kwpm">
            {k.currentWpm}
            <span className="uu">wpm</span>
          </span>
          <span className={`kdelta ${k.gainWpm > 0 ? 'up' : k.gainWpm < 0 ? 'down' : 'flat'}`}>
            {k.gainWpm > 0 ? `▲ ${k.gainWpm}` : k.gainWpm < 0 ? `▼ ${Math.abs(k.gainWpm)}` : '—'}
          </span>
        </span>
      </div>
      <KeySpark values={k.trend} color={tint} />
    </div>
  );
}

// Tiny area sparkline for a per-key trend. No axis text, so it may fill its box
// (preserveAspectRatio="none") — the uniform-scaling rule is for axis charts.
function KeySpark({ values, color }: { values: number[]; color: string }) {
  const w = 110;
  const h = 30;
  const p = 3;
  const vals = values.length >= 2 ? values : [values[0] ?? 0, values[0] ?? 0];
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const X = (i: number) => p + (i / (vals.length - 1)) * (w - 2 * p);
  const Y = (v: number) => p + (h - 2 * p) - ((v - mn) / (mx - mn || 1)) * (h - 2 * p);
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${X(0).toFixed(1)},${h - p} ${pts} ${X(vals.length - 1).toFixed(1)},${h - p}`;
  return (
    <svg className="kspark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---- daily goal segmented control (mirrors Settings → Practice → Daily goal) ----

function GoalControl({ value, onChange }: { value: number; onChange: (g: number) => void }) {
  return (
    <span className="goalset">
      Daily goal
      <span className="segmented goalseg" role="group" aria-label="Daily practice goal">
        {DAILY_GOALS.map((g) => (
          <button
            key={g}
            type="button"
            className={`seg${value === g ? ' active' : ''}`}
            aria-pressed={value === g}
            onClick={() => onChange(g)}
          >
            {g}m
          </button>
        ))}
      </span>
    </span>
  );
}

// ---- practice calendar ----

const WEEKS = 26;
const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function Calendar({
  dayMinutes,
  goalMinutes,
}: {
  dayMinutes: Map<number, number>;
  goalMinutes: number;
}) {
  const DAY_MS = 86_400_000;
  const now = Date.now();
  const today = Math.floor(
    Date.UTC(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()) /
      DAY_MS,
  );
  const todayDow = new Date(now).getDay();
  const start = today - todayDow - (WEEKS - 1) * 7; // Sunday of the first column

  const cells: Array<{ di: number; future: boolean; min: number }> = [];
  for (let wk = 0; wk < WEEKS; wk++) {
    for (let dow = 0; dow < 7; dow++) {
      const di = start + wk * 7 + dow;
      cells.push({ di, future: di > today, min: dayMinutes.get(di) ?? 0 });
    }
  }

  // Month labels: emit a short name at the column where the month changes.
  const months: Array<{ col: number; name: string }> = [];
  let prevMonth = -1;
  for (let wk = 0; wk < WEEKS; wk++) {
    const d = new Date((start + wk * 7) * DAY_MS);
    const m = d.getUTCMonth();
    if (m !== prevMonth) {
      months.push({ col: wk, name: d.toLocaleString('en', { month: 'short', timeZone: 'UTC' }) });
      prevMonth = m;
    }
  }

  return (
    <div className="cal">
      <div className="caldays">
        {DOW_LABELS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div>
        <div className="calmonths">
          {months.map((m) => (
            <span key={m.col} style={{ gridColumnStart: m.col + 1 }}>
              {m.name}
            </span>
          ))}
        </div>
        <div className="calgrid">
          {cells.map((c, i) => {
            const met = !c.future && c.min > 0 && c.min >= goalMinutes;
            return (
              <div
                key={i}
                className={`cell${met ? ' met' : ''}`}
                style={{ background: c.future ? 'transparent' : calColor(calLevel(c.min)) }}
                title={c.future ? '' : `${Math.round(c.min)} min${met ? ' · goal met' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
