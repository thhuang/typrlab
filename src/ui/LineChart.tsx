// Dependency-free SVG line chart. Supports multiple series, an optional filled
// area, sparse point markers, a dashed reference (goal) line, gridlines + y-axis
// ticks, and x-axis labels. Colors are passed as CSS token values (e.g.
// 'var(--accent)') so it stays theme-correct. The legacy single-series `values`
// prop still works (rendered as one accent series).
export interface Series {
  values: number[];
  /** CSS color (token), e.g. 'var(--accent)'. */
  color: string;
  fill?: boolean;
  markers?: boolean;
  /** SVG dash pattern, e.g. '5 4'. */
  dash?: string;
  width?: number;
  opacity?: number;
}

interface Props {
  series?: Series[];
  /** Legacy convenience: a single accent series. */
  values?: number[];
  width?: number;
  height?: number;
  /** Fixed y-domain; auto from the data (with padding) when omitted. */
  min?: number;
  max?: number;
  /** Dashed horizontal reference line (e.g. the goal wpm). */
  goal?: number;
  ticks?: number;
  /** Draw a marker every N points (plus the last). */
  markerEvery?: number;
  /** [index, label] pairs along the x-axis. */
  xLabels?: Array<[number, string]>;
  /** Suffix on the top y-tick label (e.g. 'wpm', '%'). */
  unit?: string;
}

export function LineChart({
  series,
  values,
  width = 1080,
  height = 220,
  min,
  max,
  goal,
  ticks = 4,
  markerEvery = 5,
  xLabels = [],
  unit = '',
}: Props) {
  const data: Series[] = series ?? [
    { values: values ?? [], color: 'var(--accent)', fill: true, markers: true },
  ];
  const n = Math.max(...data.map((s) => s.values.length), 0);
  if (n === 0) return null;

  const P = { l: 36, r: 12, t: 12, b: 24 };
  const iw = width - P.l - P.r;
  const ih = height - P.t - P.b;

  const all = data.flatMap((s) => s.values).concat(goal != null ? [goal] : []);
  let lo = min ?? Math.min(...all);
  let hi = max ?? Math.max(...all);
  if (min == null || max == null) {
    const pad = (hi - lo) * 0.12 || 1;
    if (min == null) lo -= pad;
    if (max == null) hi += pad;
  }
  const span = hi - lo || 1;

  const X = (i: number) => P.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const Y = (v: number) => P.t + ih - ((v - lo) / span) * ih;

  const gridY = Array.from({ length: ticks + 1 }, (_, t) => lo + (span * t) / ticks);

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height }}
      role="img"
    >
      {gridY.map((v, t) => (
        <g key={t}>
          <line className="chart-grid" x1={P.l} y1={Y(v)} x2={width - P.r} y2={Y(v)} />
          <text className="chart-axis-label" x={P.l - 7} y={Y(v) + 3} textAnchor="end">
            {Math.round(v)}
            {t === ticks && unit ? ` ${unit}` : ''}
          </text>
        </g>
      ))}

      {goal != null && (
        <line className="chart-goal" x1={P.l} y1={Y(goal)} x2={width - P.r} y2={Y(goal)} />
      )}

      {data.map((s, si) => {
        const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
        return (
          <g key={si}>
            {s.fill && s.values.length > 0 && (
              <polygon
                points={`${X(0).toFixed(1)},${P.t + ih} ${pts} ${X(s.values.length - 1).toFixed(1)},${P.t + ih}`}
                fill={s.color}
                opacity={0.12}
              />
            )}
            <polyline
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dash}
              opacity={s.opacity ?? 1}
              vectorEffect="non-scaling-stroke"
            />
            {s.markers &&
              s.values.map((v, i) =>
                i % markerEvery === 0 || i === s.values.length - 1 ? (
                  <circle key={i} cx={X(i)} cy={Y(v)} r={2.5} fill={s.color} />
                ) : null,
              )}
          </g>
        );
      })}

      {xLabels.map(([i, label]) => (
        <text key={i} className="chart-axis-label" x={X(i)} y={height - 6} textAnchor="middle">
          {label}
        </text>
      ))}
    </svg>
  );
}
