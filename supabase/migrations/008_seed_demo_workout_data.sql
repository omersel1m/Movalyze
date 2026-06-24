-- ================================================================
-- 008 — Demo workout seed: tekrar (rep) + form hatası verisi
-- ================================================================
-- Amaç: kamera karşısına geçmeden, İstatistik ekranını besleyecek
-- gerçekçi workout_sessions + session_errors kayıtları üretmek.
--
-- Kapsam: yalnızca gerçek analyzer'ı (ve Stats ekranında tanımlı hata
-- etiketi) olan 3 egzersiz:
--   • Biceps Curl        (Fitness)  — slug: biceps_curl
--   • Knee Raise         (Pilates)  — slug: knee-raise
--   • Shoulder Abduction (Therapy)  — slug: shoulder-abduction
--
-- Tutarlılık (rapor metniyle uyum):
--   • Kullanıcı bilinçli form hataları yapmış varsayılır → her egzersizde
--     4 hata türü görülür; hata kodları analyzer sabitleriyle birebir aynıdır
--     (bicepsErrorCodes / kneeRaiseErrorCodes / shoulderAbductionErrorCodes).
--   • Form skorları geçmişten bugüne artan trenddedir (form improvement +).
--   • correct_reps < total_reps; her hatalı tekrara bir uyarı düşer, böylece
--     session_errors.occurrence_count toplamı = (total_reps - correct_reps).
--
-- NOT: Idempotent çalışır — aşağıdaki 3 egzersiz için bu kullanıcının
-- son 15 gündeki "completed" oturumlarını silip yeniden oluşturur.
-- Tekrar tekrar çalıştırılması güvenlidir (gerçek oturum yoksa).
--
-- Hedef kullanıcı: varsayılan olarak en son oluşturulan auth.users hesabı.
-- Belirli bir hesabı hedeflemek için DO bloğundaki ilgili SELECT'i düzenleyin.
-- ================================================================

-- ── rep_log üretip oturumu + hatalarını kaydeden yardımcı (geçici) fonksiyon ──
CREATE OR REPLACE FUNCTION pg_temp.seed_session(
  p_user     uuid,
  p_exercise uuid,
  p_started  timestamptz,
  p_duration int,
  p_total    int,
  p_correct  int,
  p_avg      numeric,
  p_min      numeric,
  p_max      numeric,
  p_errors   jsonb      -- [{ "code": "...", "warning": "...", "count": N, "severity": 0.4 }]
) RETURNS void
LANGUAGE plpgsql AS $func$
DECLARE
  v_session uuid := gen_random_uuid();
  v_replog  jsonb;
  v_left    int := ceil(p_total / 2.0);
  v_right   int := p_total - v_left;
  e         jsonb;
BEGIN
  -- rep_log: önce p_correct adet kusursuz tekrar, ardından her hata için
  -- "count" kadar uyarılı tekrar. Kol/bacak left/right dönüşümlü atanır.
  SELECT jsonb_agg(
           jsonb_build_object(
             'arm',      CASE WHEN (rn % 2) = 1 THEN 'left' ELSE 'right' END,
             'repNo',    rn,
             'score',    CASE WHEN correct
                              THEN (p_avg + (p_max - p_avg) * random())::int
                              ELSE (p_min + (p_avg - p_min) * random())::int END,
             'warnings', warnings
           ) ORDER BY rn
         )
    INTO v_replog
  FROM (
    SELECT row_number() OVER () AS rn, warnings, correct
    FROM (
      SELECT '[]'::jsonb AS warnings, TRUE AS correct
      FROM generate_series(1, p_correct)
      UNION ALL
      SELECT jsonb_build_array(el->>'warning'), FALSE
      FROM jsonb_array_elements(p_errors) el,
           generate_series(1, (el->>'count')::int)
    ) s
  ) numbered;

  -- ── workout_sessions ──
  INSERT INTO workout_sessions
    (id, user_id, exercise_id, duration_seconds,
     total_reps, left_reps, right_reps, correct_reps,
     avg_accuracy_pct, max_accuracy_pct, min_accuracy_pct,
     rep_log, status, started_at, ended_at)
  VALUES
    (v_session, p_user, p_exercise, p_duration,
     p_total, v_left, v_right, p_correct,
     p_avg, p_max, p_min,
     v_replog, 'completed', p_started, p_started + make_interval(secs => p_duration));

  -- ── session_errors (hata türü başına gruplanmış occurrence_count) ──
  FOR e IN SELECT * FROM jsonb_array_elements(p_errors)
  LOOP
    INSERT INTO session_errors
      (id, session_id, user_id, error_code, error_description,
       rep_number, occurrence_count, severity_score, detected_at)
    VALUES
      (gen_random_uuid(), v_session, p_user, e->>'code', e->>'warning',
       NULL, (e->>'count')::int, (e->>'severity')::numeric, p_started);
  END LOOP;
END;
$func$;

-- ── Asıl seed akışı ──
DO $$
DECLARE
  v_user     uuid;
  v_biceps   uuid;
  v_knee     uuid;
  v_shoulder uuid;
  v_lws      timestamptz := date_trunc('week', now()) - interval '7 days'; -- geçen hafta başı (Pzt)
BEGIN
  -- Hedef kullanıcı (en son oluşturulan hesap). Belirli e-posta için:
  --   SELECT id INTO v_user FROM auth.users WHERE email = 'senin@email.com';
  SELECT id INTO v_user FROM auth.users WHERE email = 'omerselimdurmann@gmail.com';
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth.users içinde kullanıcı bulunamadı.';
  END IF;

  SELECT id INTO v_biceps   FROM public.exercises WHERE slug = 'biceps_curl';
  SELECT id INTO v_knee     FROM public.exercises WHERE slug = 'knee-raise';
  SELECT id INTO v_shoulder FROM public.exercises WHERE slug = 'shoulder-abduction';
  IF v_biceps IS NULL OR v_knee IS NULL OR v_shoulder IS NULL THEN
    RAISE EXCEPTION 'Egzersizlerden biri bulunamadı (biceps_curl / knee-raise / shoulder-abduction).';
  END IF;

  -- Idempotency: bu kullanıcının son 15 gündeki bu 3 egzersize ait
  -- completed oturumlarını ve hatalarını temizle.
  DELETE FROM session_errors
  WHERE session_id IN (
    SELECT id FROM workout_sessions
    WHERE user_id = v_user
      AND exercise_id IN (v_biceps, v_knee, v_shoulder)
      AND status = 'completed'
      AND started_at >= now() - interval '15 days'
  );
  DELETE FROM workout_sessions
  WHERE user_id = v_user
    AND exercise_id IN (v_biceps, v_knee, v_shoulder)
    AND status = 'completed'
    AND started_at >= now() - interval '15 days';

  -- ════════════════════════════════════════════════════════════
  -- BICEPS CURL  (rapor metnindeki 4 hata: dirsek kaçışı, aşırı bükme,
  -- kolu tam açmama, gövdeyi geriye yaslama)
  -- ════════════════════════════════════════════════════════════
  -- Bugün
  PERFORM pg_temp.seed_session(v_user, v_biceps, now() - interval '2 hours', 240, 16, 14, 90.5, 80, 98,
    '[{"code":"over_curl","warning":"Kollarınızı fazla kırdınız","count":1,"severity":0.45},
      {"code":"elbow_drift","warning":"Dirseklerinizi biraz daha sabit tutun","count":1,"severity":0.4}]'::jsonb);
  -- Dün
  PERFORM pg_temp.seed_session(v_user, v_biceps, now() - interval '1 day 4 hours', 230, 14, 11, 87.0, 74, 97,
    '[{"code":"torso_lean","warning":"Gövdenizi hafif geriye yatırıyorsunuz","count":1,"severity":0.35},
      {"code":"elbow_drift","warning":"Dirseklerinizi biraz daha sabit tutun","count":1,"severity":0.4},
      {"code":"incomplete_extension","warning":"Kolu tam açmıyorsunuz — aşağı fazını tamamlayın","count":1,"severity":0.4}]'::jsonb);
  -- Geçen hafta (Çar)
  PERFORM pg_temp.seed_session(v_user, v_biceps, v_lws + interval '2 days 10 hours', 250, 14, 10, 82.0, 66, 95,
    '[{"code":"incomplete_extension","warning":"Kolu tam açmıyorsunuz — aşağı fazını tamamlayın","count":2,"severity":0.4},
      {"code":"elbow_drift","warning":"Dirseklerinizi biraz daha sabit tutun","count":1,"severity":0.4},
      {"code":"over_curl","warning":"Kollarınızı fazla kırdınız","count":1,"severity":0.45}]'::jsonb);
  -- Geçen hafta (Cum)
  PERFORM pg_temp.seed_session(v_user, v_biceps, v_lws + interval '4 days 9 hours', 245, 12, 8, 78.0, 60, 93,
    '[{"code":"elbow_drift","warning":"Dirseklerinizi biraz daha sabit tutun","count":2,"severity":0.4},
      {"code":"over_curl","warning":"Kollarınızı fazla kırdınız","count":1,"severity":0.45},
      {"code":"torso_lean","warning":"Gövdenizi hafif geriye yatırıyorsunuz","count":1,"severity":0.35}]'::jsonb);

  -- ════════════════════════════════════════════════════════════
  -- KNEE RAISE  (4 hata: diz alçak, momentum, geriye yaslanma, kalça twist)
  -- ════════════════════════════════════════════════════════════
  -- Bugün
  PERFORM pg_temp.seed_session(v_user, v_knee, now() - interval '3 hours', 260, 16, 13, 89.0, 78, 97,
    '[{"code":"torso_lean_back","warning":"Geriye yaslanma; gövdeni dik tut, core''unu sık","count":1,"severity":0.4},
      {"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede 1 sn dur","count":1,"severity":0.3},
      {"code":"knee_low","warning":"Dizini daha yukarı kaldır, uyluğun yere paralel olsun","count":1,"severity":0.5}]'::jsonb);
  -- Dün
  PERFORM pg_temp.seed_session(v_user, v_knee, now() - interval '1 day 6 hours', 240, 14, 11, 85.0, 72, 96,
    '[{"code":"hip_twist","warning":"Kalçalarını düz tut, yana eğilme","count":1,"severity":0.4},
      {"code":"knee_low","warning":"Dizini daha yukarı kaldır, uyluğun yere paralel olsun","count":1,"severity":0.5},
      {"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede 1 sn dur","count":1,"severity":0.3}]'::jsonb);
  -- Geçen hafta (Çar)
  PERFORM pg_temp.seed_session(v_user, v_knee, v_lws + interval '2 days 14 hours', 250, 14, 10, 81.0, 64, 94,
    '[{"code":"knee_low","warning":"Dizini daha yukarı kaldır, uyluğun yere paralel olsun","count":1,"severity":0.5},
      {"code":"torso_lean_back","warning":"Geriye yaslanma; gövdeni dik tut, core''unu sık","count":1,"severity":0.4},
      {"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede 1 sn dur","count":2,"severity":0.3}]'::jsonb);
  -- Geçen hafta (Cum)
  PERFORM pg_temp.seed_session(v_user, v_knee, v_lws + interval '4 days 11 hours', 235, 12, 8, 77.0, 60, 92,
    '[{"code":"knee_low","warning":"Dizini daha yukarı kaldır, uyluğun yere paralel olsun","count":2,"severity":0.5},
      {"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede 1 sn dur","count":1,"severity":0.3},
      {"code":"hip_twist","warning":"Kalçalarını düz tut, yana eğilme","count":1,"severity":0.4}]'::jsonb);

  -- ════════════════════════════════════════════════════════════
  -- SHOULDER ABDUCTION  (4 hata: düşük ROM, gövde yaslanma, omuz silkme, momentum)
  -- ════════════════════════════════════════════════════════════
  -- Bugün
  PERFORM pg_temp.seed_session(v_user, v_shoulder, now() - interval '1 hour', 220, 14, 12, 88.0, 76, 97,
    '[{"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede kısa dur","count":1,"severity":0.3},
      {"code":"rom_low","warning":"Kolunu daha yukarı kaldır, hareket açıklığını artır","count":1,"severity":0.5}]'::jsonb);
  -- Dün
  PERFORM pg_temp.seed_session(v_user, v_shoulder, now() - interval '1 day 2 hours', 225, 14, 11, 85.0, 70, 96,
    '[{"code":"trunk_lean","warning":"Gövdeni dik tut, yana yaslanma","count":1,"severity":0.4},
      {"code":"rom_low","warning":"Kolunu daha yukarı kaldır, hareket açıklığını artır","count":1,"severity":0.5},
      {"code":"shoulder_shrug","warning":"Omzunu kulağına doğru kaldırma, omuz sabit kalsın","count":1,"severity":0.35}]'::jsonb);
  -- Geçen hafta (Çar)
  PERFORM pg_temp.seed_session(v_user, v_shoulder, v_lws + interval '2 days 16 hours', 230, 12, 9, 80.0, 64, 93,
    '[{"code":"rom_low","warning":"Kolunu daha yukarı kaldır, hareket açıklığını artır","count":1,"severity":0.5},
      {"code":"momentum","warning":"Daha yavaş ve kontrollü; tepede kısa dur","count":1,"severity":0.3},
      {"code":"shoulder_shrug","warning":"Omzunu kulağına doğru kaldırma, omuz sabit kalsın","count":1,"severity":0.35}]'::jsonb);
  -- Geçen hafta (Per)
  PERFORM pg_temp.seed_session(v_user, v_shoulder, v_lws + interval '3 days 9 hours', 240, 12, 8, 76.0, 58, 90,
    '[{"code":"rom_low","warning":"Kolunu daha yukarı kaldır, hareket açıklığını artır","count":2,"severity":0.5},
      {"code":"shoulder_shrug","warning":"Omzunu kulağına doğru kaldırma, omuz sabit kalsın","count":1,"severity":0.35},
      {"code":"trunk_lean","warning":"Gövdeni dik tut, yana yaslanma","count":1,"severity":0.4}]'::jsonb);

  -- ════════════════════════════════════════════════════════════
  -- daily_stats (bugün) — "Tekrar Doğruluk Oranı" / "Genel Form Doğruluğu"
  -- kartı bu legacy tablodan okur. Bugünkü 3 oturumun toplamı.
  -- ════════════════════════════════════════════════════════════
  DELETE FROM daily_stats WHERE user_id = v_user AND stat_date = CURRENT_DATE;
  INSERT INTO daily_stats
    (id, user_id, stat_date, total_sessions, total_reps, total_correct_reps,
     avg_accuracy_pct, total_duration_seconds, accuracy_by_exercise,
     created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_user, CURRENT_DATE, 3, 46, 39,
     89.2, 720,
     '{"biceps_curl":{"avg_accuracy":90.5,"sessions":1,"reps":16},
       "knee-raise":{"avg_accuracy":89.0,"sessions":1,"reps":16},
       "shoulder-abduction":{"avg_accuracy":88.0,"sessions":1,"reps":14}}'::jsonb,
     now(), now());

  RAISE NOTICE 'Seed tamamlandı: kullanıcı %, 12 oturum + hatalar + daily_stats.', v_user;
END $$;

-- Geçici fonksiyonu temizle (oturum sonunda otomatik düşer ama açıkça da silelim).
DROP FUNCTION IF EXISTS pg_temp.seed_session(uuid, uuid, timestamptz, int, int, int, numeric, numeric, numeric, jsonb);
