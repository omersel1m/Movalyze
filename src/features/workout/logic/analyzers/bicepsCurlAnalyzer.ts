import { ArmPhase, AnalysisResult } from '../../types/analysis.types';
import { BicepsCurlConfig } from '../config/bicepsCurl.config';
import { PoseLandmark, PoseResult } from '../../types/pose.types';
import { getValidLandmark } from '../pose/poseMapper';
import {
  calculateJointAngle,
  calculateUpperArmVerticalAngle,
  calculateUpperArmAngle,
  calculateTorsoLean,
} from '../math/angleUtils';
import {
  WARNING_TO_ERROR_CODE,
  ERROR_CODE_LABELS,
  BicepsErrorCode,
} from '../constants/bicepsErrorCodes';
import { BICEPS_CURL_CONFIG } from '../config/bicepsCurl.config';
import { AnalyzerEngine } from './engine.types';

const WINDOW_SEC  = 1.0;
const MAX_REP_LOG = 6;

// ── Reference (calibration snapshot) — Adım 4 ────────────────────────────────

export interface BicepsArmReference {
  uaVert: number;
  uaAngle?: number;
  torsoLean?: number;
}

export interface BicepsReference {
  left?: BicepsArmReference;
  right?: BicepsArmReference;
  hasHip: boolean;
}

export function captureReference(
  pose: PoseResult,
  config: BicepsCurlConfig,
): BicepsReference | null {
  const v = config.MIN_VISIBILITY;

  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const lElbow    = getValidLandmark(pose, 'leftElbow',     v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const rElbow    = getValidLandmark(pose, 'rightElbow',    v);
  const lHip      = getValidLandmark(pose, 'leftHip',       v);
  const rHip      = getValidLandmark(pose, 'rightHip',      v);

  const leftOk  = !!(lShoulder && lElbow);
  const rightOk = !!(rShoulder && rElbow);
  if (!leftOk && !rightOk) return null;

  const hipOk = !!(lHip || rHip);

  let left: BicepsArmReference | undefined;
  if (leftOk && lShoulder && lElbow) {
    left = { uaVert: calculateUpperArmVerticalAngle(lShoulder, lElbow) };
    if (hipOk) {
      const hip = lHip ?? rHip!;
      left.uaAngle   = calculateUpperArmAngle(lShoulder, lElbow, hip);
      left.torsoLean = calculateTorsoLean(lShoulder, hip);
    }
  }

  let right: BicepsArmReference | undefined;
  if (rightOk && rShoulder && rElbow) {
    right = { uaVert: calculateUpperArmVerticalAngle(rShoulder, rElbow) };
    if (hipOk) {
      const hip = rHip ?? lHip!;
      right.uaAngle   = calculateUpperArmAngle(rShoulder, rElbow, hip);
      right.torsoLean = calculateTorsoLean(rShoulder, hip);
    }
  }

  return { left, right, hasHip: hipOk };
}

// ── Rep accumulator ───────────────────────────────────────────────────────────

export interface RepData {
  minAngle: number;
  maxAngle: number;
  elbowDrifts: number[];
  torsoDrifts: number[];
  uaVertDrifts: number[];
  stabilities: number[];
}

export function makeRepData(): RepData {
  return {
    minAngle: 180, maxAngle: 0,
    elbowDrifts: [], torsoDrifts: [], uaVertDrifts: [], stabilities: [],
  };
}

// ── Rep log entry ─────────────────────────────────────────────────────────────

export interface RepLogEntry {
  arm: 'left' | 'right';
  repNo: number;
  score: number;
  warnings: string[];
}

// ── Per-arm state ─────────────────────────────────────────────────────────────

export interface ArmRepState {
  phase: ArmPhase;
  repCount: number;
  repData: RepData;
  uaHist: Array<{ ts: number; uaVert: number }>;
}

export interface BicepsCurlState {
  left: ArmRepState;
  right: ArmRepState;
}

function makeArmState(): ArmRepState {
  return { phase: 'down', repCount: 0, repData: makeRepData(), uaHist: [] };
}

export const INITIAL_BICEPS_CURL_STATE: BicepsCurlState = {
  left:  makeArmState(),
  right: makeArmState(),
};

// ── Display mode ──────────────────────────────────────────────────────────────

export type BicepsCurlDisplayMode = 'bilateral' | 'alternating' | 'single';

// ── Analysis result ───────────────────────────────────────────────────────────

export interface BicepsCurlAnalysisResult extends AnalysisResult {
  leftRepCount: number;
  rightRepCount: number;
  leftPhase: ArmPhase;
  rightPhase: ArmPhase;
  displayMode: BicepsCurlDisplayMode;
  liveFormScore: number | null;
  lastRepScore: number | null;
  lastRepWarnings: string[];
  repLog: RepLogEntry[];
}

// ── Rep analysis (mirrors analyze_rep() in biceps_mediapipe.py) ───────────────

function analyzeRep(
  data: RepData,
  hasHip: boolean,
  config: BicepsCurlConfig,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const { minAngle, maxAngle } = data;

  if (minAngle < config.ANGLE_OVER_CURL) {
    warnings.push('Kollarınızı fazla kırdınız');
  } else if (minAngle > config.ANGLE_UP + 15) {
    warnings.push('Kollarınızı yeterince kırmıyorsunuz — daha yukarı kaldırın');
  }
  if (maxAngle < config.ANGLE_MIN_EXTEND) {
    warnings.push('Kolu tam açmıyorsunuz — aşağı fazını tamamlayın');
  }

  const avgStab =
    data.stabilities.length > 0
      ? data.stabilities.reduce((s, v) => s + v, 0) / data.stabilities.length
      : 100;
  if (avgStab < 35) {
    warnings.push('Hareket çok sarsıntılı — daha yavaş ve kontrollü yapın');
  } else if (avgStab < 60) {
    warnings.push('Hareketi biraz daha kontrollü yapın');
  }

  if (!hasHip && data.uaVertDrifts.length > 0) {
    const avgUa = data.uaVertDrifts.reduce((s, v) => s + v, 0) / data.uaVertDrifts.length;
    if (avgUa > config.UA_VERT_TOLERANCE) {
      warnings.push('Dirsekleriniz öne/arkaya kaçıyor');
    } else if (avgUa > config.UA_VERT_TOLERANCE * 0.6) {
      warnings.push('Dirseklerinizi biraz daha sabit tutun');
    }
  }

  if (hasHip && data.elbowDrifts.length > 0) {
    const avgElbow = data.elbowDrifts.reduce((s, v) => s + v, 0) / data.elbowDrifts.length;
    const avgTorso =
      data.torsoDrifts.length > 0
        ? data.torsoDrifts.reduce((s, v) => s + v, 0) / data.torsoDrifts.length
        : 0;
    if (avgElbow > config.ELBOW_ANGLE_TOLERANCE) {
      warnings.push('Dirsekleriniz çok fazla öne/arkaya kaçıyor');
    } else if (avgElbow > config.ELBOW_ANGLE_TOLERANCE * 0.6) {
      warnings.push('Dirseklerinizi biraz daha sabit tutun');
    }
    if (avgTorso > config.TORSO_LEAN_TOLERANCE) {
      warnings.push('Gövdenizi çok fazla geriye yatırıyorsunuz — dik durun');
    } else if (avgTorso > config.TORSO_LEAN_TOLERANCE * 0.6) {
      warnings.push('Gövdenizi hafif geriye yatırıyorsunuz');
    }
  }

  let anglePenalty = 0;
  if (maxAngle < config.ANGLE_MIN_EXTEND) {
    anglePenalty += ((config.ANGLE_MIN_EXTEND - maxAngle) / config.ANGLE_MIN_EXTEND) * 30;
  }
  if (minAngle < config.ANGLE_OVER_CURL) {
    anglePenalty += ((config.ANGLE_OVER_CURL - minAngle) / config.ANGLE_OVER_CURL) * 20;
  }

  let score: number;
  if (hasHip && data.elbowDrifts.length > 0) {
    const avgElbow = data.elbowDrifts.reduce((s, v) => s + v, 0) / data.elbowDrifts.length;
    const avgTorso =
      data.torsoDrifts.length > 0
        ? data.torsoDrifts.reduce((s, v) => s + v, 0) / data.torsoDrifts.length
        : 0;
    const elbowForm = Math.max(0, 100 - (avgElbow / config.ELBOW_ANGLE_TOLERANCE) * 100);
    const torsoForm = Math.max(0, 100 - (avgTorso / config.TORSO_LEAN_TOLERANCE) * 100);
    score = Math.max(0, 0.5 * elbowForm + 0.3 * avgStab + 0.2 * torsoForm - anglePenalty);
  } else {
    const avgUa =
      data.uaVertDrifts.length > 0
        ? data.uaVertDrifts.reduce((s, v) => s + v, 0) / data.uaVertDrifts.length
        : 0;
    const uaForm = Math.max(0, 100 - (avgUa / config.UA_VERT_TOLERANCE) * 100);
    score = Math.max(0, 0.6 * uaForm + 0.4 * avgStab - anglePenalty);
  }

  if (warnings.length === 0) {
    warnings.push('Mükemmel form!');
  }

  return { score: Math.round(score * 10) / 10, warnings };
}

// ── Per-frame arm processor (mirrors process_arm() in Python) ─────────────────

interface ArmFrameResult {
  nextState: ArmRepState;
  angle: number | null;
  liveForm: number;
  completedRep: boolean;
  completedRepData?: RepData;
}

function processArm(
  shoulder: PoseLandmark | null,
  elbow: PoseLandmark | null,
  wrist: PoseLandmark | null,
  hip: PoseLandmark | null,
  state: ArmRepState,
  ref: BicepsArmReference | undefined,
  config: BicepsCurlConfig,
  now: number,
): ArmFrameResult {
  if (!shoulder || !elbow || !wrist) {
    return { nextState: state, angle: null, liveForm: 0, completedRep: false };
  }

  const angle = calculateJointAngle(shoulder, elbow, wrist);

  const repData: RepData = {
    minAngle: Math.min(state.repData.minAngle, angle),
    maxAngle: Math.max(state.repData.maxAngle, angle),
    elbowDrifts:  [...state.repData.elbowDrifts],
    torsoDrifts:  [...state.repData.torsoDrifts],
    uaVertDrifts: [...state.repData.uaVertDrifts],
    stabilities:  [...state.repData.stabilities],
  };

  // FPS-independent windowed stability
  const uaVert = calculateUpperArmVerticalAngle(shoulder, elbow);
  const cutoff  = now - WINDOW_SEC;
  const uaHist  = [...state.uaHist.filter(e => e.ts >= cutoff), { ts: now, uaVert }];

  const variance =
    uaHist.length >= 3
      ? (() => {
          const vals = uaHist.map(e => e.uaVert);
          const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
          return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
        })()
      : 0;
  const stability = Math.max(0, 100 - (variance / 25) * 100);

  const refUaVert  = ref?.uaVert ?? uaVert;
  const uaVertDrift = Math.abs(uaVert - refUaVert);
  repData.uaVertDrifts.push(uaVertDrift);
  repData.stabilities.push(stability);

  // Hip-based drift (full analysis) vs fallback
  let liveForm: number;
  if (hip && ref?.uaAngle !== undefined && ref?.torsoLean !== undefined) {
    const uaAngle    = calculateUpperArmAngle(shoulder, elbow, hip);
    const torsoLean  = calculateTorsoLean(shoulder, hip);
    const elbowDrift = Math.abs(uaAngle   - ref.uaAngle);
    const torsoDrift = Math.abs(torsoLean - ref.torsoLean);
    repData.elbowDrifts.push(elbowDrift);
    repData.torsoDrifts.push(torsoDrift);
    const elbowForm = Math.max(0, 100 - (elbowDrift / config.ELBOW_ANGLE_TOLERANCE) * 100);
    const torsoForm = Math.max(0, 100 - (torsoDrift / config.TORSO_LEAN_TOLERANCE)  * 100);
    liveForm = 0.5 * elbowForm + 0.3 * stability + 0.2 * torsoForm;
  } else {
    const uaForm = Math.max(0, 100 - (uaVertDrift / config.UA_VERT_TOLERANCE) * 100);
    liveForm = 0.6 * uaForm + 0.4 * stability;
  }

  // Phase transition — rep counted at curl peak (down→up), analyzed at extension (up→down)
  let { phase, repCount } = state;
  let completedRep = false;

  if (phase === 'down' && angle < config.ANGLE_UP) {
    repCount += 1;
    phase = 'up';
  } else if (phase === 'up' && angle > config.ANGLE_DOWN) {
    phase = 'down';
    completedRep = true;
  }

  return {
    nextState: {
      phase,
      repCount,
      repData: completedRep ? makeRepData() : repData,
      uaHist,
    },
    angle,
    liveForm,
    completedRep,
    completedRepData: completedRep ? repData : undefined,
  };
}

// ── Display mode resolver ─────────────────────────────────────────────────────

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
  reference: BicepsReference | null,
  config: BicepsCurlConfig,
  now: number,              // seconds — Date.now() / 1000
  prevRepLog: RepLogEntry[],
): {
  result: BicepsCurlAnalysisResult;
  nextState: BicepsCurlState;
  nextRepLog: RepLogEntry[];
} {
  const v = config.MIN_VISIBILITY;

  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const lElbow    = getValidLandmark(pose, 'leftElbow',     v);
  const lWrist    = getValidLandmark(pose, 'leftWrist',     v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const rElbow    = getValidLandmark(pose, 'rightElbow',    v);
  const rWrist    = getValidLandmark(pose, 'rightWrist',    v);
  const lHip      = getValidLandmark(pose, 'leftHip',       v);
  const rHip      = getValidLandmark(pose, 'rightHip',      v);

  // Use same-side hip first, fall back to opposite (mirrors Python's hip_ok check)
  const leftHip  = lHip ?? rHip;
  const rightHip = rHip ?? lHip;

  const leftFrame  = processArm(lShoulder, lElbow, lWrist, leftHip,  previousState.left,  reference?.left,  config, now);
  const rightFrame = processArm(rShoulder, rElbow, rWrist, rightHip, previousState.right, reference?.right, config, now);

  // Update rep log with any newly completed reps
  let nextRepLog = [...prevRepLog];
  if (leftFrame.completedRep && leftFrame.completedRepData) {
    const hasHip = leftFrame.completedRepData.elbowDrifts.length > 0;
    const { score, warnings } = analyzeRep(leftFrame.completedRepData, hasHip, config);
    nextRepLog.push({ arm: 'left', repNo: leftFrame.nextState.repCount, score, warnings });
  }
  if (rightFrame.completedRep && rightFrame.completedRepData) {
    const hasHip = rightFrame.completedRepData.elbowDrifts.length > 0;
    const { score, warnings } = analyzeRep(rightFrame.completedRepData, hasHip, config);
    nextRepLog.push({ arm: 'right', repNo: rightFrame.nextState.repCount, score, warnings });
  }
  if (nextRepLog.length > MAX_REP_LOG) {
    nextRepLog = nextRepLog.slice(nextRepLog.length - MAX_REP_LOG);
  }

  const lastEntry = nextRepLog.length > 0 ? nextRepLog[nextRepLog.length - 1] : null;

  // Live form score: average of visible arms
  const liveFormVals: number[] = [];
  if (leftFrame.angle  !== null) liveFormVals.push(leftFrame.liveForm);
  if (rightFrame.angle !== null) liveFormVals.push(rightFrame.liveForm);
  const liveFormScore =
    liveFormVals.length > 0
      ? Math.round((liveFormVals.reduce((s, v) => s + v, 0) / liveFormVals.length) * 10) / 10
      : null;

  const leftVisible  = leftFrame.angle  !== null;
  const rightVisible = rightFrame.angle !== null;
  const nextLeft  = leftFrame.nextState;
  const nextRight = rightFrame.nextState;

  const result: BicepsCurlAnalysisResult = {
    exerciseId:      'biceps_curl',
    repCount:        Math.max(nextLeft.repCount, nextRight.repCount),
    currentPhase:    'tracking',
    formScore:       liveFormScore !== null ? Math.round(liveFormScore) : null,
    warnings:        lastEntry?.warnings ?? [],
    angles:          { leftElbow: leftFrame.angle, rightElbow: rightFrame.angle },
    isPoseValid:     leftVisible || rightVisible,
    leftRepCount:    nextLeft.repCount,
    rightRepCount:   nextRight.repCount,
    leftPhase:       nextLeft.phase,
    rightPhase:      nextRight.phase,
    displayMode:     resolveDisplayMode(leftVisible, rightVisible, nextLeft.repCount, nextRight.repCount),
    liveFormScore,
    lastRepScore:    lastEntry?.score   ?? null,
    lastRepWarnings: lastEntry?.warnings ?? [],
    repLog:          nextRepLog,
  };

  return { result, nextState: { left: nextLeft, right: nextRight }, nextRepLog };
}

// ── Session summary (consumed by the generic workout save layer) ──────────────
// Aggregates a full (uncapped) session rep log into the metrics needed for a
// WorkoutSession record + session_errors. Pure: no algorithm change.

const PERFECT_FORM = 'Mükemmel form!';

export interface BicepsErrorBucket {
  errorCode: BicepsErrorCode;
  count: number;
}

export interface BicepsSessionSummary {
  totalReps: number;
  leftReps: number;
  rightReps: number;
  correctReps: number;
  avgFormScore: number | null;
  bestFormScore: number | null;
  worstFormScore: number | null;
  repLog: RepLogEntry[];
  errors: BicepsErrorBucket[];
  topWarnings: Array<{ label: string; count: number }>;
}

function isPerfect(warnings: string[]): boolean {
  return warnings.length === 0 || (warnings.length === 1 && warnings[0] === PERFECT_FORM);
}

export function summarizeBicepsSession(fullRepLog: RepLogEntry[]): BicepsSessionSummary {
  const totalReps = fullRepLog.length;
  const leftReps  = fullRepLog.filter(r => r.arm === 'left').length;
  const rightReps = fullRepLog.filter(r => r.arm === 'right').length;
  const correctReps = fullRepLog.filter(r => isPerfect(r.warnings)).length;

  const scores = fullRepLog.map(r => r.score);
  const avgFormScore =
    scores.length > 0
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null;
  const bestFormScore  = scores.length > 0 ? Math.max(...scores) : null;
  const worstFormScore = scores.length > 0 ? Math.min(...scores) : null;

  const errorCounts = new Map<BicepsErrorCode, number>();
  const labelCounts = new Map<string, number>();
  for (const rep of fullRepLog) {
    for (const w of rep.warnings) {
      if (w === PERFECT_FORM) continue;
      const code = WARNING_TO_ERROR_CODE[w];
      if (!code) continue;
      errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
      const label = ERROR_CODE_LABELS[code];
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
  }

  const errors: BicepsErrorBucket[] = [...errorCounts.entries()]
    .map(([errorCode, count]) => ({ errorCode, count }))
    .sort((a, b) => b.count - a.count);

  const topWarnings = [...labelCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totalReps, leftReps, rightReps, correctReps,
    avgFormScore, bestFormScore, worstFormScore,
    repLog: fullRepLog, errors, topWarnings,
  };
}

// ── Engine — plugs into the generic hook / camera screen / save layer ─────────

export const bicepsCurlEngine: AnalyzerEngine = {
  config: BICEPS_CURL_CONFIG,
  initialState: INITIAL_BICEPS_CURL_STATE,
  leftLabel: 'Sol Dirsek',
  rightLabel: 'Sağ Dirsek',
  captureReference: (pose, config) => captureReference(pose, config as BicepsCurlConfig),
  analyze: (pose, prevState, reference, config, now, prevRepLog) =>
    analyzeBicepsCurl(
      pose,
      prevState as BicepsCurlState,
      reference as BicepsReference | null,
      config as BicepsCurlConfig,
      now,
      prevRepLog,
    ),
  summarize: summarizeBicepsSession,
  getLeftAngle:  result => result.angles.leftElbow  ?? null,
  getRightAngle: result => result.angles.rightElbow ?? null,
  describeReference: reference =>
    (reference as BicepsReference | null)?.hasHip ? 'REF + KALÇA' : 'REF',
};
