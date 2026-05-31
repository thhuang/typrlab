// Renders the single rolling line of text as per-character spans styled by
// state: typed (hit), the cursor (optionally flagged as an error), and untyped.

interface Props {
  text: string;
  position: number;
  hasError: boolean;
}

export function TypingBoard({ text, position, hasError }: Props) {
  const chars = Array.from(text);
  return (
    <div className="board" aria-label="typing text">
      {chars.map((ch, i) => {
        let cls = 'ch';
        if (i < position) cls += ' hit';
        else if (i === position) cls += hasError ? ' cursor err' : ' cursor';
        const display = ch === ' ' ? ' ' : ch;
        return (
          <span key={i} className={cls}>
            {display}
          </span>
        );
      })}
    </div>
  );
}
