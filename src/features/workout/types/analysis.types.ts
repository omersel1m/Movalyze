export type ExercisePhase =
  | 'idle'
  | 'preparing'
  | 'calibrating'
  | 'tracking'
  | 'completed';

export type ArmPhase = 'down' | 'up';

export interface AnalysisResult {
  exerciseId: string;
  repCount: number;
  currentPhase: ExercisePhase;
  formScore: number | null;
  warnings: string[];
  angles: Record<string, number | null>;
  isPoseValid: boolean;
  debugInfo?: Record<string, unknown>;
}

export interface AnalyzerState {
  phase: ExercisePhase;
  repCount: number;
}
