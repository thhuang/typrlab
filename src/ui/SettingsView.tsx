// Settings — two layouts sharing the same groups:
//  - wide (>780px): two-pane (category nav + pinned live preview + active group)
//  - narrow (<=780px): single column with all three groups stacked and the
//    preview inside Text appearance (the minimal-diff fallback).
// Reuses the shared controls (.switch, .segmented, .theme-select, range,
// .danger-btn) and pushes every change through update / onClear.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Settings } from '../core/settings';
import { WORDS } from '../core/words';
import { useMediaQuery } from '../hooks/useMediaQuery';
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

// Letter-introduction order: a learning-path preference, not a promised speed gain.
const KEY_ORDERS: Array<{ id: Settings['keyOrder']; label: string; desc: string }> = [
  {
    id: 'balanced',
    label: 'Balanced',
    desc: 'Frequency-driven but balanced across both hands to ease early lessons. Recommended.',
  },
  {
    id: 'frequency',
    label: 'Frequency',
    desc: 'Unlock the most common letters first (e, t, a…). Best if you already touch-type.',
  },
  {
    id: 'home-row',
    label: 'Home row',
    desc: 'Start on the home row and expand by row — the classic touch-typing path. Best for beginners.',
  },
];

// Daily practice goal (minutes). Drives goal-met days + streak on the Analysis calendar.
export const DAILY_GOALS = [10, 20, 30, 60] as const;

// What you practice on. Non-adaptive modes drop the unlock/focus targeting.
const MODES: Array<{ id: Settings['contentMode']; label: string; desc: string }> = [
  {
    id: 'adaptive',
    label: 'Adaptive',
    desc: 'The guided stream — unlocks letters as you reach target speed.',
  },
  { id: 'words', label: 'Words', desc: 'Real words from the frequency bank, ungated.' },
  { id: 'numbers', label: 'Numbers', desc: 'Random digit groups — drill the number row.' },
  { id: 'custom', label: 'Custom', desc: 'Practice your own pasted text.' },
];

type GroupProps = { settings: Settings; update: Props['update'] };

export function SettingsView({ settings, update, onClear }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [category, setCategory] = useState<Category>('practice');
  const single = useMediaQuery('(max-width: 780px)');

  const practice = <PracticeGroup settings={settings} update={update} />;
  const appearance = <AppearanceGroup settings={settings} update={update} withPreview={single} />;
  const data = (
    <DataGroup confirming={confirming} setConfirming={setConfirming} onClear={onClear} />
  );

  if (single) {
    return (
      <section className="settings-single" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="settings-title">
          Settings
        </h2>
        {practice}
        {appearance}
        {data}
        <MadeBy />
      </section>
    );
  }

  return (
    <section className="settings-twopane" aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="settings-title">
        Settings
      </h2>
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
        {category === 'practice' && practice}
        {category === 'appearance' && appearance}
        {category === 'data' && data}
        <MadeBy />
      </div>
    </section>
  );
}

// Small, muted attribution at the bottom of Settings — house identity without
// letting the portfolio mark become the product icon.
function MadeBy() {
  return (
    <a
      className="madeby"
      href="https://thhuang.github.io"
      target="_blank"
      rel="noopener noreferrer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, tiny credit icon */}
      <img src="/madeby-thhuang.png" alt="" width={22} height={22} />
      <span>Made by thhuang</span>
    </a>
  );
}

function PracticeGroup({ settings, update }: GroupProps) {
  return (
    <fieldset className="sgroup">
      <legend>Practice</legend>

      <div className="srow">
        <div className="slabel">
          <span className="sname">Practice mode</span>
          <span className="sdesc">{MODES.find((m) => m.id === settings.contentMode)?.desc}</span>
        </div>
        <div className="sctrl segmented" role="group" aria-label="Practice mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`seg${settings.contentMode === m.id ? ' active' : ''}`}
              aria-pressed={settings.contentMode === m.id}
              onClick={() => update({ contentMode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {settings.contentMode === 'numbers' && (
        <>
          <div className="srow">
            <div className="slabel">
              <span className="sname">Digits per group</span>
            </div>
            <div className="sctrl rangewrap">
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={settings.numberGroupSize}
                onChange={(e) => update({ numberGroupSize: Number(e.target.value) })}
              />
              <span className="rangeval">{settings.numberGroupSize}</span>
            </div>
          </div>
          <div className="srow">
            <div className="slabel">
              <span className="sname">Groups per line</span>
            </div>
            <div className="sctrl rangewrap">
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={settings.numberGroupCount}
                onChange={(e) => update({ numberGroupCount: Number(e.target.value) })}
              />
              <span className="rangeval">{settings.numberGroupCount}</span>
            </div>
          </div>
        </>
      )}

      {settings.contentMode === 'custom' && (
        <div className="srow srow-block">
          <div className="slabel">
            <span className="sname">Your text</span>
            <span className="sdesc">Pasted text is split into practice lines.</span>
          </div>
          <textarea
            className="settings-textarea"
            value={settings.customText}
            onChange={(e) => update({ customText: e.target.value })}
            rows={3}
            placeholder="Paste text to practice…"
            aria-label="Custom practice text"
          />
        </div>
      )}

      {(settings.contentMode === 'adaptive' || settings.contentMode === 'words') && (
        <>
          <div className="srow">
            <div className="slabel">
              <span className="sname">Capitals</span>
              <span className="sdesc">Capitalise this share of words.</span>
            </div>
            <div className="sctrl rangewrap">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.capitalsPct}
                onChange={(e) => update({ capitalsPct: Number(e.target.value) })}
              />
              <span className="rangeval">{settings.capitalsPct}%</span>
            </div>
          </div>
          <div className="srow">
            <div className="slabel">
              <span className="sname">Punctuation</span>
              <span className="sdesc">Add punctuation to this share of words.</span>
            </div>
            <div className="sctrl rangewrap">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={settings.punctuationPct}
                onChange={(e) => update({ punctuationPct: Number(e.target.value) })}
              />
              <span className="rangeval">{settings.punctuationPct}%</span>
            </div>
          </div>
        </>
      )}

      <div className="srow">
        <div className="slabel">
          <span className="sname">Target speed</span>
          <span className="sdesc">
            Your goal speed. In Adaptive mode, new letters unlock once every active key reaches it.
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

      <div className="srow">
        <div className="slabel">
          <span className="sname">Daily goal</span>
          <span className="sdesc">
            Minutes of practice per day. Sets the goal-met days and streak on the Analysis calendar.
          </span>
        </div>
        <div className="sctrl segmented" role="group" aria-label="Daily practice goal">
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              className={`seg${settings.dailyGoalMinutes === g ? ' active' : ''}`}
              aria-pressed={settings.dailyGoalMinutes === g}
              onClick={() => update({ dailyGoalMinutes: g })}
            >
              {g}m
            </button>
          ))}
        </div>
      </div>

      {/* Unlock/targeting controls only matter for the adaptive stream. */}
      {settings.contentMode === 'adaptive' && (
        <>
          <div className="srow">
            <div className="slabel">
              <span className="sname">Key introduction order</span>
              <span className="sdesc">
                {KEY_ORDERS.find((k) => k.id === settings.keyOrder)?.desc}
              </span>
            </div>
            <div className="sctrl segmented" role="group" aria-label="Key introduction order">
              {KEY_ORDERS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`seg${settings.keyOrder === k.id ? ' active' : ''}`}
                  aria-pressed={settings.keyOrder === k.id}
                  onClick={() => update({ keyOrder: k.id })}
                >
                  {k.label}
                </button>
              ))}
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
        </>
      )}

      <Toggle
        label="Stop cursor on error"
        desc="Hold the cursor on a wrong key until you correct it. If off, single mistakes are forgiven and the cursor keeps moving."
        checked={settings.stopOnError}
        onChange={(v) => update({ stopOnError: v })}
      />
    </fieldset>
  );
}

function AppearanceGroup({ settings, update, withPreview }: GroupProps & { withPreview: boolean }) {
  return (
    <fieldset className="sgroup">
      <legend>Text appearance</legend>

      {withPreview && (
        <div className="settings-preview-wrap">
          <Preview cursorStyle={settings.cursorStyle} />
        </div>
      )}

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
            Practice text only. Pick what’s comfortable — research shows typeface barely affects
            reading speed; the default monospace just keeps similar characters (l/I/1, 0/O) easy to
            tell apart.
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
            The lever that actually matters for reading — size affects speed and comprehension far
            more than typeface does.
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
        <div className="sctrl segmented" role="group" aria-label="Cursor shape">
          {CURSORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`seg${settings.cursorStyle === c.id ? ' active' : ''}`}
              aria-pressed={settings.cursorStyle === c.id}
              onClick={() => update({ cursorStyle: c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function DataGroup({
  confirming,
  setConfirming,
  onClear,
}: {
  confirming: boolean;
  setConfirming: Dispatch<SetStateAction<boolean>>;
  onClear: () => void;
}) {
  return (
    <fieldset className="sgroup">
      <legend>Data</legend>
      <div className="srow">
        <div className="slabel">
          <span className="sname">Clear all progress</span>
          <span className="sdesc">
            Permanently delete your typing history and stats on this device. Your preferences are
            kept. This cannot be undone.
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
            <button type="button" className="danger-btn ghost" onClick={() => setConfirming(true)}>
              Clear…
            </button>
          )}
        </div>
      </div>
    </fieldset>
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

// A fresh line of real words from the bank — varied each loop, but length-bounded
// (PREVIEW_MAX) so it never exceeds two wrapped lines even on a phone (paired with
// the 2-line min-height on .settings-preview, that keeps the box from resizing).
const PREVIEW_MIN = 14;
const PREVIEW_MAX = 24;
function buildPreviewLine(): string {
  const words: string[] = [];
  let len = 0;
  let prev = '';
  while (len < PREVIEW_MIN) {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    if (w === prev) continue;
    const add = words.length === 0 ? w.length : w.length + 1;
    if (words.length > 0 && len + add > PREVIEW_MAX) break;
    words.push(w);
    prev = w;
    len += add;
  }
  return words.join(' ');
}

// Live preview: auto-types a line (cursor advancing, glyphs flipping
// untyped -> hit) so the chosen font/theme/cursor is shown in motion, then
// pauses and starts a fresh random line. Static under reduced-motion.
function Preview({ cursorStyle }: { cursorStyle: Settings['cursorStyle'] }) {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [{ line, pos }, setFrame] = useState(() => ({ line: 'the quick brown fox', pos: 10 }));

  useEffect(() => {
    // Reduced motion: a single static, recognizable mid-typed frame.
    if (reduced) {
      setFrame({ line: 'the quick brown fox', pos: 10 });
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let text = buildPreviewLine();
    let p = 0;
    setFrame({ line: text, pos: 0 });

    const step = () => {
      if (p < text.length) {
        p += 1;
        setFrame({ line: text, pos: p });
        timer = setTimeout(step, 70 + Math.random() * 90); // ~70–160ms per char
      } else {
        // Finished: hold the completed line, then start a fresh one.
        timer = setTimeout(() => {
          text = buildPreviewLine();
          p = 0;
          setFrame({ line: text, pos: 0 });
          timer = setTimeout(step, 550);
        }, 1300);
      }
    };
    timer = setTimeout(step, 450);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <div className="board settings-preview" aria-hidden="true">
      <div className="settings-preview-line">
        {Array.from(line).map((c, i) => {
          const cls = i < pos ? 'ch hit' : i === pos ? `ch cursor cursor-${cursorStyle}` : 'ch';
          return (
            <span key={i} className={cls}>
              {c === ' ' ? ' ' : c}
            </span>
          );
        })}
      </div>
    </div>
  );
}
