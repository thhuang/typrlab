// Pure lesson-level metric helpers, kept free of any I/O or engine state.
import type { LessonResult } from './types';

export interface Metrics {
  speed: number;
  accuracy: number;
  complexity: number;
  score: number;
}

/** keybr's lesson metrics: speed (CPM), accuracy, complexity (>=3), score. */
export function computeMetrics(
  length: number,
  time: number,
  errors: number,
  distinct: number,
): Metrics {
  const speed = time > 0 ? (length / (time / 1000)) * 60 : 0;
  const accuracy = length > 0 ? Math.max(0, (length - errors) / length) : 1;
  const complexity = Math.max(3, distinct);
  const score = ((speed * complexity) / (errors + 1)) * (length / 50);
  return { speed, accuracy, complexity, score };
}

/** keybr only counts a result toward long-term stats if it clears these gates. */
export function isValidResult(r: LessonResult): boolean {
  return r.length >= 10 && r.time >= 1000 && r.complexity >= 3 && r.speed >= 1;
}
