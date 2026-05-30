import { PoseResult } from '../../types/pose.types';
import { AnalysisResult, AnalyzerState } from '../../types/analysis.types';
import { BicepsCurlConfig } from '../config/bicepsCurl.config';
import { getValidLandmark } from '../pose/poseMapper';
import { calculateJointAngle } from '../math/angleUtils';

export interface BicepsCurlState extends AnalyzerState {
  // Expanded in future prompts: reference data, phase per arm, rep history
}

export const INITIAL_BICEPS_CURL_STATE: BicepsCurlState = {
  phase: 'idle',
  repCount: 0,
};

export function analyzeBicepsCurl(
  pose: PoseResult,
  previousState: BicepsCurlState,
  config: BicepsCurlConfig,
): { result: AnalysisResult; nextState: BicepsCurlState } {
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

  const result: AnalysisResult = {
    exerciseId: 'biceps_curl',
    repCount: previousState.repCount,
    currentPhase: previousState.phase,
    formScore: null,
    warnings: [],
    angles: {
      leftElbow: leftElbowAngle,
      rightElbow: rightElbowAngle,
    },
    isPoseValid: leftElbowAngle !== null || rightElbowAngle !== null,
  };

  return { result, nextState: previousState };
}
