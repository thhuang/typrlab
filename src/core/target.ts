// Speed <-> time conversions and the per-key confidence ratio.
// confidence = targetTimePerChar / yourTimePerChar  (>= 1 means at/above target).

/** Convert a speed in CPM to a target time-per-character in ms. */
export function speedToTime(cpm: number): number {
  return 1000 / (cpm / 60);
}

/** Convert a time-per-character in ms to a speed in CPM. */
export function timeToSpeed(ms: number): number {
  return ms <= 0 ? 0 : 60 * (1000 / ms);
}

/** Dimensionless ratio of your speed to the target speed for one key. */
export function confidence(timeToType: number, targetSpeed: number): number {
  if (!Number.isFinite(timeToType) || timeToType <= 0) return 0;
  return speedToTime(targetSpeed) / timeToType;
}
