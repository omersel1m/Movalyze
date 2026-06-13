-- ================================================================
-- Nutrition Module — Database Migration
-- ================================================================

-- foods: Genel besin kataloğu (herkes okuyabilir, yalnızca sahip kullanıcı yazabilir)
CREATE TABLE IF NOT EXISTS public.foods (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  brand           TEXT,
  serving_size    NUMERIC     NOT NULL DEFAULT 100,
  serving_unit    TEXT        NOT NULL DEFAULT 'g' CHECK (serving_unit IN ('g', 'ml', 'piece')),
  calories        NUMERIC     NOT NULL DEFAULT 0,
  carbs_g         NUMERIC     NOT NULL DEFAULT 0,
  protein_g       NUMERIC     NOT NULL DEFAULT 0,
  fat_g           NUMERIC     NOT NULL DEFAULT 0,
  fiber_g         NUMERIC,
  sugar_g         NUMERIC,
  sodium_mg       NUMERIC,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_user_created BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foods_name         ON public.foods (name);
CREATE INDEX IF NOT EXISTS idx_foods_created_by   ON public.foods (created_by);
CREATE INDEX IF NOT EXISTS idx_foods_user_created ON public.foods (is_user_created);

-- RLS: Herkes okuyabilir; yalnızca oluşturanı yazabilir
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foods_select" ON public.foods
  FOR SELECT USING (true);

CREATE POLICY "foods_insert" ON public.foods
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "foods_update" ON public.foods
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "foods_delete" ON public.foods
  FOR DELETE USING (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────

-- nutrition_entries: Kullanıcının yediği kayıtlar
CREATE TABLE IF NOT EXISTS public.nutrition_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id         UUID        REFERENCES public.foods(id) ON DELETE SET NULL,
  entry_date      DATE        NOT NULL,
  meal_type       TEXT        NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  amount          NUMERIC     NOT NULL DEFAULT 1,
  unit            TEXT        NOT NULL DEFAULT 'serving',
  calories        NUMERIC     NOT NULL DEFAULT 0,
  carbs_g         NUMERIC     NOT NULL DEFAULT 0,
  protein_g       NUMERIC     NOT NULL DEFAULT 0,
  fat_g           NUMERIC     NOT NULL DEFAULT 0,
  is_quick_add    BOOLEAN     NOT NULL DEFAULT FALSE,
  quick_add_label TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ne_user_date ON public.nutrition_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ne_meal_type ON public.nutrition_entries (meal_type);

ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_entries_select" ON public.nutrition_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "nutrition_entries_insert" ON public.nutrition_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_entries_update" ON public.nutrition_entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "nutrition_entries_delete" ON public.nutrition_entries
  FOR DELETE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────

-- water_entries: Su tüketimi
CREATE TABLE IF NOT EXISTS public.water_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE        NOT NULL,
  amount_ml  NUMERIC     NOT NULL DEFAULT 250,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_we_user_date ON public.water_entries (user_id, entry_date);

ALTER TABLE public.water_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_entries_select" ON public.water_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "water_entries_insert" ON public.water_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "water_entries_delete" ON public.water_entries
  FOR DELETE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────

-- nutrition_goals: Kullanıcı hedefleri (her kullanıcı için tek kayıt)
CREATE TABLE IF NOT EXISTS public.nutrition_goals (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_calories NUMERIC     NOT NULL DEFAULT 2000,
  carbs_g        NUMERIC     NOT NULL DEFAULT 250,
  protein_g      NUMERIC     NOT NULL DEFAULT 100,
  fat_g          NUMERIC     NOT NULL DEFAULT 65,
  water_ml       NUMERIC     NOT NULL DEFAULT 2500,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select" ON public.nutrition_goals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "nutrition_goals_upsert" ON public.nutrition_goals
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────

-- favorite_foods: Favoriler
CREATE TABLE IF NOT EXISTS public.favorite_foods (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id    UUID        NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, food_id)
);

ALTER TABLE public.favorite_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorite_foods_select" ON public.favorite_foods
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "favorite_foods_insert" ON public.favorite_foods
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "favorite_foods_delete" ON public.favorite_foods
  FOR DELETE USING (user_id = auth.uid());
