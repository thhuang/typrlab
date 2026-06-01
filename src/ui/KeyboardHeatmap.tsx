// A QWERTY keyboard colored by a per-key value (0..1) — e.g. speed confidence or
// accuracy. Optional `mini` labels (e.g. per-key wpm) render in the corner, and
// `locked` keys render dim. Keys with no value render dim too. Shares the
// .keyboard/.key styles with the practice view.
import type { CodePoint } from '../core/types';
import { confidenceColor } from './color';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  values: Map<CodePoint, number>;
  /** Optional corner label per key (e.g. current wpm). */
  mini?: Map<CodePoint, number>;
  /** Keys to render dim even if they have a value (defaults to "no value"). */
  locked?: Set<CodePoint>;
}

export function KeyboardHeatmap({ values, mini, locked }: Props) {
  return (
    <div className="keyboard kb-heatmap">
      {ROWS.map((row, ri) => (
        <div className="krow" key={ri}>
          {Array.from(row).map((ch) => {
            const cp = ch.codePointAt(0)!;
            const v = values.get(cp);
            const isLocked = locked ? locked.has(cp) : v == null;
            const colored = v != null && !isLocked;
            const style = colored
              ? { background: confidenceColor(v), color: 'var(--on-confidence)' }
              : {};
            const label = mini?.get(cp);
            return (
              <div
                key={ch}
                className={`key ${isLocked ? 'excluded' : 'included'}`}
                style={style}
                title={
                  isLocked
                    ? `${ch} — ${v == null ? 'no data' : 'locked'}`
                    : `${ch} — ${Math.round((v ?? 0) * 100)}%`
                }
              >
                {ch}
                {colored && label != null && <span className="mini">{Math.round(label)}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
