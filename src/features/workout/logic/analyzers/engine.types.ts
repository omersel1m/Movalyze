import { PoseResult } from '../../types/pose.types';
import { ArmPhase, AnalysisResult } from '../../types/analysis.types';

// ── Shared analyzer contract ──────────────────────────────────────────────────
// Every exercise analyzer (Biceps Curl, Standing Knee Raise, …) plugs into the
// generic session hook + camera screen + save layer by exposing an AnalyzerEngine.
// Only the per-exercise math lives in each analyzer; session state, calibration,
// rep-log accumulation, summary building and persistence are written ONCE.

export type DisplayMode = 'bilateral' | 'alternating' | 'single';

export interface RepLogEntry {
  arm: 'left' | 'right'; // left/right limb (arm or leg)
  repNo: number;
  score: number;
  warnings: string[];
}

// Common result shape the camera UI renders. Each analyzer's result type
// structurally satisfies this (extra fields are fine).
export interface CommonAnalysisResult extends AnalysisResult {
  leftRepCount: number;
  rightRepCount: number;
  leftPhase: ArmPhase;
  rightPhase: ArmPhase;
  displayMode: DisplayMode;
  liveFormScore: number | null;
  lastRepScore: number | null;
  lastRepWarnings: string[];
  repLog: RepLogEntry[];
}

// Exercise-agnostic session summary → feeds workoutSessionService.saveWorkoutSession.
export interface WorkoutSessionSummary {
  totalReps: number;
  leftReps: number;
  rightReps: number;
  correctReps: number;
  avgFormScore: number | null;
  bestFormScore: number | null;
  worstFormScore: number | null;
  repLog: RepLogEntry[];
  errors: Array<{ errorCode: string; count: number }>;
  topWarnings: Array<{ label: string; count: number }>;
}

export interface AnalyzeOutput {
  result: CommonAnalysisResult;
  nextState: unknown;
  nextRepLog: RepLogEntry[];
}

// Fields every exercise config must provide; specific configs add their own.
export interface ExerciseConfig {
  SMOOTHING_ALPHA: number;
  MIN_VISIBILITY: number;
}

// One analyzer engine = everything the generic hook/screen needs for an exercise.
export interface AnalyzerEngine {
  config: ExerciseConfig;
  initialState: unknown;

  // Display labels for the two limbs (e.g. "Sol Dirsek" / "Sol Bacak").
  leftLabel: string;
  rightLabel: string;

  captureReference(pose: PoseResult, config: ExerciseConfig): unknown | null;

  analyze(
    pose: PoseResult,
    prevState: unknown,
    reference: unknown,
    config: ExerciseConfig,
    now: number, // seconds (Date.now() / 1000)
    prevRepLog: RepLogEntry[],
  ): AnalyzeOutput;

  summarize(fullRepLog: RepLogEntry[]): WorkoutSessionSummary;

  // Display adapters — pull the per-limb angle the UI shows.
  getLeftAngle(result: CommonAnalysisResult): number | null;
  getRightAngle(result: CommonAnalysisResult): number | null;

  // Short badge text for a captured reference, e.g. "REF + KALÇA".
  describeReference(reference: unknown): string;
}
