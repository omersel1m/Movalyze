-- ================================================================
-- Migration 003: workout_sessions schema updates
-- Adds left_reps, right_reps for bilateral exercise tracking.
-- Adds rep_log JSONB for storing per-rep summary without a separate table.
-- ================================================================

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS left_reps   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS right_reps  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rep_log     JSONB;

-- Rename accuracy columns to form_score naming for clarity
-- (backward-compatible: old columns kept, new aliases added as views or just used in queries)
-- avg_accuracy_pct  → maps to average_form_score in app layer
-- max_accuracy_pct  → maps to best_form_score
-- min_accuracy_pct  → maps to worst_form_score
-- No rename needed — app layer will alias.

-- Index for date-range queries (stats screen)
CREATE INDEX IF NOT EXISTS idx_ws_started_user
  ON workout_sessions (user_id, started_at DESC);

-- Index for exercise+category join
CREATE INDEX IF NOT EXISTS idx_ws_exercise_id
  ON workout_sessions (exercise_id);
