// Lightweight learning-rate prediction. keybr fits a polynomial regression over
// the last ~30 samples; for the MVP we use a linear fit, which is enough to
// surface an actionable "lessons until this key reaches target" estimate.

export interface Trend {
  slope: number;
  intercept: number;
  r2: number;
}

/** Ordinary least squares of ys against their indices (0..n-1). */
export function linreg(ys: number[]): Trend | null {
  const n = ys.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = ys[i]!;
    sx += i;
    sy += y;
    sxx += i * i;
    sxy += i * y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;

  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const y = ys[i]!;
    const fit = slope * i + intercept;
    ssTot += (y - meanY) ** 2;
    ssRes += (y - fit) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/**
 * Estimate how many more lessons until a key's speed reaches `targetSpeed`.
 * `speeds` are per-lesson speeds (CPM) oldest-first. Returns:
 *   0     already at/above target,
 *   1..N  projected lessons ahead,
 *   null  not enough data / not improving / fit too noisy / >maxAhead out.
 */
export function projectLessonsToTarget(
  speeds: number[],
  targetSpeed: number,
  maxAhead = 50,
): number | null {
  const ys = speeds.slice(-20);
  if (ys.length < 5) return null;
  const t = linreg(ys);
  if (!t) return null;
  const n = ys.length;
  const current = t.slope * (n - 1) + t.intercept;
  if (current >= targetSpeed) return 0;
  if (t.slope <= 0) return null; // not improving
  if (t.r2 < 0.25) return null; // too noisy to trust
  for (let i = 1; i <= maxAhead; i++) {
    if (t.slope * (n - 1 + i) + t.intercept >= targetSpeed) return i;
  }
  return null;
}
