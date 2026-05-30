import { PoseLandmark, PoseResult, LandmarkName } from '../../types/pose.types';

const DEFAULT_MIN_VISIBILITY = 0.3;

export function getValidLandmark(
  pose: PoseResult,
  name: LandmarkName,
  minVisibility: number = DEFAULT_MIN_VISIBILITY,
): PoseLandmark | null {
  const lm = pose[name];
  if (!lm || lm.visibility < minVisibility) return null;
  return lm;
}

export function isPoseValid(
  pose: PoseResult,
  required: LandmarkName[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY,
): boolean {
  return required.every(name => getValidLandmark(pose, name, minVisibility) !== null);
}
