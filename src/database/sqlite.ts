import { open, OPSQLiteConnection } from '@op-engineering/op-sqlite';

let db: OPSQLiteConnection | null = null;

export function getDatabase(): OPSQLiteConnection {
  if (db) return db;
  db = open({ name: 'movalyze.db' });
  runMigrations(db);
  return db;
}

function runMigrations(database: OPSQLiteConnection): void {
  database.executeSync(`
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
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_ws_user_id ON workout_sessions (user_id);`);
  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_ws_started  ON workout_sessions (started_at DESC);`);
  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_ws_synced   ON workout_sessions (synced);`);

  database.executeSync(`
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
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_se_session_id ON session_errors (session_id);`);
  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_se_synced      ON session_errors (synced);`);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT    NOT NULL,
      record_id   TEXT    NOT NULL,
      operation   TEXT    NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      payload     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_sq_created ON sync_queue (created_at ASC);`);

  // ── Nutrition tables ──────────────────────────────────────────

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS foods (
      id            TEXT    PRIMARY KEY,
      name          TEXT    NOT NULL,
      brand         TEXT,
      serving_size  REAL    NOT NULL DEFAULT 100,
      serving_unit  TEXT    NOT NULL DEFAULT 'g',
      calories      REAL    NOT NULL DEFAULT 0,
      carbs_g       REAL    NOT NULL DEFAULT 0,
      protein_g     REAL    NOT NULL DEFAULT 0,
      fat_g         REAL    NOT NULL DEFAULT 0,
      fiber_g       REAL,
      sugar_g       REAL,
      sodium_mg     REAL,
      created_by    TEXT,
      is_user_created INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_foods_name ON foods (name);`);
  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_foods_user ON foods (created_by);`);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS nutrition_entries (
      id              TEXT    PRIMARY KEY,
      user_id         TEXT    NOT NULL,
      food_id         TEXT,
      entry_date      TEXT    NOT NULL,
      meal_type       TEXT    NOT NULL,
      amount          REAL    NOT NULL DEFAULT 1,
      unit            TEXT    NOT NULL DEFAULT 'serving',
      calories        REAL    NOT NULL DEFAULT 0,
      carbs_g         REAL    NOT NULL DEFAULT 0,
      protein_g       REAL    NOT NULL DEFAULT 0,
      fat_g           REAL    NOT NULL DEFAULT 0,
      is_quick_add    INTEGER NOT NULL DEFAULT 0,
      quick_add_label TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      synced          INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_ne_user_date ON nutrition_entries (user_id, entry_date);`);
  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_ne_synced    ON nutrition_entries (synced);`);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS water_entries (
      id         TEXT    PRIMARY KEY,
      user_id    TEXT    NOT NULL,
      entry_date TEXT    NOT NULL,
      amount_ml  REAL    NOT NULL DEFAULT 250,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      synced     INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.executeSync(`CREATE INDEX IF NOT EXISTS idx_we_user_date ON water_entries (user_id, entry_date);`);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS nutrition_goals (
      user_id        TEXT    PRIMARY KEY,
      daily_calories REAL    NOT NULL DEFAULT 2000,
      carbs_g        REAL    NOT NULL DEFAULT 250,
      protein_g      REAL    NOT NULL DEFAULT 100,
      fat_g          REAL    NOT NULL DEFAULT 65,
      water_ml       REAL    NOT NULL DEFAULT 2500,
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      synced         INTEGER NOT NULL DEFAULT 0
    );
  `);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS favorite_foods (
      user_id    TEXT NOT NULL,
      food_id    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, food_id)
    );
  `);

  database.executeSync(`
    CREATE TABLE IF NOT EXISTS recent_foods (
      user_id    TEXT NOT NULL,
      food_id    TEXT NOT NULL,
      used_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, food_id)
    );
  `);
}
