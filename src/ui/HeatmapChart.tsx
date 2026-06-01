// Per-key learning heatmap: one row per letter, one cell per lesson, colored by
// that key's running confidence (red = slow, green = at target). A cell is shown
// only for lessons where the key was actually typed; it's empty (null) otherwise.
import { confidenceColor } from './color';

export interface HeatRow {
  label: string;
  cells: Array<number | null>;
}

export function HeatmapChart({ rows }: { rows: HeatRow[] }) {
  return (
    <div className="heatmap">
      {rows.map((row) => (
        <div className="hm-row" key={row.label}>
          <span className="hm-label">{row.label}</span>
          <div className="hm-cells">
            {row.cells.map((c, i) => (
              <span
                key={i}
                className="hm-cell"
                style={{ background: c === null ? 'transparent' : confidenceColor(c) }}
                title={c === null ? 'no data' : `${Math.round(Math.min(1, c) * 100)}%`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
