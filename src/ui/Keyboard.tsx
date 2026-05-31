// Live virtual keyboard. Each included letter is colored by its confidence
// (red -> green); locked letters are dimmed; the focus key is outlined. This is
// the always-visible "analysis" surface during practice.
import type { CSSProperties } from 'react';
import type { CodePoint } from '../core/types';
import { KeyStatsMap } from '../core/keyStats';
import { confidenceColor } from './color';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  stats: KeyStatsMap;
  targetSpeed: number;
  included: Set<CodePoint>;
  focus: CodePoint | null;
  recoverKeys: boolean;
}

export function Keyboard({ stats, targetSpeed, included, focus, recoverKeys }: Props) {
  return (
    <div className="keyboard" aria-hidden="true">
      {ROWS.map((row, ri) => (
        <div className="krow" key={ri}>
          {Array.from(row).map((ch) => {
            const cp = ch.codePointAt(0)!;
            const inc = included.has(cp);
            const conf = recoverKeys
              ? stats.confidence(cp, targetSpeed)
              : stats.bestConfidence(cp, targetSpeed);
            const isFocus = focus === cp;
            const style: CSSProperties = inc
              ? { background: confidenceColor(conf), color: 'var(--on-confidence)' }
              : {};
            const pct = Math.round(Math.min(1, conf) * 100);
            const cls = `key ${inc ? 'included' : 'excluded'}${isFocus ? ' focus' : ''}`;
            return (
              <div
                key={ch}
                className={cls}
                style={style}
                title={inc ? `${ch} — ${pct}% of target speed` : `${ch} — locked`}
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
