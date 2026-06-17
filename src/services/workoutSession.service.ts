import { sessionRepository } from '../repositories/session.repository';
import { syncQueue } from '../sync/syncQueue';
import { generateId } from '../utils/generateId';
import { WorkoutSession, SessionError } from '../database/models/types';

// ── Generic, exercise-agnostic workout save layer ─────────────────────────────
// Any exercise (Biceps Curl today, Squat/Pilates/Therapy later) can build a
// WorkoutSummaryInput from its own analyzer and persist it through this service.
// Nothing here is Biceps-specific.

export interface WorkoutErrorSummary {
  errorCode: string;
  description?: string | null;
  count: number;
  severity?: number | null;
  repNumber?: number | null;
}

export interface WorkoutSummaryInput {
  userId: string;
  exerciseId: string;          // Supabase exercises.id (UUID)
  startedAt: Date;
  endedAt: Date;
  totalReps: number;
  leftReps?: number;
  rightReps?: number;
  correctReps?: number;
  avgFormScore?: number | null;
  bestFormScore?: number | null;
  worstFormScore?: number | null;
  repLog?: unknown;            // any JSON-serializable per-rep log
  errors?: WorkoutErrorSummary[];
}

export interface SaveWorkoutResult {
  sessionId: string;
  savedLocally: boolean;
  syncedRemote: boolean;
  error?: string;
}

export const workoutSessionService = {
  async saveWorkoutSession(input: WorkoutSummaryInput): Promise<SaveWorkoutResult> {
    const nowISO = new Date().toISOString();
    const sessionId = generateId();

    const durationSeconds = Math.max(
      0,
      Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000),
    );

    const session: WorkoutSession = {
      id:               sessionId,
      user_id:          input.userId,
      exercise_id:      input.exerciseId,
      duration_seconds: durationSeconds,
      total_reps:       input.totalReps,
      left_reps:        input.leftReps  ?? 0,
      right_reps:       input.rightReps ?? 0,
      correct_reps:     input.correctReps ?? 0,
      avg_accuracy_pct: input.avgFormScore   ?? null,
      max_accuracy_pct: input.bestFormScore  ?? null,
      min_accuracy_pct: input.worstFormScore ?? null,
      rep_log:          input.repLog != null ? JSON.stringify(input.repLog) : null,
      status:           'completed',
      started_at:       input.startedAt.toISOString(),
      ended_at:         input.endedAt.toISOString(),
      created_at:       nowISO,
      synced:           false,
    };

    // 1) Offline-first: persist to SQLite. If this fails, surface the error but
    //    never throw to the caller (the user must still see their summary).
    let savedLocally = false;
    try {
      sessionRepository.save(session);

      for (const e of input.errors ?? []) {
        if (e.count <= 0) continue;
        const errorRow: SessionError = {
          id:                generateId(),
          session_id:        sessionId,
          user_id:           input.userId, // SQLite ignores; Supabase trigger fills server-side
          error_code:        e.errorCode,
          error_description: e.description ?? null,
          rep_number:        e.repNumber ?? null,
          occurrence_count:  e.count,
          severity_score:    e.severity ?? null,
          detected_at:       nowISO,
          synced:            false,
        };
        sessionRepository.saveError(errorRow);
      }

      savedLocally = true;
    } catch (err) {
      console.error('[workoutSession] local save failed:', err);
      return {
        sessionId,
        savedLocally: false,
        syncedRemote: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 2) Best-effort remote push. Order matters: sessions before errors (FK).
    //    Failure here is non-fatal — the row stays unsynced and retries later.
    let syncedRemote = false;
    try {
      await syncQueue.syncSessions();
      await syncQueue.syncErrors();
      syncedRemote = !sessionRepository
        .getUnsynced()
        .some(s => s.id === sessionId);
    } catch (err) {
      console.warn('[workoutSession] remote sync failed (will retry later):', err);
    }

    return { sessionId, savedLocally, syncedRemote };
  },
};
