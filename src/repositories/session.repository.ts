import { getDatabase } from '../database/sqlite';
import { WorkoutSession, SessionError } from '../database/models/types';

export const sessionRepository = {
  save(session: WorkoutSession): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO workout_sessions
        (id, user_id, exercise_id, started_at, ended_at, duration_seconds,
         total_reps, left_reps, right_reps, correct_reps,
         avg_accuracy_pct, max_accuracy_pct, min_accuracy_pct,
         rep_log, status, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.user_id,
        session.exercise_id,
        session.started_at,
        session.ended_at ?? null,
        session.duration_seconds,
        session.total_reps,
        session.left_reps,
        session.right_reps,
        session.correct_reps,
        session.avg_accuracy_pct ?? null,
        session.max_accuracy_pct ?? null,
        session.min_accuracy_pct ?? null,
        session.rep_log ?? null,
        session.status,
        session.synced ? 1 : 0,
      ],
    );
  },

  saveError(error: SessionError): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO session_errors
        (id, session_id, error_code, error_description, rep_number,
         occurrence_count, severity_score, detected_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        error.id,
        error.session_id,
        error.error_code,
        error.error_description ?? null,
        error.rep_number ?? null,
        error.occurrence_count,
        error.severity_score ?? null,
        error.detected_at,
        error.synced ? 1 : 0,
      ],
    );
  },

  getUnsynced(): WorkoutSession[] {
    const db = getDatabase();
    const result = db.executeSync('SELECT * FROM workout_sessions WHERE synced = 0');
    return (Array.isArray(result.rows) ? result.rows : result.rows?._array ?? []) as WorkoutSession[];
  },

  markSynced(id: string): void {
    const db = getDatabase();
    db.executeSync('UPDATE workout_sessions SET synced = 1 WHERE id = ?', [id]);
  },

  getUnsyncedErrors(): SessionError[] {
    const db = getDatabase();
    const result = db.executeSync('SELECT * FROM session_errors WHERE synced = 0');
    return (Array.isArray(result.rows) ? result.rows : result.rows?._array ?? []) as SessionError[];
  },

  markErrorSynced(id: string): void {
    const db = getDatabase();
    db.executeSync('UPDATE session_errors SET synced = 1 WHERE id = ?', [id]);
  },
};
