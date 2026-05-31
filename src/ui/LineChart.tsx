// Dependency-free SVG line chart: a polyline of values with a trend line and a
// marker on the latest point. Used for the learning curve.
import { linreg } from '../core/learning';

interface Props {
  values: number[];
  width?: number;
  height?: number;
}

export function LineChart({ values, width = 820, height = 170 }: Props) {
  const pad = 26;
  const n = values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const x = (i: number) => pad + (n > 1 ? (i / (n - 1)) * (width - 2 * pad) : 0);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const trend = linreg(values);
  const lastX = x(n - 1);
  const lastY = y(values[n - 1]!);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
      <line className="chart-axis" x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
      {trend && (
        <line
          className="chart-trend"
          x1={x(0)}
          y1={y(trend.intercept)}
          x2={x(n - 1)}
          y2={y(trend.slope * (n - 1) + trend.intercept)}
        />
      )}
      <polyline className="chart-line" points={points} fill="none" />
      <circle className="chart-dot" cx={lastX} cy={lastY} r={3.5} />
      <text className="chart-label" x={width - pad} y={pad - 8} textAnchor="end">
        {Math.round(max)} wpm
      </text>
    </svg>
  );
}
