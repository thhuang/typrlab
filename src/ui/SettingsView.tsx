// Settings — two-pane layout: a category nav on the left, and on the right a
// pinned live text-appearance preview above the active category's controls.
// Reuses the shared controls (.switch, .segmented, .theme-select, range,
// .danger-btn) and pushes every change through updateSettings / clearAll.
import { useState } from 'react';
import type { Settings } from '../core/settings';
import { DARK_THEMES, LIGHT_THEMES } from './themes';
import { MONO_FONTS, SANS_FONTS, SERIF_FONTS } from './fonts';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onClear: () => void;
}

type Category = 'practice' | 'appearance' | 'data';

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'practice', label: 'Practice' },
  { id: 'appearance', label: 'Text appearance' },
  { id: 'data', label: 'Data' },
];

const CURSORS: Array<{ id: Settings['cursorStyle']; label: string }> = [
  { id: 'box', label: 'Box' },
  { id: 'underline', label: 'Underline' },
  { id: 'bar', label: 'Line' },
  { id: 'block', label: 'Block' },
];

export function SettingsView({ settings, update, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [category, setCategory] = useState<Category>('practice');

  return (
    <section className="settings-twopane" aria-label="Settings">
      <nav className="settings-nav" aria-label="Settings categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`settings-navbtn${category === c.id ? ' active' : ''}`}
            aria-current={category === c.id ? 'page' : undefined}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <div className="settings-pane">
        <Preview cursorStyle={settings.cursorStyle} />

        {category === 'practice' && (
          <fieldset className="sgroup">
            <legend>Practice</legend>

            <div className="srow">
              <div className="slabel">
                <span className="sname">Target speed</span>
                <span className="sdesc">
                  New letters unlock once every active key reaches this speed.
                </span>
              </div>
              <div className="sctrl rangewrap">
                <input
                  type="range"
                  min={75}
                  max={500}
                  step={5}
                  value={settings.targetSpeed}
                  onChange={(e) => update({ targetSpeed: Number(e.target.value) })}
                />
                <span className="rangeval">{Math.round(settings.targetSpeed / 5)} wpm</span>
              </div>
            </div>

            <Toggle
              label="Accuracy-aware unlocking"
              desc="A key must be typed fast AND accurately before it counts toward unlocking the next letter."
              checked={settings.accuracyAware}
              onChange={(v) => update({ accuracyAware: v })}
            />
            <Toggle
              label="Bigram targeting"
              desc="Also drill your slowest transitions (digraphs like th, er), not just single keys."
              checked={settings.bigramTargeting}
              onChange={(v) => update({ bigramTargeting: v })}
            />
            <Toggle
              label="Natural words"
              desc="Prefer real dictionary words over phonetic pseudo-words once enough letters are unlocked."
              checked={settings.naturalWords}
              onChange={(v) => update({ naturalWords: v })}
            />
            <Toggle
              label="Recover keys"
              desc="Require keys to stay above target speed; a key that decays re-locks further progress until you recover it."
              checked={settings.recoverKeys}
              onChange={(v) => update({ recoverKeys: v })}
            />
            <Toggle
              label="Stop cursor on error"
              desc="Hold the cursor on a wrong key until you correct it. If off, single mistakes are forgiven and the cursor keeps moving."
              checked={settings.stopOnError}
              onChange={(v) => update({ stopOnError: v })}
            />
          </fieldset>
        )}

        {category === 'appearance' && (
          <fieldset className="sgroup">
            <legend>Text appearance</legend>

            <div className="srow">
              <div className="slabel">
                <span className="sname">Theme</span>
                <span className="sdesc">
                  Light and dark palettes. Light suits bright rooms; dark suits dim ones.
                </span>
              </div>
              <div className="sctrl">
                <select
                  className="theme-select"
                  value={settings.theme}
                  onChange={(e) => update({ theme: e.target.value })}
                  aria-label="Color theme"
                >
                  <optgroup label="Dark">
                    {DARK_THEMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Light">
                    {LIGHT_THEMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="srow">
              <div className="slabel">
                <span className="sname">Typing font</span>
                <span className="sdesc">
                  Practice text only. Pick what’s comfortable — research shows typeface barely
                  affects reading speed; the default monospace just keeps similar characters (l/I/1,
                  0/O) easy to tell apart.
                </span>
              </div>
              <div className="sctrl">
                <select
                  className="theme-select"
                  value={settings.font}
                  onChange={(e) => update({ font: e.target.value })}
                  aria-label="Typing font"
                >
                  <optgroup label="Monospace">
                    {MONO_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sans-serif">
                    {SANS_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Serif">
                    {SERIF_FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="srow">
              <div className="slabel">
                <span className="sname">Text size</span>
                <span className="sdesc">
                  The lever that actually matters for reading — size affects speed and comprehension
                  far more than typeface does.
                </span>
              </div>
              <div className="sctrl rangewrap">
                <input
                  type="range"
                  min={22}
                  max={44}
                  step={1}
                  value={settings.textSize}
                  onChange={(e) => update({ textSize: Number(e.target.value) })}
                />
                <span className="rangeval">{settings.textSize}px</span>
              </div>
            </div>

            <div className="srow">
              <div className="slabel">
                <span className="sname">Cursor shape</span>
                <span className="sdesc">How the next character is indicated.</span>
              </div>
              <div className="sctrl segmented">
                {CURSORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`seg${settings.cursorStyle === c.id ? ' active' : ''}`}
                    onClick={() => update({ cursorStyle: c.id })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {category === 'data' && (
          <fieldset className="sgroup">
            <legend>Data</legend>
            <div className="srow">
              <div className="slabel">
                <span className="sname">Clear all progress</span>
                <span className="sdesc">
                  Permanently delete your typing history and stats on this device. Your preferences
                  are kept. This cannot be undone.
                </span>
              </div>
              <div className="sctrl">
                {confirming ? (
                  <div className="confirm-row">
                    <button type="button" className="seg" onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => {
                        onClear();
                        setConfirming(false);
                      }}
                    >
                      Delete everything
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="danger-btn ghost"
                    onClick={() => setConfirming(true)}
                  >
                    Clear…
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        )}
      </div>
    </section>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="srow">
      <div className="slabel">
        <span className="sname">{label}</span>
        <span className="sdesc">{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

function Preview({ cursorStyle }: { cursorStyle: Settings['cursorStyle'] }) {
  const typed = 'the quick ';
  const at = 'b';
  const rest = 'rown fox';
  return (
    <div className="board settings-preview" aria-hidden="true">
      {Array.from(typed).map((c, i) => (
        <span key={`t${i}`} className="ch hit">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
      <span className={`ch cursor cursor-${cursorStyle}`}>{at}</span>
      {Array.from(rest).map((c, i) => (
        <span key={`r${i}`} className="ch">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </div>
  );
}
