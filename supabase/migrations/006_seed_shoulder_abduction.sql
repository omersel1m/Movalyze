-- ================================================================
-- 006 — Seed "Shoulder Abduction" exercise into the Therapy category
-- ================================================================
-- The exercise list UI is data-driven (workout_service → exercises table), so
-- inserting this row makes a "Shoulder Abduction" button appear under Therapy.
-- Tapping it opens ExerciseCamera, where selectEngine() matches slug
-- "shoulder-abduction" and runs the Shoulder Abduction analyzer.
--
-- Idempotent: resolves the Therapy category by slug and inserts only if a
-- "shoulder-abduction" exercise does not already exist.
-- ================================================================

INSERT INTO public.exercises
  (category_id, name, slug, description, difficulty_level, is_active, display_order)
SELECT
  c.id,
  'Shoulder Abduction',
  'shoulder-abduction',
  'Ayakta dururken kolu yan düzlemde yukarı kaldırıp indirme — omuz hareket açıklığı (ROM) ve rehabilitasyon egzersizi.',
  'beginner',
  TRUE,
  1
FROM public.exercise_categories c
WHERE c.slug = 'therapy'
  AND NOT EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.slug = 'shoulder-abduction'
  );
