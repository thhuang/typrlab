// Renders the single rolling line of text as per-character spans styled by
// state: typed (hit), the cursor (optionally flagged as an error), and untyped.
// The cursor's visual style (box / underline / bar / block) is configurable.
import type { Settings } from '../core/settings';

interface Props {
  text: string;
  position: number;
  hasError: boolean;
  cursorStyle: Settings['cursorStyle'];
  /** Render as a naked line (no panel) for the Zen focus view. */
  bare?: boolean;
}

export function TypingBoard({ text, position, hasError, cursorStyle, bare = false }: Props) {
  const chars = Array.from(text);
  return (
    <div className={bare ? 'zen-text' : 'board'} aria-label="typing text">
      {chars.map((ch, i) => {
        let cls = 'ch';
        if (i < position) cls += ' hit';
        else if (i === position) cls += ` cursor cursor-${cursorStyle}${hasError ? ' err' : ''}`;
        const display = ch === ' ' ? ' ' : ch;
        return (
          <span key={i} className={cls}>
            {display}
          </span>
        );
      })}
    </div>
  );
}
