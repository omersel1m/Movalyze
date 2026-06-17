import { supabase } from '../config/supabaseClient';
import { sessionRepository } from '../repositories/session.repository';
import { nutritionService } from '../services/nutrition.service';

export const syncQueue = {
  async syncAll(): Promise<void> {
    await Promise.all([
      syncQueue.syncSessions(),
      syncQueue.syncErrors(),
      syncQueue.syncNutrition(),
    ]);
  },

  async syncSessions(): Promise<void> {
    const unsynced = sessionRepository.getUnsynced();

    for (const s of unsynced) {
      // Whitelist columns that exist on the Supabase table. Never send the
      // local-only `synced` flag or the generated `incorrect_reps` column.
      // rep_log is TEXT locally but jsonb remotely → parse it.
      let repLog: unknown = null;
      if (s.rep_log != null) {
        try {
          repLog = typeof s.rep_log === 'string' ? JSON.parse(s.rep_log) : s.rep_log;
        } catch {
          repLog = null;
        }
      }

      const { error } = await supabase.from('workout_sessions').upsert({
        id:               s.id,
        user_id:          s.user_id,
        exercise_id:      s.exercise_id,
        duration_seconds: s.duration_seconds,
        total_reps:       s.total_reps,
        left_reps:        s.left_reps  ?? 0,
        right_reps:       s.right_reps ?? 0,
        correct_reps:     s.correct_reps,
        avg_accuracy_pct: s.avg_accuracy_pct,
        max_accuracy_pct: s.max_accuracy_pct,
        min_accuracy_pct: s.min_accuracy_pct,
        rep_log:          repLog,
        status:           s.status,
        started_at:       s.started_at,
        ended_at:         s.ended_at,
      });

      if (!error) {
        sessionRepository.markSynced(s.id);
      } else {
        console.warn('[sync] workout_session upsert failed:', error.message);
      }
    }
  },

  async syncErrors(): Promise<void> {
    const unsynced = sessionRepository.getUnsyncedErrors();

    for (const e of unsynced) {
      // user_id is filled server-side by trigger — do not send it.
      const { error } = await supabase.from('session_errors').upsert({
        id:                e.id,
        session_id:        e.session_id,
        error_code:        e.error_code,
        error_description: e.error_description ?? null,
        rep_number:        e.rep_number ?? null,
        occurrence_count:  e.occurrence_count,
        severity_score:    e.severity_score ?? null,
        detected_at:       e.detected_at,
      });

      if (!error) {
        sessionRepository.markErrorSynced(e.id);
      } else {
        console.warn('[sync] session_error upsert failed:', error.message);
      }
    }
  },

  async syncNutrition(): Promise<void> {
    await Promise.all([
      nutritionService.syncNutritionEntries(),
      nutritionService.syncWaterEntries(),
      nutritionService.syncGoals(),
    ]);
  },
};
