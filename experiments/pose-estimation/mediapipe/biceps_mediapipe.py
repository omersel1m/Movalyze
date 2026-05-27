import cv2
import numpy as np
import mediapipe as mp
from collections import deque
import time

# ── MediaPipe BlazePose ───────────────────────────────────────────────────────
mp_pose    = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_styles  = mp.solutions.drawing_styles

pose = mp_pose.Pose(
    model_complexity=1,           # 0=lite(hızlı), 1=full(dengeli), 2=heavy
    enable_segmentation=False,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)

# ── Sabitler ─────────────────────────────────────────────────────────────────
ANGLE_DOWN            = 155   # Bu açının üstünde → "aşağı" fazı
ANGLE_UP              = 50    # Bu açının altında  → "yukarı" fazı
ANGLE_OVER_CURL       = 20    # Bu açının altı → fazla kırma
ANGLE_MIN_EXTEND      = 145   # Tam açılmak için gereken minimum açı
KP_BUFFER             = 5     # Gürültü filtresi: kaç frame ortalaması
ELBOW_HIST            = 30    # Varyans: kaç frame'lik açı geçmişi
CONF_THRESHOLD        = 0.3   # Visibility eşiği (YOLO'daki conf ile eşdeğer)
ELBOW_ANGLE_TOLERANCE = 15.0  # Dirsek sapması toleransı (derece) — kalça ile
UA_VERT_TOLERANCE     = 12.0  # Üst kol dikey sapması toleransı (derece) — kalçasız
TORSO_LEAN_TOLERANCE  = 10.0  # Gövde eğilme toleransı (derece)
MAX_REP_LOG           = 6     # Ekranda gösterilecek maksimum tekrar sayısı

# MediaPipe PoseLandmark eşleştirmesi (YOLO integer index yerine)
LM = mp_pose.PoseLandmark
KP_IDX = {
    "l_shoulder": LM.LEFT_SHOULDER,   # 11
    "r_shoulder": LM.RIGHT_SHOULDER,  # 12
    "l_elbow":    LM.LEFT_ELBOW,      # 13
    "r_elbow":    LM.RIGHT_ELBOW,     # 14
    "l_wrist":    LM.LEFT_WRIST,      # 15
    "r_wrist":    LM.RIGHT_WRIST,     # 16
    "l_hip":      LM.LEFT_HIP,        # 23
    "r_hip":      LM.RIGHT_HIP,       # 24
}

# ── Durum ────────────────────────────────────────────────────────────────────
state           = "IDLE"
countdown_start = None
reference       = None
rep_count       = 0
phase           = "down"
rep_log         = []
rep_data        = {"elbow_drifts": [], "torso_drifts": [], "ua_vert_drifts": [],
                   "stabilities": [], "min_angle": 180.0, "max_angle": 0.0}

# ── Buffer'lar ───────────────────────────────────────────────────────────────
# MediaPipe'da 33 landmark var (0-32); YOLO'daki 17'nin yerine
kp_buffers  = {i: (deque(maxlen=KP_BUFFER), deque(maxlen=KP_BUFFER)) for i in range(33)}
l_ua_hist   = deque(maxlen=ELBOW_HIST)
r_ua_hist   = deque(maxlen=ELBOW_HIST)
l_angle_buf = deque(maxlen=KP_BUFFER)
r_angle_buf = deque(maxlen=KP_BUFFER)


# ── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

def vec_angle(v1, v2):
    """İki vektör arasındaki açıyı derece olarak döndürür."""
    v1, v2 = np.array(v1, dtype=float), np.array(v2, dtype=float)
    cos_val = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
    return np.degrees(np.arccos(np.clip(cos_val, -1.0, 1.0)))


def calculate_angle(a, b, c):
    """b noktasındaki dirsek açısını hesaplar."""
    a, b, c = np.array(a, dtype=float), np.array(b, dtype=float), np.array(c, dtype=float)
    return vec_angle(a - b, c - b)


def get_ua_vertical_angle(shoulder, elbow):
    """
    Üst kolun (omuz→dirsek) dikey eksene göre açısı.
    Kalça gerekmez — pozisyon ve ölçekten bağımsızdır.
    """
    ua_vec = np.array(elbow) - np.array(shoulder)
    return vec_angle(ua_vec, np.array([0.0, 1.0]))


def get_upper_arm_angle(shoulder, elbow, hip):
    """Üst kolun gövdeye göre açısı (kalça gerektirir)."""
    return vec_angle(np.array(hip) - np.array(shoulder),
                     np.array(elbow) - np.array(shoulder))


def get_torso_lean(shoulder, hip):
    """Gövdenin dikey eksenden sapma açısı (kalça gerektirir)."""
    return vec_angle(np.array(hip) - np.array(shoulder), np.array([0.0, 1.0]))


def get_smooth_kp(landmarks, lm_enum, frame_w, frame_h):
    """
    Visibility filtreli + hareketli ortalama uygulanmış keypoint koordinatı.
    MediaPipe normalize koordinatları (0-1) piksel koordinatına dönüştürür.
    """
    if landmarks is None:
        return None
    lm = landmarks[lm_enum]
    if lm.visibility < CONF_THRESHOLD:
        return None
    x = lm.x * frame_w
    y = lm.y * frame_h
    if x == 0 and y == 0:
        return None
    idx = lm_enum.value  # PoseLandmark enum → integer index (0-32)
    kp_buffers[idx][0].append(x)
    kp_buffers[idx][1].append(y)
    return (float(np.mean(kp_buffers[idx][0])), float(np.mean(kp_buffers[idx][1])))


def score_color(s):
    return (100, 255, 100) if s >= 70 else (0, 200, 255) if s >= 50 else (0, 0, 255)


def draw_text(img, text, pos, scale=0.7, color=(255, 255, 255), thickness=2):
    x, y = int(pos[0]), int(pos[1])
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    cv2.rectangle(img, (x - 5, y - th - 8), (x + tw + 5, y + 5), (0, 0, 0), -1)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)


def analyze_rep(data, has_hip):
    """
    Tekrar bittikten sonra biriken veriyi analiz eder.
    has_hip=True  → tam analiz (gövde + dirsek drift)
    has_hip=False → açı + dikey dirsek stabilitesi
    Döndürür: (overall_score, [uyari_metinleri])
    """
    warnings = []
    min_ang = data["min_angle"]
    max_ang = data["max_angle"]

    # ── Açı bazlı uyarılar (her zaman) ──────────────────────────────────────
    if min_ang < ANGLE_OVER_CURL:
        warnings.append("Kollarinizi fazla kirdiniz")
    elif min_ang > ANGLE_UP + 15:
        warnings.append("Kollarinizi yeterince kirmiyor sunuz — daha yukari kaldirin")

    if max_ang < ANGLE_MIN_EXTEND:
        warnings.append("Kolu tam acmiyorsunuz — asagi fazini tamamlayin")

    # ── Stabilite (her zaman — dikey açı varyansı) ───────────────────────────
    avg_stab = float(np.mean(data["stabilities"])) if data["stabilities"] else 100.0

    if avg_stab < 35:
        warnings.append("Hareket cok sarsintili — daha yavas ve kontrollü yapin")
    elif avg_stab < 60:
        warnings.append("Hareketi biraz daha kontrollü yapin")

    # ── Üst kol dikey sapması (kalça yoksa) ──────────────────────────────────
    if not has_hip and data["ua_vert_drifts"]:
        avg_ua = float(np.mean(data["ua_vert_drifts"]))
        if avg_ua > UA_VERT_TOLERANCE:
            warnings.append("Dirsekleriniz one/arkaya kaciyor")
        elif avg_ua > UA_VERT_TOLERANCE * 0.6:
            warnings.append("Dirseklerinizi biraz daha sabit tutun")

    # ── Tam analiz (kalça varsa) ──────────────────────────────────────────────
    if has_hip and data["elbow_drifts"]:
        avg_elbow = float(np.mean(data["elbow_drifts"]))
        avg_torso = float(np.mean(data["torso_drifts"])) if data["torso_drifts"] else 0.0

        if avg_elbow > ELBOW_ANGLE_TOLERANCE:
            warnings.append("Dirsekleriniz cok fazla one/arkaya kaciyor")
        elif avg_elbow > ELBOW_ANGLE_TOLERANCE * 0.6:
            warnings.append("Dirseklerinizi biraz daha sabit tutun")

        if avg_torso > TORSO_LEAN_TOLERANCE:
            warnings.append("Govdenizi cok fazla geriye yasliyor sunuz — dik durun")
        elif avg_torso > TORSO_LEAN_TOLERANCE * 0.6:
            warnings.append("Govdenizi hafif geriye yasliyorsunuz")

    # ── Skor hesabı ───────────────────────────────────────────────────────────
    angle_penalty = 0.0
    if max_ang < ANGLE_MIN_EXTEND:
        angle_penalty += (ANGLE_MIN_EXTEND - max_ang) / ANGLE_MIN_EXTEND * 30
    if min_ang < ANGLE_OVER_CURL:
        angle_penalty += (ANGLE_OVER_CURL - min_ang) / ANGLE_OVER_CURL * 20

    if has_hip and data["elbow_drifts"]:
        avg_elbow = float(np.mean(data["elbow_drifts"]))
        avg_torso = float(np.mean(data["torso_drifts"])) if data["torso_drifts"] else 0.0
        elbow_form = max(0.0, 100.0 - (avg_elbow / ELBOW_ANGLE_TOLERANCE) * 100.0)
        torso_form = max(0.0, 100.0 - (avg_torso  / TORSO_LEAN_TOLERANCE)  * 100.0)
        overall = max(0.0, 0.5 * elbow_form + 0.3 * avg_stab + 0.2 * torso_form - angle_penalty)
    else:
        avg_ua = float(np.mean(data["ua_vert_drifts"])) if data["ua_vert_drifts"] else 0.0
        ua_form = max(0.0, 100.0 - (avg_ua / UA_VERT_TOLERANCE) * 100.0)
        overall = max(0.0, 0.6 * ua_form + 0.4 * avg_stab - angle_penalty)

    if not warnings:
        warnings.append("Mukemmel form!")

    return round(overall, 1), warnings


def reset_state():
    global state, reference, rep_count, phase, countdown_start, rep_log, rep_data
    state = "IDLE"
    reference = None
    rep_count = 0
    phase = "down"
    countdown_start = None
    rep_log = []
    rep_data = {"elbow_drifts": [], "torso_drifts": [], "ua_vert_drifts": [],
                "stabilities": [], "min_angle": 180.0, "max_angle": 0.0}
    for i in range(33):  # MediaPipe: 33 landmark (YOLO'da 17 idi)
        kp_buffers[i][0].clear()
        kp_buffers[i][1].clear()
    l_ua_hist.clear()
    r_ua_hist.clear()
    l_angle_buf.clear()
    r_angle_buf.clear()


# ── Ana Döngü ────────────────────────────────────────────────────────────────
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w = frame.shape[:2]

    # MediaPipe BGR→RGB dönüşümü (performans için writeable=False)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb.flags.writeable = False
    results = pose.process(rgb)
    rgb.flags.writeable = True

    # Skeleton çizimi — YOLO'daki results.plot() yerine
    plotted_img = frame.copy()
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(
            plotted_img,
            results.pose_landmarks,
            mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp_styles.get_default_pose_landmarks_style(),
        )

    landmarks = results.pose_landmarks.landmark if results.pose_landmarks else None

    # ── IDLE ─────────────────────────────────────────────────────────────────
    if state == "IDLE":
        draw_text(plotted_img, "Hazir olun ve [S] tusuna basin",
                  (w // 2 - 240, h // 2), scale=0.9, color=(0, 255, 255))

    # ── COUNTDOWN ────────────────────────────────────────────────────────────
    elif state == "COUNTDOWN":
        elapsed   = time.time() - countdown_start
        remaining = 3 - int(elapsed)

        if remaining > 0:
            cv2.putText(plotted_img, str(remaining),
                        (w // 2 - 40, h // 2 + 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 6, (0, 255, 0), 10, cv2.LINE_AA)
            draw_text(plotted_img, "Baslangic pozisyonunda durun!",
                      (w // 2 - 220, 50), scale=0.9, color=(0, 255, 0))
        else:
            if landmarks is not None:
                pts = {name: get_smooth_kp(landmarks, idx, w, h)
                       for name, idx in KP_IDX.items()}
                arm_required  = ["l_shoulder", "l_elbow", "l_wrist",
                                  "r_shoulder", "r_elbow", "r_wrist"]
                hip_available = all(pts[k] is not None for k in ["l_hip", "r_hip"])

                if all(pts[k] is not None for k in arm_required):
                    ref = {
                        "l_ua_vert": get_ua_vertical_angle(pts["l_shoulder"], pts["l_elbow"]),
                        "r_ua_vert": get_ua_vertical_angle(pts["r_shoulder"], pts["r_elbow"]),
                    }
                    if hip_available:
                        ref["l_ua_angle"]   = get_upper_arm_angle(
                            pts["l_shoulder"], pts["l_elbow"], pts["l_hip"])
                        ref["r_ua_angle"]   = get_upper_arm_angle(
                            pts["r_shoulder"], pts["r_elbow"], pts["r_hip"])
                        ref["l_torso_lean"] = get_torso_lean(pts["l_shoulder"], pts["l_hip"])
                        ref["r_torso_lean"] = get_torso_lean(pts["r_shoulder"], pts["r_hip"])
                    reference = ref
                    state = "ACTIVE"
                    rep_count = 0
                    phase = "down"
                    rep_data = {"elbow_drifts": [], "torso_drifts": [], "ua_vert_drifts": [],
                                "stabilities": [], "min_angle": 180.0, "max_angle": 0.0}
                    print("Referans alindi (kalca=%s):" % hip_available, reference)
                else:
                    draw_text(plotted_img, "Kol noktalari algilanamadi — tekrar basin [S]",
                              (10, 50), color=(0, 0, 255))
                    state = "IDLE"

    # ── ACTIVE ───────────────────────────────────────────────────────────────
    elif state == "ACTIVE":
        if landmarks is not None:
            pts = {name: get_smooth_kp(landmarks, idx, w, h)
                   for name, idx in KP_IDX.items()}
            arm_ok = all(pts[k] is not None for k in ["l_shoulder", "l_elbow", "l_wrist",
                                                       "r_shoulder", "r_elbow", "r_wrist"])
            hip_ok = all(pts[k] is not None for k in ["l_hip", "r_hip"])

            if arm_ok:
                # ── Curl açısı ────────────────────────────────────────────────
                raw_l = calculate_angle(pts["l_shoulder"], pts["l_elbow"], pts["l_wrist"])
                raw_r = calculate_angle(pts["r_shoulder"], pts["r_elbow"], pts["r_wrist"])
                l_angle_buf.append(raw_l)
                r_angle_buf.append(raw_r)
                l_angle   = float(np.mean(l_angle_buf))
                r_angle   = float(np.mean(r_angle_buf))
                avg_angle = (l_angle + r_angle) / 2

                rep_data["min_angle"] = min(rep_data["min_angle"], avg_angle)
                rep_data["max_angle"] = max(rep_data["max_angle"], avg_angle)

                # ── Üst kol dikey açısı — kalça olmadan stabilite (HER ZAMAN) ─
                l_ua_v = get_ua_vertical_angle(pts["l_shoulder"], pts["l_elbow"])
                r_ua_v = get_ua_vertical_angle(pts["r_shoulder"], pts["r_elbow"])

                l_ua_hist.append(l_ua_v)
                r_ua_hist.append(r_ua_v)

                if len(l_ua_hist) > 5:
                    avg_var = (float(np.var(l_ua_hist)) + float(np.var(r_ua_hist))) / 2
                    stability_score = max(0.0, 100.0 - (avg_var / 25.0) * 100.0)
                else:
                    stability_score = 100.0

                ua_vert_drift = ((abs(l_ua_v - reference["l_ua_vert"]) +
                                  abs(r_ua_v - reference["r_ua_vert"])) / 2)

                rep_data["ua_vert_drifts"].append(ua_vert_drift)
                rep_data["stabilities"].append(stability_score)

                # ── Kalça varsa ek metrikler ───────────────────────────────────
                if hip_ok and "l_ua_angle" in reference:
                    l_ua = get_upper_arm_angle(pts["l_shoulder"], pts["l_elbow"], pts["l_hip"])
                    r_ua = get_upper_arm_angle(pts["r_shoulder"], pts["r_elbow"], pts["r_hip"])
                    avg_elbow_drift = (abs(l_ua - reference["l_ua_angle"]) +
                                       abs(r_ua - reference["r_ua_angle"])) / 2

                    l_torso = get_torso_lean(pts["l_shoulder"], pts["l_hip"])
                    r_torso = get_torso_lean(pts["r_shoulder"], pts["r_hip"])
                    avg_torso_drift = (abs(l_torso - reference["l_torso_lean"]) +
                                       abs(r_torso - reference["r_torso_lean"])) / 2

                    rep_data["elbow_drifts"].append(avg_elbow_drift)
                    rep_data["torso_drifts"].append(avg_torso_drift)

                    elbow_form   = max(0.0, 100.0 - (avg_elbow_drift / ELBOW_ANGLE_TOLERANCE) * 100.0)
                    torso_form   = max(0.0, 100.0 - (avg_torso_drift  / TORSO_LEAN_TOLERANCE)  * 100.0)
                    overall_form = 0.5 * elbow_form + 0.3 * stability_score + 0.2 * torso_form
                else:
                    avg_elbow_drift = None
                    avg_torso_drift = None
                    ua_form      = max(0.0, 100.0 - (ua_vert_drift / UA_VERT_TOLERANCE) * 100.0)
                    overall_form = 0.6 * ua_form + 0.4 * stability_score

                # ── Tekrar sayımı ─────────────────────────────────────────────
                if avg_angle < ANGLE_UP and phase == "down":
                    rep_count += 1
                    phase = "up"
                elif avg_angle > ANGLE_DOWN and phase == "up":
                    phase = "down"
                    score, warns = analyze_rep(rep_data, has_hip=hip_ok)
                    rep_log.append({"no": rep_count, "score": score, "warns": warns})
                    if len(rep_log) > MAX_REP_LOG:
                        rep_log.pop(0)
                    rep_data = {"elbow_drifts": [], "torso_drifts": [], "ua_vert_drifts": [],
                                "stabilities": [], "min_angle": 180.0, "max_angle": 0.0}

                # ── Sol panel: anlık bilgiler ──────────────────────────────────
                phase_text  = "YUKARI" if phase == "up" else "ASAGI"
                phase_color = (0, 255, 0) if phase == "up" else (0, 165, 255)

                y0 = 40
                draw_text(plotted_img, f"Tekrar : {rep_count}",
                          (10, y0), scale=1.2, color=(0, 255, 255), thickness=3)
                draw_text(plotted_img, f"Faz    : {phase_text}",
                          (10, y0 + 50), color=phase_color)
                draw_text(plotted_img, f"Sol Aci: {l_angle:.1f} deg",
                          (10, y0 + 85), color=(200, 200, 200))
                draw_text(plotted_img, f"Sag Aci: {r_angle:.1f} deg",
                          (10, y0 + 115), color=(200, 200, 200))
                draw_text(plotted_img, f"Stabilite  : {stability_score:.1f}%",
                          (10, y0 + 155), color=score_color(stability_score))
                draw_text(plotted_img, f"Form Skoru : {overall_form:.1f}%",
                          (10, y0 + 190), scale=0.9,
                          color=score_color(overall_form), thickness=2)

                if not hip_ok:
                    draw_text(plotted_img, "(Tam analiz icin bel gorunur olmali)",
                              (10, y0 + 220), scale=0.5, color=(150, 150, 150))

                # ── Sağ panel: tekrar geçmişi ─────────────────────────────────
                if rep_log:
                    px = w - 380
                    draw_text(plotted_img, "--- Tekrar Gecmisi ---",
                              (px, 40), scale=0.65, color=(200, 200, 200))
                    for i, entry in enumerate(reversed(rep_log)):
                        ry = 70 + i * 90
                        sc = entry["score"]
                        draw_text(plotted_img, f"#{entry['no']}  Form: {sc:.0f}%",
                                  (px, ry), scale=0.7,
                                  color=score_color(sc), thickness=2)
                        for wi, w_txt in enumerate(entry["warns"][:2]):
                            draw_text(plotted_img, f"  {w_txt}",
                                      (px, ry + 28 + wi * 24),
                                      scale=0.52, color=(0, 200, 255))

                # ── Anlık uyarılar (alt) ──────────────────────────────────────
                warn_y = h - 30

                if avg_angle < ANGLE_OVER_CURL:
                    draw_text(plotted_img, "! Kollarinizi fazla kiriyorsunuz!",
                              (10, warn_y), color=(0, 0, 255))
                    warn_y -= 35

                if avg_elbow_drift is not None:
                    if avg_elbow_drift > ELBOW_ANGLE_TOLERANCE * 0.6:
                        draw_text(plotted_img, "! Dirsekleriniz one/arkaya kaciyor!",
                                  (10, warn_y), color=(0, 0, 255))
                        warn_y -= 35
                elif ua_vert_drift > UA_VERT_TOLERANCE * 0.6:
                    draw_text(plotted_img, "! Dirsekleriniz one/arkaya kaciyor!",
                              (10, warn_y), color=(0, 0, 255))
                    warn_y -= 35

                if avg_torso_drift is not None and avg_torso_drift > TORSO_LEAN_TOLERANCE * 0.6:
                    draw_text(plotted_img, "! Govdenizi geriye yasliyorsunuz!",
                              (10, warn_y), color=(0, 0, 255))
                    warn_y -= 35

                if stability_score < 60:
                    draw_text(plotted_img, "! Hareketi daha kontrollü yapin!",
                              (10, warn_y), color=(0, 0, 255))

            else:
                draw_text(plotted_img, "Kisi algilanamadi...", (10, 50), color=(0, 0, 255))

        draw_text(plotted_img, "[R] Sifirla   [Q] Cik",
                  (w - 250, h - 20), scale=0.6, color=(180, 180, 180))

    # ── Pencere ──────────────────────────────────────────────────────────────
    cv2.imshow("Biceps Curl Tracker", plotted_img)

    key = cv2.waitKey(30) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('s') and state == "IDLE":
        state = "COUNTDOWN"
        countdown_start = time.time()
    elif key == ord('r'):
        reset_state()

cap.release()
cv2.destroyAllWindows()
pose.close()
