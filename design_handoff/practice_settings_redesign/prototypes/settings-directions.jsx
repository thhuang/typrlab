// Settings-screen direction studies for typr. Built from the REAL settings
// (settings.ts / SettingsView.tsx): target speed, accuracy-aware unlocking,
// bigram targeting, natural words, recover keys, stop-on-error, theme, font,
// text size, cursor shape, clear-data.

const Switch = ({ on }) => (
  <div className={`x-switch${on ? ' on' : ''}`}><span className="knob"></span></div>
);

const SettRow = ({ name, desc, children }) => (
  <div className="x-srow">
    <div className="x-slabel"><span className="x-sname">{name}</span><span className="x-sdesc">{desc}</span></div>
    <div style={{ flex: '0 0 auto' }}>{children}</div>
  </div>
);

const Range = ({ pct, val }) => (
  <div className="x-range">
    <div className="x-track"><div className="fill" style={{ width: `${pct}%` }}></div><div className="thumb" style={{ left: `${pct}%` }}></div></div>
    <span className="x-rangeval">{val}</span>
  </div>
);

const Seg = ({ opts, active }) => (
  <div className="x-seg">{opts.map((o) => <button className={o === active ? 'active' : ''} key={o}>{o}</button>)}</div>
);

const Select = ({ value }) => (
  <span className="x-select">{value} <span className="car">▾</span></span>
);

// Live preview board reused from the real Preview component.
function PreviewBoard() {
  return (
    <div className="x-board x-preview">
      <XText text="the quick brown fox" hit={10} cursor={10} className="" style={{ fontFamily: 'inherit' }} />
    </div>
  );
}

// ---------- A · Two-pane with live preview ----------
function SettingsTwoPane() {
  return (
    <div className="scr" data-theme="one-dark">
      <div className="x-top">
        <div className="x-brand">typr<span className="c">_</span><span className="tag">settings</span></div>
        <div className="x-right">
          <div className="x-toggle"><button>Practice</button><button>Analysis</button><button className="active">Settings</button></div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '210px 1fr', gap: 22, padding: '6px 28px 26px', maxWidth: 980, margin: '0 auto', width: '100%' }}>
        <div className="x-nav" style={{ paddingTop: 6 }}>
          <button>Practice</button>
          <button className="active">Text appearance</button>
          <button>Data</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <PreviewBoard />
          <fieldset className="x-group">
            <legend>Text appearance</legend>
            <SettRow name="Theme" desc="Light and dark palettes. Light suits bright rooms; dark suits dim ones."><Select value="Amber" /></SettRow>
            <SettRow name="Typing font" desc="Practice text only. The default monospace keeps l / I / 1 and 0 / O easy to tell apart."><Select value="JetBrains Mono" /></SettRow>
            <SettRow name="Text size" desc="The lever that actually matters for reading — more than typeface."><Range pct={45} val="32px" /></SettRow>
            <SettRow name="Cursor shape" desc="How the next character is indicated."><Seg opts={['Box', 'Underline', 'Line', 'Block']} active="Box" /></SettRow>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

// ---------- B · Single-column grouped (refined) ----------
function SettingsSingleColumn() {
  return (
    <div className="scr" data-theme="one-dark">
      <div className="x-top">
        <div className="x-brand">typr<span className="c">_</span><span className="tag">settings</span></div>
        <div className="x-right">
          <div className="x-toggle"><button>Practice</button><button>Analysis</button><button className="active">Settings</button></div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: '6px 28px 28px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <h2 className="x-set-title">Settings</h2>

        <fieldset className="x-group">
          <legend>Practice</legend>
          <SettRow name="Target speed" desc="New letters unlock once every active key reaches this speed."><Range pct={30} val="35 wpm" /></SettRow>
          <SettRow name="Accuracy-aware unlocking" desc="A key must be typed fast AND accurately before it counts toward unlocking the next letter."><Switch on={true} /></SettRow>
          <SettRow name="Bigram targeting" desc="Also drill your slowest transitions (digraphs like th, er), not just single keys."><Switch on={true} /></SettRow>
          <SettRow name="Natural words" desc="Prefer real dictionary words over phonetic pseudo-words once enough letters are unlocked."><Switch on={true} /></SettRow>
          <SettRow name="Recover keys" desc="A key that decays below target re-locks further progress until you recover it."><Switch on={false} /></SettRow>
          <SettRow name="Stop cursor on error" desc="Hold the cursor on a wrong key until you correct it."><Switch on={true} /></SettRow>
        </fieldset>

        <fieldset className="x-group">
          <legend>Text appearance</legend>
          <div style={{ padding: '6px 0 14px' }}><PreviewBoard /></div>
          <SettRow name="Theme" desc="Light and dark palettes for any room."><Select value="Amber" /></SettRow>
          <SettRow name="Cursor shape" desc="How the next character is indicated."><Seg opts={['Box', 'Underline', 'Line', 'Block']} active="Box" /></SettRow>
        </fieldset>

        <fieldset className="x-group">
          <legend>Data</legend>
          <SettRow name="Clear all progress" desc="Permanently delete your history and stats on this device. Preferences are kept."><button className="x-danger ghost">Clear…</button></SettRow>
        </fieldset>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsTwoPane, SettingsSingleColumn });
