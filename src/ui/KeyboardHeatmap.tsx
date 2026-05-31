// A QWERTY keyboard colored by a per-key value (0..1), e.g. accuracy. Keys with
// no data render dim. Shares the .keyboard/.key styles with the practice view.
import type { CodePoint } from '../core/types';
import { confidenceColor } from './color';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export function KeyboardHeatmap({ values }: { values: Map<CodePoint, number> }) {
  return (
    <div className="keyboard kb-heatmap">
      {ROWS.map((row, ri) => (
        <div className="krow" key={ri}>
          {Array.from(row).map((ch) => {
            const cp = ch.codePointAt(0)!;
            const v = values.get(cp);
            const style =
              v == null ? {} : { background: confidenceColor(v), color: v > 0.55 ? '#08121a' : '#fff' };
            return (
              <div
                key={ch}
                className={`key ${v == null ? 'excluded' : 'included'}`}
                style={style}
                title={v == null ? `${ch} — no data` : `${ch} — ${Math.round(v * 100)}%`}
              >
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
