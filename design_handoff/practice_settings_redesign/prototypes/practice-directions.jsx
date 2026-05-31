// Practice-screen direction studies for typr. Three distinct UX bets, all built
// on the real flow (continuous lessons, confidence-colored keys, focus drilling)
// and real stats. Rendered as static hi-fi frames on the design canvas.

const confBg = (c) => `color-mix(in oklch, var(--fast-key-color) ${Math.round(c * 100)}%, var(--slow-key-color))`;

// Shared keyboard. confMap: { letter: confidence 0..1 | null(locked) }, focus letter.
function XKeyboard({ confMap, focus, size = 'full' }) {
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  return (
    <div className="x-kb">
      {ROWS.map((row, ri) => (
        <div className="x-krow" key={ri}>
          {Array.from(row).map((ch) => {
            const c = confMap[ch];
            const locked = c == null;
            const style = locked ? {} : { background: confBg(c) };
            const cls = `x-key ${locked ? 'lock' : 'conf'}${focus === ch ? ' focus' : ''}`;
            return <div className={cls} style={style} key={ch}>{ch}</div>;
          })}
        </div>
      ))}
    </div>
  );
}

// Render one line of text with hit run + box cursor.
function XText({ text, hit, cursor, className, style }) {
  return (
    <div className={className} style={style}>
      {Array.from(text).map((ch, i) => {
        let cls = 'x-ch';
        if (i < hit) cls += ' hit';
        else if (i === cursor) cls += ' cur';
        return <span className={cls} key={i}>{ch}</span>;
      })}
    </div>
  );
}

const SAMPLE = 'the morning light filtered through';
const CONF = {
  q: 0.34, w: 0.62, e: 0.93, r: 0.71, t: 0.4, y: 0.58, u: 0.8, i: 0.86, o: 0.95, p: 0.5,
  a: 0.9, s: 0.83, d: 0.77, f: 0.88, g: 0.66, h: 0.74, j: null, k: null, l: 0.6,
  z: 0.45, x: 0.55, c: 0.7, v: 0.52, b: 0.61, n: 0.84, m: 0.68,
};

const Gauge = ({ v, l, cls, delta, dir }) => (
  <div className="x-gauge">
    <span className={`gv ${cls || ''}`}>{v}</span>
    <span className="gl">{l}</span>
    {delta && <span className={`x-delta ${dir}`}>{dir === 'up' ? '▲' : '▼'} {delta}</span>}
  </div>
);

// ---------- A · Zen Focus ----------
function PracticeZen() {
  return (
    <div className="scr" data-theme="one-dark" style={{ justifyContent: 'space-between' }}>
      <div className="x-top">
        <div className="x-brand">typr<span className="c">_</span></div>
        <div className="x-right">
          <span className="x-chip"><span className="sw"></span>One Dark</span>
          <button className="x-ghost">settings</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, padding: '0 80px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>
          guided · drilling <b style={{ color: 'var(--accent-soft)' }}>th</b>
        </span>
        <XText text={SAMPLE} hit={11} cursor={11} className="x-line" />
        <div style={{ width: 'min(640px, 70%)', height: 3, borderRadius: 999, background: 'var(--panel)', overflow: 'hidden' }}>
          <div style={{ width: '38%', height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-soft))' }}></div>
        </div>
        <div className="x-gauges" style={{ opacity: 0.92 }}>
          <Gauge v="68" l="wpm" cls="accent" delta="4" dir="up" />
          <Gauge v="97%" l="accuracy" cls="hit" delta="0.6" dir="up" />
          <Gauge v="412" l="score" delta="11" dir="down" />
        </div>
      </div>

      <div style={{ padding: '0 28px 24px' }}>
        <div className="x-goal" style={{ maxWidth: 520, margin: '0 auto' }}>
          <span className="x-goaltext">today</span>
          <div className="x-goalbar"><div className="x-goalfill" style={{ width: '77%' }}></div></div>
          <span className="x-goaltext">23 / 30 min</span>
        </div>
      </div>
    </div>
  );
}

// ---------- B · Instrument ----------
function PracticeInstrument() {
  const cards = [
    ['Last', '68 wpm', 'accent'], ['Accuracy', '97.4%', 'hit'], ['Score', '412', ''], ['Best', '74 wpm', ''],
    ['Average', '61 wpm', ''], ['Letters', '18/26', ''], ['Lessons', '146', ''], ['Focus', 'th', 'accent'],
  ];
  return (
    <div className="scr" data-theme="one-dark">
      <div className="x-top">
        <div className="x-brand">typr<span className="c">_</span><span className="tag">adaptive</span></div>
        <div className="x-right">
          <div className="x-toggle">
            <button className="active">Practice</button>
            <button>Analysis</button>
            <button>Settings</button>
          </div>
          <span className="x-chip"><span className="sw"></span>One Dark</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 28px 24px', maxWidth: 920, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Target 35 wpm</span>
          <span style={{ flex: 1 }}></span>
          <button className="x-ghost">Skip ⌃→</button>
        </div>
        <XText text={SAMPLE} hit={11} cursor={11} className="x-board" style={{ fontSize: 30 }} />
        <XKeyboard confMap={CONF} focus="t" />
        <p className="x-hint">Just start typing — a wrong key holds the cursor until you fix it. Drilling <b>th</b> <span style={{ opacity: 0.7 }}>(weak transition)</span></p>
        <div className="x-cards" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
          {cards.map(([l, v, cls]) => (
            <div className="x-card" key={l}><span className="l">{l}</span><span className={`v ${cls}`}>{v}</span></div>
          ))}
        </div>
        <div className="x-goal">
          <div className="x-goalbar"><div className="x-goalfill" style={{ width: '77%' }}></div></div>
          <span className="x-goaltext">23 / 30 min today</span>
        </div>
      </div>
    </div>
  );
}

// ---------- C · Coach ----------
function PracticeCoach() {
  const weak = [['q', 0.34], ['t', 0.40], ['z', 0.45], ['p', 0.50]];
  return (
    <div className="scr" data-theme="one-dark">
      <div className="x-top">
        <div className="x-brand">typr<span className="c">_</span><span className="tag">adaptive</span></div>
        <div className="x-right">
          <span className="x-chip"><span className="sw"></span>One Dark</span>
          <button className="x-ghost">settings</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, padding: '4px 28px 26px', maxWidth: 980, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
          <XText text={SAMPLE} hit={11} cursor={11} className="x-board" style={{ fontSize: 28 }} />
          <XKeyboard confMap={CONF} focus="t" />
          <p className="x-hint" style={{ textAlign: 'left' }}>Continuous flow — finishing a line generates the next automatically.</p>
        </div>

        <div className="x-rail">
          <div className="x-panel">
            <p className="ph">Now drilling</p>
            <div className="x-bigram">
              <span className="g">t</span><span className="arrow">→</span><span className="g">h</span>
            </div>
            <div className="x-ring" style={{ background: 'conic-gradient(var(--accent) 0% 62%, var(--line) 62% 100%)', marginTop: 14 }}>
              <div className="inner"><span className="rv">62%</span><span className="rl">of target</span></div>
            </div>
            <p className="x-note" style={{ marginTop: 14, textAlign: 'center' }}>Your slowest transition right now.</p>
          </div>

          <div className="x-panel">
            <p className="ph">Weakest keys</p>
            <div className="x-weak">
              {weak.map(([k, c]) => (
                <div className="x-weakrow" key={k}>
                  <span className="kk">{k}</span>
                  <div className="x-weaktrack"><div className="x-weakfill" style={{ width: `${c * 100}%`, background: confBg(c) }}></div></div>
                  <span className="x-weakval">{Math.round(c * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="x-panel">
            <p className="ph">Next unlock</p>
            <p className="x-note"><b>2 keys</b> from unlocking <b style={{ fontFamily: 'var(--font-mono)' }}>k</b>. Get every active key to target speed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PracticeZen, PracticeInstrument, PracticeCoach, XKeyboard, XText });
