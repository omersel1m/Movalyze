import { ArmPhase } from '../../types/analysis.types';
import { ShoulderAbductionConfig, SHOULDER_ABDUCTION_CONFIG } from '../config/shoulderAbduction.config';
import { PoseLandmark, PoseResult } from '../../types/pose.types';
import { getValidLandmark } from '../pose/poseMapper';
import {
  calculateJointAngle,
  calculateUpperArmVerticalAngle,
  calculateTorsoLean,
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
} from '../constants/shoulderAbductionErrorCodes';

const MAX_REP_LOG = 6;

// ── Reference (standing, arms-down calibration) ───────────────────────────────

export interface ShoulderArmReference {
  shoulderYBase: number; // shoulder.y while standing (for shrug detection)
  torsoLen: number;      // |shoulder.y − hip.y|, normalizes shrug
}

export interface ShoulderAbductionReference {
  left?: ShoulderArmReference;
  right?: ShoulderArmReference;
  hasHip: boolean;
}

export function captureReference(
  pose: PoseResult,
  config: ShoulderAbductionConfig,
): ShoulderAbductionReference | null {
  const v = config.MIN_VISIBILITY;
  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const lHip      = getValidLandmark(pose, 'leftHip',  v);
  const rHip      = getValidLandmark(pose, 'rightHip', v);

  const arm = (shoulder: PoseLandmark | null, hip: PoseLandmark | null): ShoulderArmReference | undefined => {
    if (!shoulder || !hip) return undefined;
    return { shoulderYBase: shoulder.y, torsoLen: Math.max(Math.abs(shoulder.y - hip.y), 1e-3) };
  };

  const left  = arm(lShoulder, lHip);
  const right = arm(rShoulder, rHip);
  if (!left && !right) return null;

  return { left, right, hasHip: !!(lHip || rHip) };
}

// ── Rep accumulator ───────────────────────────────────────────────────────────

export interface ShoulderRepData {
  maxAbd: number;        // peak abduction angle (arm-from-vertical) reached
  minAbd: number;
  elbowAngles: number[]; // shoulder-elbow-wrist samples (H4)
  trunkLeans: number[];  // lateral trunk lean samples (H2)
  shrugs: number[];      // normalized shoulder elevation samples (H3)
  outOfPlanes: number[]; // |elbow.z − shoulder.z| samples (H6)
  velocities: number[];  // |Δabd| / Δt deg/sec (H5)
  holdSec: number;       // time near the top (H5)
}

function makeRepData(): ShoulderRepData {
  return { maxAbd: 0, minAbd: 180, elbowAngles: [], trunkLeans: [], shrugs: [], outOfPlanes: [], velocities: [], holdSec: 0 };
}

// ── Per-arm state ─────────────────────────────────────────────────────────────

export interface ShoulderArmState {
  phase: ArmPhase; // 'down' | 'up'
  repCount: number;
  repData: ShoulderRepData;
  lastAbd: number | null;
  lastTs: number | null;
}

export interface ShoulderAbductionState {
  left: ShoulderArmState;
  right: ShoulderArmState;
}

function makeArmState(): ShoulderArmState {
  return { phase: 'down', repCount: 0, repData: makeRepData(), lastAbd: null, lastTs: null };
}

export const INITIAL_SHOULDER_ABDUCTION_STATE: ShoulderAbductionState = {
  left:  makeArmState(),
  right: makeArmState(),
};

// ── Result type ───────────────────────────────────────────────────────────────

export interface ShoulderAbductionAnalysisResult extends CommonAnalysisResult {}

// ── Rep analysis (warnings + 0-100 penalty-based form score) ──────────────────

function mean(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

function analyzeRep(
  data: ShoulderRepData,
  config: ShoulderAbductionConfig,
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let penalty = 0;

  // H1 — insufficient range of motion (peak abduction below the ideal target)
  if (data.maxAbd < config.ABDUCTION_TARGET) {
    warnings.push('Kolunu daha yukarı kaldır, hareket açıklığını artır');
    penalty += Math.min(35, (config.ABDUCTION_TARGET - data.maxAbd) * 0.5);
  }

  // H2 — trunk lean / compensation
  if (mean(data.trunkLeans) > config.TRUNK_LEAN_TOLERANCE) {
    warnings.push('Gövdeni dik tut, yana yaslanma');
    penalty += 20;
  }

  // H3 — shoulder shrug (upper-trap compensation)
  if (mean(data.shrugs) > config.SHRUG_TOLERANCE) {
    warnings.push('Omzunu kulağına doğru kaldırma, omuz sabit kalsın');
    penalty += 15;
  }

  // H4 — bent elbow during the raise
  if (data.elbowAngles.length > 0 && mean(data.elbowAngles) < config.ELBOW_STRAIGHT_MIN) {
    warnings.push('Dirseğini düz tut');
    penalty += 12;
  }

  // H5 — momentum: too fast, or no pause at the top
  const maxVel = data.velocities.length > 0 ? Math.max(...data.velocities) : 0;
  if (maxVel > config.MAX_ANGLE_VELOCITY || data.holdSec < config.TOP_HOLD_MIN_SEC) {
    warnings.push('Daha yavaş ve kontrollü; tepede kısa dur');
    penalty += 15;
  }

  // H6 — arm raised forward instead of out to the side (out of plane)
  if (mean(data.outOfPlanes) > config.OUT_OF_PLANE_TOLERANCE) {
    warnings.push('Kolunu yana aç, öne doğru kaldırma');
    penalty += 10;
  }

  const score = Math.max(0, 100 - penalty);
  if (warnings.length === 0) warnings.push(PERFECT_FORM);
  return { score: Math.round(score * 10) / 10, warnings };
}

function instantForm(
  abd: number,
  trunkLean: number,
  shrug: number,
  elbowAngle: number | null,
  outOfPlane: number,
  config: ShoulderAbductionConfig,
): number {
  let p = 0;
  if (abd < config.ABDUCTION_TARGET) p += Math.min(35, (config.ABDUCTION_TARGET - abd) * 0.5);
  if (trunkLean > config.TRUNK_LEAN_TOLERANCE) p += 20;
  if (shrug > config.SHRUG_TOLERANCE) p += 15;
  if (elbowAngle !== null && elbowAngle < config.ELBOW_STRAIGHT_MIN) p += 12;
  if (outOfPlane > config.OUT_OF_PLANE_TOLERANCE) p += 10;
  return Math.max(0, 100 - p);
}

// ── Per-arm frame processor ───────────────────────────────────────────────────

interface ArmFrameResult {
  nextState: ShoulderArmState;
  abd: number | null;
  liveForm: number;
  completedRep: boolean;
  completedRepData?: ShoulderRepData;
}

function processArm(
  shoulder: PoseLandmark | null,
  elbow: PoseLandmark | null,
  wrist: PoseLandmark | null,
  trunkLean: number,
  armRef: ShoulderArmReference | undefined,
  state: ShoulderArmState,
  config: ShoulderAbductionConfig,
  now: number,
): ArmFrameResult {
  if (!shoulder || !elbow) {
    return { nextState: state, abd: null, liveForm: 0, completedRep: false };
  }

  const abd = calculateUpperArmVerticalAngle(shoulder, elbow);
  const elbowAngle = wrist ? calculateJointAngle(shoulder, elbow, wrist) : null;
  const shrug = armRef ? (armRef.shoulderYBase - shoulder.y) / armRef.torsoLen : 0;
  const outOfPlane = Math.abs(elbow.z - shoulder.z);

  const repData: ShoulderRepData = {
    maxAbd: Math.max(state.repData.maxAbd, abd),
    minAbd: Math.min(state.repData.minAbd, abd),
    elbowAngles: [...state.repData.elbowAngles],
    trunkLeans:  [...state.repData.trunkLeans],
    shrugs:      [...state.repData.shrugs],
    outOfPlanes: [...state.repData.outOfPlanes],
    velocities:  [...state.repData.velocities],
    holdSec:     state.repData.holdSec,
  };

  if (state.lastAbd !== null && state.lastTs !== null && now > state.lastTs) {
    repData.velocities.push(Math.abs(abd - state.lastAbd) / (now - state.lastTs));
  }

  // Accumulate form metrics + hold time while the arm is raised
  const isRaised = abd > config.ABDUCTION_DOWN;
  if (isRaised) {
    repData.trunkLeans.push(trunkLean);
    repData.shrugs.push(shrug);
    repData.outOfPlanes.push(outOfPlane);
    if (elbowAngle !== null) repData.elbowAngles.push(elbowAngle);
    const nearTop = abd > config.ABDUCTION_TARGET - config.TOP_BAND;
    if (nearTop && state.lastTs !== null && now > state.lastTs) {
      repData.holdSec += now - state.lastTs;
    }
  }

  const liveForm = instantForm(abd, trunkLean, shrug, elbowAngle, outOfPlane, config);

  // Phase transition — rep credited at the top (down→up), analyzed on return (up→down)
  let { phase, repCount } = state;
  let completedRep = false;
  if (phase === 'down' && abd > config.ABDUCTION_UP) {
    repCount += 1;
    phase = 'up';
  } else if (phase === 'up' && abd < config.ABDUCTION_DOWN) {
    phase = 'down';
    completedRep = true;
  }

  return {
    nextState: {
      phase,
      repCount,
      repData: completedRep ? makeRepData() : repData,
      lastAbd: abd,
      lastTs: now,
    },
    abd,
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

export function analyzeShoulderAbduction(
  pose: PoseResult,
  previousState: ShoulderAbductionState,
  reference: ShoulderAbductionReference | null,
  config: ShoulderAbductionConfig,
  now: number,
  prevRepLog: RepLogEntry[],
): { result: ShoulderAbductionAnalysisResult; nextState: ShoulderAbductionState; nextRepLog: RepLogEntry[] } {
  const v = config.MIN_VISIBILITY;

  const lShoulder = getValidLandmark(pose, 'leftShoulder',  v);
  const rShoulder = getValidLandmark(pose, 'rightShoulder', v);
  const lElbow    = getValidLandmark(pose, 'leftElbow',  v);
  const rElbow    = getValidLandmark(pose, 'rightElbow', v);
  const lWrist    = getValidLandmark(pose, 'leftWrist',  v);
  const rWrist    = getValidLandmark(pose, 'rightWrist', v);
  const lHip      = getValidLandmark(pose, 'leftHip',  v);
  const rHip      = getValidLandmark(pose, 'rightHip', v);

  // Global lateral trunk lean (needs both shoulders + both hips)
  let trunkLean = 0;
  if (lShoulder && rShoulder && lHip && rHip) {
    trunkLean = calculateTorsoLean(midpoint(lShoulder, rShoulder), midpoint(lHip, rHip));
  }

  const leftFrame  = processArm(lShoulder, lElbow, lWrist, trunkLean, reference?.left,  previousState.left,  config, now);
  const rightFrame = processArm(rShoulder, rElbow, rWrist, trunkLean, reference?.right, previousState.right, config, now);

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

  // Live form: the active (more-raised) visible arm
  const liveFormVals: Array<{ abd: number; form: number }> = [];
  if (leftFrame.abd  !== null) liveFormVals.push({ abd: leftFrame.abd,  form: leftFrame.liveForm });
  if (rightFrame.abd !== null) liveFormVals.push({ abd: rightFrame.abd, form: rightFrame.liveForm });
  const active = liveFormVals.sort((a, b) => b.abd - a.abd)[0];
  const liveFormScore = active ? Math.round(active.form * 10) / 10 : null;

  const leftVisible  = leftFrame.abd  !== null;
  const rightVisible = rightFrame.abd !== null;
  const nextLeft  = leftFrame.nextState;
  const nextRight = rightFrame.nextState;

  const result: ShoulderAbductionAnalysisResult = {
    exerciseId:      'shoulder_abduction',
    repCount:        nextLeft.repCount + nextRight.repCount,
    currentPhase:    'tracking',
    formScore:       liveFormScore !== null ? Math.round(liveFormScore) : null,
    warnings:        lastEntry?.warnings ?? [],
    angles:          { leftArm: leftFrame.abd, rightArm: rightFrame.abd },
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

export function summarizeShoulderAbductionSession(fullRepLog: RepLogEntry[]) {
  return summarizeSession(fullRepLog, WARNING_TO_ERROR_CODE, ERROR_CODE_LABELS);
}

// ── Engine — plugs into the generic hook / camera screen / save layer ─────────

export const shoulderAbductionEngine: AnalyzerEngine = {
  config: SHOULDER_ABDUCTION_CONFIG,
  initialState: INITIAL_SHOULDER_ABDUCTION_STATE,
  leftLabel: 'Sol Kol',
  rightLabel: 'Sağ Kol',
  captureReference: (pose, config) => captureReference(pose, config as ShoulderAbductionConfig),
  analyze: (pose, prevState, reference, config, now, prevRepLog) =>
    analyzeShoulderAbduction(
      pose,
      prevState as ShoulderAbductionState,
      reference as ShoulderAbductionReference | null,
      config as ShoulderAbductionConfig,
      now,
      prevRepLog,
    ),
  summarize: summarizeShoulderAbductionSession,
  getLeftAngle:  result => result.angles.leftArm  ?? null,
  getRightAngle: result => result.angles.rightArm ?? null,
  describeReference: () => 'REF',
};
