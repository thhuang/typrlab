// Confidence -> color. The ramp endpoints are each theme's own red/green
// (--slow-key-color / --fast-key-color), mixed perceptually in OKLCH by the
// browser, so the confidence colors match whatever theme is active and stay
// readable on light themes. Returns a CSS color value for inline styles.
export function confidenceColor(confidence: number): string {
  const pct = Math.max(0, Math.min(1, confidence)) * 100;
  return `color-mix(in oklch, var(--fast-key-color) ${pct.toFixed(1)}%, var(--slow-key-color))`;
}
