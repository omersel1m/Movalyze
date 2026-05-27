-- ================================================================
-- Movalyze Local SQLite Schema (Offline Cache)
-- ================================================================
-- Sadece senkronizasyon gereken user tabloları tutulur.
-- exercise_categories ve exercises Supabase'den direkt okunur.
-- ================================================================

CREATE TABLE IF NOT EXISTS workout_sessions (
  id                 TEXT    PRIMARY KEY,
  user_id            TEXT    NOT NULL,
  exercise_id        TEXT    NOT NULL,
  duration_seconds   INTEGER NOT NULL DEFAULT 0,
  total_reps         INTEGER NOT NULL DEFAULT 0,
  correct_reps       INTEGER NOT NULL DEFAULT 0,
  avg_accuracy_pct   REAL,
  max_accuracy_pct   REAL,
  min_accuracy_pct   REAL,
  status             TEXT    NOT NULL DEFAULT 'completed',
  started_at         TEXT    NOT NULL,
  ended_at           TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  synced             INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ws_user_id   ON workout_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_ws_started   ON workout_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ws_synced    ON workout_sessions (synced);

-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS session_errors (
  id                TEXT    PRIMARY KEY,
  session_id        TEXT    NOT NULL,
  error_code        TEXT    NOT NULL,
  error_description TEXT,
  rep_number        INTEGER,
  occurrence_count  INTEGER NOT NULL DEFAULT 1,
  severity_score    REAL,
  detected_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  synced            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_se_session_id ON session_errors (session_id);
CREATE INDEX IF NOT EXISTS idx_se_synced     ON session_errors (synced);

-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT    NOT NULL,
  record_id   TEXT    NOT NULL,
  operation   TEXT    NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sq_created ON sync_queue (created_at ASC);
