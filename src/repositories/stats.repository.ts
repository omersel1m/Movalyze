import { supabase } from '../config/supabaseClient';
import { DailyStats } from '../database/models/types';

// ── Types for dynamic stats queries ──────────────────────────────────────────

export interface SessionRow {
  id: string;
  exercise_id: string;
  total_reps: number;
  left_reps: number;
  right_reps: number;
  avg_accuracy_pct: number | null;
  max_accuracy_pct: number | null;
  min_accuracy_pct: number | null;
  started_at: string;
  exercise_name: string;
  exercise_slug: string;
  category_slug: string;
}

export interface ErrorRow {
  error_code: string;
  occurrence_count: number;
  session_id: string;
  category_slug: string;
}

export interface ErrorDetailRow extends ErrorRow {
  error_description: string | null;
  exercise_id: string;
  exercise_name: string;
  exercise_slug: string;
  detected_at: string;
}

// ── Repository ────────────────────────────────────────────────────────────────

export const statsRepository = {
  // Legacy daily_stats lookup (kept for backward compat)
  async getDailyStatsForDate(userId: string, date: string): Promise<DailyStats | null> {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('stat_date', date)
      .single();

    if (error) return null;
    return data as DailyStats;
  },

  // exercises with category slug map — used for category filter
  async getExercisesWithCategory(): Promise<Array<{ exerciseSlug: string; categorySlug: string }>> {
    const { data, error } = await supabase
      .from('exercises')
      .select('slug, exercise_categories!inner(slug)')
      .eq('is_active', true);

    if (error || !data) return [];

    return data.map((row: any) => ({
      exerciseSlug: row.slug,
      categorySlug: row.exercise_categories.slug,
    }));
  },

  // Sessions in a date range, with exercise name + category slug
  async getSessionsForRange(
    userId: string,
    startISO: string,
    endISO: string,
  ): Promise<SessionRow[]> {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select(`
        id, exercise_id, total_reps, left_reps, right_reps,
        avg_accuracy_pct, max_accuracy_pct, min_accuracy_pct, started_at,
        exercises!inner(name, slug, exercise_categories!inner(slug))
      `)
      .eq('user_id', userId)
      .gte('started_at', startISO)
      .lte('started_at', endISO)
      .eq('status', 'completed');

    if (error || !data) return [];

    return data.map((row: any) => ({
      id:               row.id,
      exercise_id:      row.exercise_id,
      total_reps:       row.total_reps ?? 0,
      left_reps:        row.left_reps  ?? 0,
      right_reps:       row.right_reps ?? 0,
      avg_accuracy_pct: row.avg_accuracy_pct,
      max_accuracy_pct: row.max_accuracy_pct,
      min_accuracy_pct: row.min_accuracy_pct,
      started_at:       row.started_at,
      exercise_name:    row.exercises.name,
      exercise_slug:    row.exercises.slug,
      category_slug:    row.exercises.exercise_categories.slug,
    }));
  },

  // Errors for sessions in a date range, with category slug via join
  async getErrorsForRange(
    userId: string,
    startISO: string,
    endISO: string,
  ): Promise<ErrorRow[]> {
    const { data, error } = await supabase
      .from('session_errors')
      .select(`
        error_code, occurrence_count, session_id,
        workout_sessions!inner(
          user_id, started_at, status,
          exercises!inner(exercise_categories!inner(slug))
        )
      `)
      .eq('workout_sessions.user_id', userId)
      .gte('workout_sessions.started_at', startISO)
      .lte('workout_sessions.started_at', endISO)
      .eq('workout_sessions.status', 'completed');

    if (error || !data) return [];

    return data.map((row: any) => ({
      error_code:       row.error_code,
      occurrence_count: row.occurrence_count ?? 1,
      session_id:       row.session_id,
      category_slug:    row.workout_sessions.exercises.exercise_categories.slug,
    }));
  },

  // All completed-session errors with exercise context, used by the profile
  // summary to find the user's most frequent form issue across categories.
  async getErrorDetails(userId: string): Promise<ErrorDetailRow[]> {
    const { data, error } = await supabase
      .from('session_errors')
      .select(`
        error_code, error_description, occurrence_count, session_id, detected_at,
        workout_sessions!inner(
          user_id, exercise_id, status,
          exercises!inner(name, slug, exercise_categories!inner(slug))
        )
      `)
      .eq('workout_sessions.user_id', userId)
      .eq('workout_sessions.status', 'completed')
      .order('detected_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      error_code:        row.error_code,
      error_description: row.error_description,
      occurrence_count:  row.occurrence_count ?? 1,
      session_id:        row.session_id,
      detected_at:       row.detected_at,
      exercise_id:       row.workout_sessions.exercise_id,
      exercise_name:     row.workout_sessions.exercises.name,
      exercise_slug:     row.workout_sessions.exercises.slug,
      category_slug:     row.workout_sessions.exercises.exercise_categories.slug,
    }));
  },
};
