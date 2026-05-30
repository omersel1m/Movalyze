import { PoseLandmark, PoseResult, LANDMARK_NAMES } from '../../types/pose.types';

// EMA: smoothed = alpha * current + (1 - alpha) * previous
// alpha=1 → no smoothing, alpha→0 → max smoothing / lag
export function smoothPose(
  current: PoseResult,
  previous: PoseResult | null,
  alpha: number,
): PoseResult {
  if (previous === null) return current;

  const smoothed: PoseResult = { raw: current.raw };

  for (const name of LANDMARK_NAMES) {
    const cur = current[name];
    const prev = previous[name];

    if (!cur) {
      if (prev) (smoothed as Record<string, unknown>)[name] = prev;
      continue;
    }
    if (!prev) {
      (smoothed as Record<string, unknown>)[name] = cur;
      continue;
    }

    const lm: PoseLandmark = {
      x: alpha * cur.x + (1 - alpha) * prev.x,
      y: alpha * cur.y + (1 - alpha) * prev.y,
      z: alpha * cur.z + (1 - alpha) * prev.z,
      visibility: alpha * cur.visibility + (1 - alpha) * prev.visibility,
    };
    (smoothed as Record<string, unknown>)[name] = lm;
  }

  return smoothed;
}
