import { getDatabase } from '../database/sqlite';
import { WorkoutSession, SessionError } from '../database/models/types';

export const sessionRepository = {
  save(session: WorkoutSession): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO workout_sessions
        (id, user_id, started_at, ended_at, duration_seconds, exercise_type, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.user_id,
        session.started_at,
        session.ended_at,
        session.duration_seconds,
        session.exercise_type,
        session.synced ? 1 : 0,
      ],
    );
  },

  saveError(error: SessionError): void {
    const db = getDatabase();
    db.executeSync(
      `INSERT OR REPLACE INTO session_errors
        (id, session_id, timestamp, error_type, description, synced)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        error.id,
        error.session_id,
        error.timestamp,
        error.error_type,
        error.description,
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
