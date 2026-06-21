import { ArmPhase } from '../../types/analysis.types';
import { KneeRaiseConfig, KNEE_RAISE_CONFIG } from '../config/kneeRaise.config';
import { PoseLandmark, PoseResult } from '../../types/pose.types';
import { getValidLandmark } from '../pose/poseMapper';
import {
  calculateJointAngle,
  calculateHipTilt,
  calculateTorsoDepthOffset,
  midpoint,
} from '../math/angleUtils';
import {
  AnalyzerEngine,
  CommonAnalysisResult,
  DisplayMode,
  RepLogEntry,
} from './engine.types';
import { summarizeSession, PERFECT_FORM } from './sessionSummary';
import {
  WARNING_TO_ERROR_CODE,
  ERROR_CODE_LABELS,
} from '../constants/kneeRaiseErrorCodes';

const MAX_REP_LOG = 6;

// ── Reference (standing calibration snapshot) ─────────────────────────────────

export interface KneeRaiseReference {
  torsoDepthBase: number; // shoulderMid.z − hipMid.z while standing (per-person offset)
  hasHip: boolean;
}

export function captureReference(
  pose: PoseResult,
  config: KneeRaiseConfig,
): KneeRaiseReference | null {
  const v = config.MIN_VISIBILITY;
  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const lHip      = getValidLandmark(pose, 'leftHip',  v);
  const rHip      = getValidLandmark(pose, 'rightHip', v);

  if (!lShoulder || !rShoulder || !lHip || !rHip) return null;

  const shoulderMid = midpoint(lShoulder, rShoulder);
  const hipMid      = midpoint(lHip, rHip);
  return { torsoDepthBase: calculateTorsoDepthOffset(shoulderMid, hipMid), hasHip: true };
}

// ── Rep accumulator ───────────────────────────────────────────────────────────

export interface KneeRepData {
  minHip: number;        // smallest hip-flexion angle reached (top of the raise)
  maxHip: number;
  torsoDevs: number[];   // depth offset − baseline samples (signed)
  hipTilts: number[];
  supportKnees: number[]; // support-leg knee angle samples
  velocities: number[];   // |Δhip| / Δt (deg/sec)
  holdSec: number;        // accumulated time spent near the top
}

function makeRepData(): KneeRepData {
  return { minHip: 180, maxHip: 0, torsoDevs: [], hipTilts: [], supportKnees: [], velocities: [], holdSec: 0 };
}

// ── Per-leg state ─────────────────────────────────────────────────────────────

export interface LegState {
  phase: ArmPhase; // 'down' | 'up'
  repCount: number;
  repData: KneeRepData;
  lastHip: number | null;
  lastTs: number | null;
}

export interface KneeRaiseState {
  left: LegState;
  right: LegState;
}

function makeLegState(): LegState {
  return { phase: 'down', repCount: 0, repData: makeRepData(), lastHip: null, lastTs: null };
}

export const INITIAL_KNEE_RAISE_STATE: KneeRaiseState = {
  left:  makeLegState(),
  right: makeLegState(),
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface KneeRaiseAnalysisResult extends CommonAnalysisResult {}

// ── Rep analysis (warnings + 0-100 form score via penalties) ──────────────────

function mean(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

function analyzeRep(
  data: KneeRepData,
  config: KneeRaiseConfig,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let penalty = 0;

  // H1 — knee didn't rise enough (best/min hip angle stayed above the ideal target)
  if (data.minHip > config.HIP_FLEXION_TARGET) {
    warnings.push('Dizini daha yukarı kaldır, uyluğun yere paralel olsun');
    penalty += Math.min(35, (data.minHip - config.HIP_FLEXION_TARGET) * 1.2);
  }

  // H2 / H3 — torso lean (depth offset vs standing baseline)
  const avgTorso = mean(data.torsoDevs);
  if (avgTorso > config.TORSO_DEPTH_TOLERANCE) {
    warnings.push('Geriye yaslanma; gövdeni dik tut, core\'unu sık');
    penalty += 20;
  } else if (avgTorso < -config.TORSO_DEPTH_TOLERANCE) {
    warnings.push('Öne eğilme, omurganı nötr tut');
    penalty += 20;
  }

  // H4 — hip twist / lateral drop
  if (mean(data.hipTilts) > config.HIP_TILT_TOLERANCE) {
    warnings.push('Kalçalarını düz tut, yana eğilme');
    penalty += 15;
  }

  // H5 — momentum: too fast, or no pause at the top
  const maxVel = data.velocities.length > 0 ? Math.max(...data.velocities) : 0;
  if (maxVel > config.MAX_ANGLE_VELOCITY || data.holdSec < config.TOP_HOLD_MIN_SEC) {
    warnings.push('Daha yavaş ve kontrollü; tepede 1 sn dur');
    penalty += 15;
  }

  // H6 — support knee locked straight
  if (mean(data.supportKnees) > config.SUPPORT_KNEE_LOCK) {
    warnings.push('Destek dizini kilitleme, hafif bük');
    penalty += 10;
  }

  const score = Math.max(0, 100 - penalty);
  if (warnings.length === 0) warnings.push(PERFECT_FORM);
  return { score: Math.round(score * 10) / 10, warnings };
}

// Instant (per-frame) form quality for the active leg — same penalty shape.
function instantForm(
  hipAngle: number,
  torsoDev: number,
  hipTilt: number,
  supportKnee: number,
  config: KneeRaiseConfig,
): number {
  let p = 0;
  if (hipAngle > config.HIP_FLEXION_TARGET) {
    p += Math.min(35, (hipAngle - config.HIP_FLEXION_TARGET) * 1.2);
  }
  if (Math.abs(torsoDev) > config.TORSO_DEPTH_TOLERANCE) p += 20;
  if (hipTilt > config.HIP_TILT_TOLERANCE) p += 15;
  if (supportKnee > config.SUPPORT_KNEE_LOCK) p += 10;
  return Math.max(0, 100 - p);
}

// ── Per-leg frame processor ───────────────────────────────────────────────────

interface LegFrameResult {
  nextState: LegState;
  hipAngle: number | null;
  liveForm: number;
  completedRep: boolean;
  completedRepData?: KneeRepData;
}

function processLeg(
  shoulder: PoseLandmark | null,
  hip: PoseLandmark | null,
  knee: PoseLandmark | null,
  ankle: PoseLandmark | null,
  supportKneeAngle: number | null,
  torsoDev: number,
  hipTilt: number,
  state: LegState,
  config: KneeRaiseConfig,
  now: number,
): LegFrameResult {
  if (!shoulder || !hip || !knee) {
    return { nextState: state, hipAngle: null, liveForm: 0, completedRep: false };
  }

  const hipAngle = calculateJointAngle(shoulder, hip, knee);

  const repData: KneeRepData = {
    minHip: Math.min(state.repData.minHip, hipAngle),
    maxHip: Math.max(state.repData.maxHip, hipAngle),
    torsoDevs:    [...state.repData.torsoDevs],
    hipTilts:     [...state.repData.hipTilts],
    supportKnees: [...state.repData.supportKnees],
    velocities:   [...state.repData.velocities],
    holdSec:      state.repData.holdSec,
  };

  // Velocity (deg/sec), frame-rate independent
  if (state.lastHip !== null && state.lastTs !== null && now > state.lastTs) {
    repData.velocities.push(Math.abs(hipAngle - state.lastHip) / (now - state.lastTs));
  }

  // Accumulate form metrics + hold time while the leg is raised
  const isRaised = hipAngle < config.HIP_FLEXION_DOWN;
  if (isRaised) {
    repData.torsoDevs.push(torsoDev);
    repData.hipTilts.push(hipTilt);
    if (supportKneeAngle !== null) repData.supportKnees.push(supportKneeAngle);
    const nearTop = hipAngle < config.HIP_FLEXION_TARGET + config.HIP_TOP_BAND;
    if (nearTop && state.lastTs !== null && now > state.lastTs) {
      repData.holdSec += now - state.lastTs;
    }
  }

  const liveForm = instantForm(hipAngle, torsoDev, hipTilt, supportKneeAngle ?? 0, config);

  // Phase transition — rep credited at the top (down→up), analyzed on return (up→down)
  let { phase, repCount } = state;
  let completedRep = false;
  if (phase === 'down' && hipAngle < config.HIP_FLEXION_UP) {
    repCount += 1;
    phase = 'up';
  } else if (phase === 'up' && hipAngle > config.HIP_FLEXION_DOWN) {
    phase = 'down';
    completedRep = true;
  }

  return {
    nextState: {
      phase,
      repCount,
      repData: completedRep ? makeRepData() : repData,
      lastHip: hipAngle,
      lastTs: now,
    },
    hipAngle,
    liveForm,
    completedRep,
    completedRepData: completedRep ? repData : undefined,
  };
}

function resolveDisplayMode(
  leftVisible: boolean,
  rightVisible: boolean,
  leftCount: number,
  rightCount: number,
): DisplayMode {
  if (leftVisible && rightVisible) {
    return leftCount === rightCount ? 'bilateral' : 'alternating';
  }
  return 'single';
}

// ── Main analyzer ─────────────────────────────────────────────────────────────

export function analyzeKneeRaise(
  pose: PoseResult,
  previousState: KneeRaiseState,
  reference: KneeRaiseReference | null,
  config: KneeRaiseConfig,
  now: number,
  prevRepLog: RepLogEntry[],
): { result: KneeRaiseAnalysisResult; nextState: KneeRaiseState; nextRepLog: RepLogEntry[] } {
  const v = config.MIN_VISIBILITY;

  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const lHip      = getValidLandmark(pose, 'leftHip',   v);
  const rHip      = getValidLandmark(pose, 'rightHip',  v);
  const lKnee     = getValidLandmark(pose, 'leftKnee',  v);
  const rKnee     = getValidLandmark(pose, 'rightKnee', v);
  const lAnkle    = getValidLandmark(pose, 'leftAnkle',  v);
  const rAnkle    = getValidLandmark(pose, 'rightAnkle', v);

  // Global torso/hip metrics (depth offset relative to standing baseline)
  let torsoDev = 0;
  let hipTilt = 0;
  if (lShoulder && rShoulder && lHip && rHip) {
    const shoulderMid = midpoint(lShoulder, rShoulder);
    const hipMid      = midpoint(lHip, rHip);
    torsoDev = calculateTorsoDepthOffset(shoulderMid, hipMid) - (reference?.torsoDepthBase ?? 0);
    hipTilt  = calculateHipTilt(lHip, rHip);
  }

  // Support-leg knee angles (the OTHER leg props you up)
  const leftKneeAngle  = lHip && lKnee && lAnkle ? calculateJointAngle(lHip, lKnee, lAnkle) : null;
  const rightKneeAngle = rHip && rKnee && rAnkle ? calculateJointAngle(rHip, rKnee, rAnkle) : null;

  const leftFrame  = processLeg(lShoulder, lHip, lKnee, lAnkle, rightKneeAngle, torsoDev, hipTilt, previousState.left,  config, now);
  const rightFrame = processLeg(rShoulder, rHip, rKnee, rAnkle, leftKneeAngle,  torsoDev, hipTilt, previousState.right, config, now);

  let nextRepLog = [...prevRepLog];
  if (leftFrame.completedRep && leftFrame.completedRepData) {
    const { score, warnings } = analyzeRep(leftFrame.completedRepData, config);
    nextRepLog.push({ arm: 'left', repNo: leftFrame.nextState.repCount, score, warnings });
  }
  if (rightFrame.completedRep && rightFrame.completedRepData) {
    const { score, warnings } = analyzeRep(rightFrame.completedRepData, config);
    nextRepLog.push({ arm: 'right', repNo: rightFrame.nextState.repCount, score, warnings });
  }
  if (nextRepLog.length > MAX_REP_LOG) {
    nextRepLog = nextRepLog.slice(nextRepLog.length - MAX_REP_LOG);
  }

  const lastEntry = nextRepLog.length > 0 ? nextRepLog[nextRepLog.length - 1] : null;

  // Live form: the active (more-raised) visible leg
  const liveFormVals: Array<{ angle: number; form: number }> = [];
  if (leftFrame.hipAngle  !== null) liveFormVals.push({ angle: leftFrame.hipAngle,  form: leftFrame.liveForm });
  if (rightFrame.hipAngle !== null) liveFormVals.push({ angle: rightFrame.hipAngle, form: rightFrame.liveForm });
  const active = liveFormVals.sort((a, b) => a.angle - b.angle)[0];
  const liveFormScore = active ? Math.round(active.form * 10) / 10 : null;

  const leftVisible  = leftFrame.hipAngle  !== null;
  const rightVisible = rightFrame.hipAngle !== null;
  const nextLeft  = leftFrame.nextState;
  const nextRight = rightFrame.nextState;

  const result: KneeRaiseAnalysisResult = {
    exerciseId:      'knee_raise',
    repCount:        nextLeft.repCount + nextRight.repCount,
    currentPhase:    'tracking',
    formScore:       liveFormScore !== null ? Math.round(liveFormScore) : null,
    warnings:        lastEntry?.warnings ?? [],
    angles:          { leftHip: leftFrame.hipAngle, rightHip: rightFrame.hipAngle },
    isPoseValid:     leftVisible || rightVisible,
    leftRepCount:    nextLeft.repCount,
    rightRepCount:   nextRight.repCount,
    leftPhase:       nextLeft.phase,
    rightPhase:      nextRight.phase,
    displayMode:     resolveDisplayMode(leftVisible, rightVisible, nextLeft.repCount, nextRight.repCount),
    liveFormScore,
    lastRepScore:    lastEntry?.score    ?? null,
    lastRepWarnings: lastEntry?.warnings ?? [],
    repLog:          nextRepLog,
  };

  return { result, nextState: { left: nextLeft, right: nextRight }, nextRepLog };
}

// ── Session summary (delegates to shared summarizer) ──────────────────────────

export function summarizeKneeRaiseSession(fullRepLog: RepLogEntry[]) {
  return summarizeSession(fullRepLog, WARNING_TO_ERROR_CODE, ERROR_CODE_LABELS);
}

// ── Engine — plugs into the generic hook / camera screen / save layer ─────────

export const kneeRaiseEngine: AnalyzerEngine = {
  config: KNEE_RAISE_CONFIG,
  initialState: INITIAL_KNEE_RAISE_STATE,
  leftLabel: 'Sol Bacak',
  rightLabel: 'Sağ Bacak',
  captureReference: (pose, config) => captureReference(pose, config as KneeRaiseConfig),
  analyze: (pose, prevState, reference, config, now, prevRepLog) =>
    analyzeKneeRaise(
      pose,
      prevState as KneeRaiseState,
      reference as KneeRaiseReference | null,
      config as KneeRaiseConfig,
      now,
      prevRepLog,
    ),
  summarize: summarizeKneeRaiseSession,
  getLeftAngle:  result => result.angles.leftHip  ?? null,
  getRightAngle: result => result.angles.rightHip ?? null,
  describeReference: () => 'REF',
};
