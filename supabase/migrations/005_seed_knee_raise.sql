-- ================================================================
-- 005 — Seed "Knee Raise" exercise into the Pilates category
-- ================================================================
-- The exercise list UI is data-driven (workout_service → exercises table), so
-- inserting this row makes a "Knee Raise" button appear under Pilates. Tapping
-- it opens ExerciseCamera, where selectEngine() matches slug "knee-raise" and
-- runs the Standing Knee Raise analyzer.
--
-- Idempotent: resolves the Pilates category by slug and inserts only if a
-- "knee-raise" exercise does not already exist.
-- ================================================================

INSERT INTO public.exercises
  (category_id, name, slug, description, difficulty_level, is_active, display_order)
SELECT
  c.id,
  'Knee Raise',
  'knee-raise',
  'Ayakta dururken dizi kalça hizasına/öne-yukarı çekme — core, kalça fleksörü ve denge egzersizi.',
  'beginner',
  TRUE,
  1
FROM public.exercise_categories c
WHERE c.slug = 'pilates'
  AND NOT EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.slug = 'knee-raise'
  );
