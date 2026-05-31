// Confidence -> color ramp (red = slow, green = at/above target), matching
// keybr's --slow-key-color (#cc0000) -> --fast-key-color (#60d788).

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const SLOW = hexToRgb('#cc0000');
const FAST = hexToRgb('#60d788');

export function confidenceColor(confidence: number): string {
  const t = Math.max(0, Math.min(1, confidence));
  const r = Math.round(SLOW.r + (FAST.r - SLOW.r) * t);
  const g = Math.round(SLOW.g + (FAST.g - SLOW.g) * t);
  const b = Math.round(SLOW.b + (FAST.b - SLOW.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
