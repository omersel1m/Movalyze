import { ArmPhase, AnalysisResult } from '../../types/analysis.types';
import { BicepsCurlConfig } from '../config/bicepsCurl.config';
import { PoseResult } from '../../types/pose.types';
import { getValidLandmark } from '../pose/poseMapper';
import { calculateJointAngle } from '../math/angleUtils';

// ── Per-arm state ─────────────────────────────────────────────────────────────

export interface ArmRepState {
  phase: ArmPhase;
  repCount: number;
}

export interface BicepsCurlState {
  left: ArmRepState;
  right: ArmRepState;
}

export const INITIAL_BICEPS_CURL_STATE: BicepsCurlState = {
  left:  { phase: 'down', repCount: 0 },
  right: { phase: 'down', repCount: 0 },
};

// ── Result type ───────────────────────────────────────────────────────────────

export type BicepsCurlDisplayMode = 'bilateral' | 'alternating' | 'single';

export interface BicepsCurlAnalysisResult extends AnalysisResult {
  leftRepCount: number;
  rightRepCount: number;
  leftPhase: ArmPhase;
  rightPhase: ArmPhase;
  displayMode: BicepsCurlDisplayMode;
}

// ── Phase transition (mirrors process_arm() in biceps_mediapipe.py) ───────────
// down → up : angle drops below ANGLE_UP  → rep counted at the curl peak
// up   → down: angle rises above ANGLE_DOWN → rep cycle complete

function processArm(
  angle: number | null,
  state: ArmRepState,
  config: BicepsCurlConfig,
): ArmRepState {
  if (angle === null) return state;

  let { phase, repCount } = state;

  if (phase === 'down' && angle < config.ANGLE_UP) {
    repCount += 1;
    phase = 'up';
  } else if (phase === 'up' && angle > config.ANGLE_DOWN) {
    phase = 'down';
  }

  return { phase, repCount };
}

function resolveDisplayMode(
  leftVisible: boolean,
  rightVisible: boolean,
  leftCount: number,
  rightCount: number,
): BicepsCurlDisplayMode {
  if (leftVisible && rightVisible) {
    return leftCount === rightCount ? 'bilateral' : 'alternating';
  }
  return 'single';
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

export function analyzeBicepsCurl(
  pose: PoseResult,
  previousState: BicepsCurlState,
  config: BicepsCurlConfig,
): { result: BicepsCurlAnalysisResult; nextState: BicepsCurlState } {
  const v = config.MIN_VISIBILITY;

  const leftShoulder  = getValidLandmark(pose, 'leftShoulder',  v);
  const leftElbow     = getValidLandmark(pose, 'leftElbow',     v);
  const leftWrist     = getValidLandmark(pose, 'leftWrist',     v);

  const rightShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const rightElbow    = getValidLandmark(pose, 'rightElbow',    v);
  const rightWrist    = getValidLandmark(pose, 'rightWrist',    v);

  const leftElbowAngle =
    leftShoulder && leftElbow && leftWrist
      ? calculateJointAngle(leftShoulder, leftElbow, leftWrist)
      : null;

  const rightElbowAngle =
    rightShoulder && rightElbow && rightWrist
      ? calculateJointAngle(rightShoulder, rightElbow, rightWrist)
      : null;

  const nextLeft  = processArm(leftElbowAngle,  previousState.left,  config);
  const nextRight = processArm(rightElbowAngle, previousState.right, config);

  const leftVisible  = leftElbowAngle  !== null;
  const rightVisible = rightElbowAngle !== null;

  const displayMode = resolveDisplayMode(
    leftVisible, rightVisible,
    nextLeft.repCount, nextRight.repCount,
  );

  const result: BicepsCurlAnalysisResult = {
    exerciseId:   'biceps_curl',
    repCount:     Math.max(nextLeft.repCount, nextRight.repCount),
    currentPhase: 'tracking',
    formScore:    null,
    warnings:     [],
    angles: {
      leftElbow:  leftElbowAngle,
      rightElbow: rightElbowAngle,
    },
    isPoseValid:   leftVisible || rightVisible,
    leftRepCount:  nextLeft.repCount,
    rightRepCount: nextRight.repCount,
    leftPhase:     nextLeft.phase,
    rightPhase:    nextRight.phase,
    displayMode,
  };

  return {
    result,
    nextState: { left: nextLeft, right: nextRight },
  };
}
