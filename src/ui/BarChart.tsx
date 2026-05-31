// Dependency-free horizontal bar chart. Used for the per-key speed histogram;
// labels on the left, value on the right, bar width proportional to value.

export interface Bar {
  label: string;
  value: number;
  color: string;
}

export function BarChart({ bars, unit }: { bars: Bar[]; unit?: string }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="barchart">
      {bars.map((b) => (
        <div className="bar-row" key={b.label}>
          <span className="bar-label">{b.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(b.value / max) * 100}%`, background: b.color }}
            />
          </div>
          <span className="bar-value">
            {Math.round(b.value)}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
