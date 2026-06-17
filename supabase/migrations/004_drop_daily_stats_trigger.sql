-- ================================================================
-- 004 — Drop legacy daily_stats aggregation trigger(s)
-- ================================================================
-- The AFTER INSERT/UPDATE trigger on workout_sessions recomputes daily_stats
-- using nested aggregate functions (e.g. jsonb_object_agg(... avg(...) ...)),
-- which Postgres rejects with:
--     "aggregate function calls cannot be nested"
-- This blocks EVERY workout_sessions insert, so sessions never sync and the
-- Stats screen stays empty.
--
-- daily_stats has been abandoned in favor of dynamic range queries directly
-- over workout_sessions + session_errors, so the trigger is no longer needed.
-- This migration drops any trigger on workout_sessions / session_errors whose
-- function body references daily_stats, and the orphaned trigger function(s).
-- ================================================================

-- 1) Drop the offending triggers (matched by their function referencing daily_stats)
DO $$
DECLARE
  trg RECORD;
BEGIN
  FOR trg IN
    SELECT t.tgname AS trigger_name, c.relname AS table_name
    FROM pg_trigger t
    JOIN pg_class  c ON c.oid = t.tgrelid
    JOIN pg_proc   p ON p.oid = t.tgfoid
    WHERE NOT t.tgisinternal
      AND c.relname IN ('workout_sessions', 'session_errors')
      AND pg_get_functiondef(p.oid) ILIKE '%daily_stats%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg.trigger_name, trg.table_name);
    RAISE NOTICE 'Dropped trigger % on %', trg.trigger_name, trg.table_name;
  END LOOP;
END $$;

-- 2) Drop now-orphaned trigger functions that maintained daily_stats
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
      AND pg_get_functiondef(p.oid) ILIKE '%daily_stats%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t WHERE t.tgfoid = p.oid AND NOT t.tgisinternal
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I() CASCADE', fn.proname);
    RAISE NOTICE 'Dropped orphaned trigger function %', fn.proname;
  END LOOP;
END $$;
