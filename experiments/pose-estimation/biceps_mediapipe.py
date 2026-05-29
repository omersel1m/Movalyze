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
    model_complexity=1,
    enable_segmentation=False,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)

# ── Sabitler ─────────────────────────────────────────────────────────────────
ANGLE_DOWN            = 155
ANGLE_UP              = 50
ANGLE_OVER_CURL       = 20
ANGLE_MIN_EXTEND      = 145
KP_BUFFER             = 5
WINDOW_SEC            = 1.0    # FPS bağımsız stabilite penceresi (saniye)
CONF_THRESHOLD        = 0.3
ELBOW_ANGLE_TOLERANCE = 15.0
UA_VERT_TOLERANCE     = 12.0
TORSO_LEAN_TOLERANCE  = 10.0
MAX_REP_LOG           = 6

LM = mp_pose.PoseLandmark
KP_IDX = {
    "l_shoulder": LM.LEFT_SHOULDER,
    "r_shoulder": LM.RIGHT_SHOULDER,
    "l_elbow":    LM.LEFT_ELBOW,
    "r_elbow":    LM.RIGHT_ELBOW,
    "l_wrist":    LM.LEFT_WRIST,
    "r_wrist":    LM.RIGHT_WRIST,
    "l_hip":      LM.LEFT_HIP,
    "r_hip":      LM.RIGHT_HIP,
}

ARM_KEYS = {
    "left":  {"shoulder": "l_shoulder", "elbow": "l_elbow",
               "wrist":   "l_wrist",    "hip":   "l_hip"},
    "right": {"shoulder": "r_shoulder", "elbow": "r_elbow",
               "wrist":   "r_wrist",    "hip":   "r_hip"},
}

# ── Durum Yönetimi ────────────────────────────────────────────────────────────
def make_rep_data():
    return {"elbow_drifts": [], "torso_drifts": [], "ua_vert_drifts": [],
            "stabilities": [], "min_angle": 180.0, "max_angle": 0.0}

def make_arm_state():
    return {
        "phase":     "down",
        "rep_count": 0,
        "rep_data":  make_rep_data(),
        "angle_buf": deque(maxlen=KP_BUFFER),
        "ua_hist":   [],   # [(timestamp_float, ua_vertical_angle_float), ...]
    }

state           = "IDLE"
countdown_start = None
reference       = None   # {"left": {"ua_vert":…, ["ua_angle":…, "torso_lean":…]}, "right": {…}}
arms            = {"left": make_arm_state(), "right": make_arm_state()}
rep_log         = []     # [{"arm":"left"/"right", "no":int, "score":float, "warns":[str]}]

kp_buffers = {i: (deque(maxlen=KP_BUFFER), deque(maxlen=KP_BUFFER)) for i in range(33)}


# ── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

def vec_angle(v1, v2):
    v1, v2 = np.array(v1, dtype=float), np.array(v2, dtype=float)
    cos_val = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
    return np.degrees(np.arccos(np.clip(cos_val, -1.0, 1.0)))

def calculate_angle(a, b, c):
    a, b, c = np.array(a, dtype=float), np.array(b, dtype=float), np.array(c, dtype=float)
    return vec_angle(a - b, c - b)

def get_ua_vertical_angle(shoulder, elbow):
    return vec_angle(np.array(elbow) - np.array(shoulder), np.array([0.0, 1.0]))

def get_upper_arm_angle(shoulder, elbow, hip):
    return vec_angle(np.array(hip) - np.array(shoulder),
                     np.array(elbow) - np.array(shoulder))

def get_torso_lean(shoulder, hip):
    return vec_angle(np.array(hip) - np.array(shoulder), np.array([0.0, 1.0]))

def get_smooth_kp(landmarks, lm_enum, frame_w, frame_h):
    if landmarks is None:
        return None
    lm = landmarks[lm_enum]
    if lm.visibility < CONF_THRESHOLD:
        return None
    x = lm.x * frame_w
    y = lm.y * frame_h
    if x == 0 and y == 0:
        return None
    idx = lm_enum.value
    kp_buffers[idx][0].append(x)
    kp_buffers[idx][1].append(y)
    return (float(np.mean(kp_buffers[idx][0])), float(np.mean(kp_buffers[idx][1])))

def windowed_variance(ua_hist, now):
    """Son WINDOW_SEC saniyedeki açı geçmişinin varyansı. FPS bağımsız."""
    cutoff = now - WINDOW_SEC
    while ua_hist and ua_hist[0][0] < cutoff:
        ua_hist.pop(0)
    if len(ua_hist) < 3:
        return 0.0
    return float(np.var([v for _, v in ua_hist]))

def score_color(s):
    return (100, 255, 100) if s >= 70 else (0, 200, 255) if s >= 50 else (0, 0, 255)

def draw_text(img, text, pos, scale=0.7, color=(255, 255, 255), thickness=2):
    x, y = int(pos[0]), int(pos[1])
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    cv2.rectangle(img, (x - 5, y - th - 8), (x + tw + 5, y + 5), (0, 0, 0), -1)
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)

def analyze_rep(data, has_hip):
    warnings = []
    min_ang, max_ang = data["min_angle"], data["max_angle"]

    if min_ang < ANGLE_OVER_CURL:
        warnings.append("Kollarinizi fazla kirdiniz")
    elif min_ang > ANGLE_UP + 15:
        warnings.append("Kollarinizi yeterince kirmiyor sunuz — daha yukari kaldirin")

    if max_ang < ANGLE_MIN_EXTEND:
        warnings.append("Kolu tam acmiyorsunuz — asagi fazini tamamlayin")

    avg_stab = float(np.mean(data["stabilities"])) if data["stabilities"] else 100.0
    if avg_stab < 35:
        warnings.append("Hareket cok sarsintili — daha yavas ve kontrollü yapin")
    elif avg_stab < 60:
        warnings.append("Hareketi biraz daha kontrollü yapin")

    if not has_hip and data["ua_vert_drifts"]:
        avg_ua = float(np.mean(data["ua_vert_drifts"]))
        if avg_ua > UA_VERT_TOLERANCE:
            warnings.append("Dirsekleriniz one/arkaya kaciyor")
        elif avg_ua > UA_VERT_TOLERANCE * 0.6:
            warnings.append("Dirseklerinizi biraz daha sabit tutun")

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

    angle_penalty = 0.0
    if max_ang < ANGLE_MIN_EXTEND:
        angle_penalty += (ANGLE_MIN_EXTEND - max_ang) / ANGLE_MIN_EXTEND * 30
    if min_ang < ANGLE_OVER_CURL:
        angle_penalty += (ANGLE_OVER_CURL - min_ang) / ANGLE_OVER_CURL * 20

    if has_hip and data["elbow_drifts"]:
        avg_elbow  = float(np.mean(data["elbow_drifts"]))
        avg_torso  = float(np.mean(data["torso_drifts"])) if data["torso_drifts"] else 0.0
        elbow_form = max(0.0, 100.0 - (avg_elbow / ELBOW_ANGLE_TOLERANCE) * 100.0)
        torso_form = max(0.0, 100.0 - (avg_torso  / TORSO_LEAN_TOLERANCE)  * 100.0)
        overall    = max(0.0, 0.5 * elbow_form + 0.3 * avg_stab + 0.2 * torso_form - angle_penalty)
    else:
        avg_ua  = float(np.mean(data["ua_vert_drifts"])) if data["ua_vert_drifts"] else 0.0
        ua_form = max(0.0, 100.0 - (avg_ua / UA_VERT_TOLERANCE) * 100.0)
        overall = max(0.0, 0.6 * ua_form + 0.4 * avg_stab - angle_penalty)

    if not warnings:
        warnings.append("Mukemmel form!")
    return round(overall, 1), warnings


def process_arm(side, arm, pts, hip_ok, ref, now):
    """
    Tek bir kolun mevcut frame analizini yapar, durum değişkenlerini günceller.
    Döndürür: dict
    """
    keys = ARM_KEYS[side]
    sh   = pts[keys["shoulder"]]
    el   = pts[keys["elbow"]]
    wr   = pts[keys["wrist"]]
    hp   = pts[keys["hip"]] if hip_ok else None

    # ── Curl açısı (smoothed)
    raw_angle = calculate_angle(sh, el, wr)
    arm["angle_buf"].append(raw_angle)
    angle = float(np.mean(arm["angle_buf"]))
    arm["rep_data"]["min_angle"] = min(arm["rep_data"]["min_angle"], angle)
    arm["rep_data"]["max_angle"] = max(arm["rep_data"]["max_angle"], angle)

    # ── Üst kol dikey açısı + FPS bağımsız varyans
    ua_v = get_ua_vertical_angle(sh, el)
    arm["ua_hist"].append((now, ua_v))
    var       = windowed_variance(arm["ua_hist"], now)
    stability = max(0.0, 100.0 - (var / 25.0) * 100.0)

    # ── ua_vert_drift (referanstan sapma)
    ref_side      = (ref or {}).get(side, {})
    ref_ua_vert   = ref_side.get("ua_vert", ua_v)
    ua_vert_drift = abs(ua_v - ref_ua_vert)
    arm["rep_data"]["ua_vert_drifts"].append(ua_vert_drift)
    arm["rep_data"]["stabilities"].append(stability)

    # ── Kalça bazlı ek metrikler
    elbow_drift = None
    torso_drift = None
    if hp is not None and "ua_angle" in ref_side:
        ua_angle    = get_upper_arm_angle(sh, el, hp)
        torso_lean  = get_torso_lean(sh, hp)
        elbow_drift = abs(ua_angle   - ref_side["ua_angle"])
        torso_drift = abs(torso_lean - ref_side["torso_lean"])
        arm["rep_data"]["elbow_drifts"].append(elbow_drift)
        arm["rep_data"]["torso_drifts"].append(torso_drift)
        elbow_form   = max(0.0, 100.0 - (elbow_drift / ELBOW_ANGLE_TOLERANCE) * 100.0)
        torso_form   = max(0.0, 100.0 - (torso_drift  / TORSO_LEAN_TOLERANCE)  * 100.0)
        overall_form = 0.5 * elbow_form + 0.3 * stability + 0.2 * torso_form
    else:
        ua_form      = max(0.0, 100.0 - (ua_vert_drift / UA_VERT_TOLERANCE) * 100.0)
        overall_form = 0.6 * ua_form + 0.4 * stability

    # ── Faz ve tekrar sayımı
    completed_rep = False
    if angle < ANGLE_UP and arm["phase"] == "down":
        arm["rep_count"] += 1
        arm["phase"] = "up"
    elif angle > ANGLE_DOWN and arm["phase"] == "up":
        arm["phase"] = "down"
        completed_rep = True

    return {
        "angle":         angle,
        "stability":     stability,
        "overall_form":  overall_form,
        "elbow_drift":   elbow_drift,
        "torso_drift":   torso_drift,
        "ua_vert_drift": ua_vert_drift,
        "completed_rep": completed_rep,
    }


def reset_state():
    global state, reference, arms, countdown_start, rep_log
    state           = "IDLE"
    reference       = None
    countdown_start = None
    rep_log         = []
    arms            = {"left": make_arm_state(), "right": make_arm_state()}
    for i in range(33):
        kp_buffers[i][0].clear()
        kp_buffers[i][1].clear()


# ── Ana Döngü ────────────────────────────────────────────────────────────────
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w  = frame.shape[:2]

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb.flags.writeable = False
    results = pose.process(rgb)
    rgb.flags.writeable = True

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

                left_ok  = all(pts[k] is not None for k in ["l_shoulder", "l_elbow", "l_wrist"])
                right_ok = all(pts[k] is not None for k in ["r_shoulder", "r_elbow", "r_wrist"])
                hip_ok   = all(pts[k] is not None for k in ["l_hip", "r_hip"])

                if left_ok or right_ok:
                    ref = {}
                    for side in ["left", "right"]:
                        arm_ok = left_ok if side == "left" else right_ok
                        if not arm_ok:
                            continue
                        keys = ARM_KEYS[side]
                        sh   = pts[keys["shoulder"]]
                        el   = pts[keys["elbow"]]
                        hp   = pts[keys["hip"]]
                        ref[side] = {"ua_vert": get_ua_vertical_angle(sh, el)}
                        if hip_ok and hp is not None:
                            ref[side]["ua_angle"]   = get_upper_arm_angle(sh, el, hp)
                            ref[side]["torso_lean"] = get_torso_lean(sh, hp)

                    reference = ref
                    arms      = {"left": make_arm_state(), "right": make_arm_state()}
                    state     = "ACTIVE"
                    print("Referans alindi (kalca=%s):" % hip_ok, reference)
                else:
                    draw_text(plotted_img, "Kol noktalari algilanamadi — tekrar basin [S]",
                              (10, 50), color=(0, 0, 255))
                    state = "IDLE"

    # ── ACTIVE ───────────────────────────────────────────────────────────────
    elif state == "ACTIVE":
        now = time.time()

        if landmarks is not None:
            pts = {name: get_smooth_kp(landmarks, idx, w, h)
                   for name, idx in KP_IDX.items()}

            left_ok  = all(pts[k] is not None for k in ["l_shoulder", "l_elbow", "l_wrist"])
            right_ok = all(pts[k] is not None for k in ["r_shoulder", "r_elbow", "r_wrist"])
            hip_ok   = all(pts[k] is not None for k in ["l_hip", "r_hip"])

            if not left_ok and not right_ok:
                draw_text(plotted_img, "Kisi algilanamadi...", (10, 50), color=(0, 0, 255))
            else:
                arm_results = {}

                for side in ["left", "right"]:
                    if not (left_ok if side == "left" else right_ok):
                        continue
                    res = process_arm(side, arms[side], pts, hip_ok, reference, now)
                    arm_results[side] = res

                    if res["completed_rep"]:
                        has_hip = bool(arms[side]["rep_data"]["elbow_drifts"])
                        score, warns = analyze_rep(arms[side]["rep_data"], has_hip=has_hip)
                        rep_log.append({"arm": side, "no": arms[side]["rep_count"],
                                        "score": score, "warns": warns})
                        if len(rep_log) > MAX_REP_LOG:
                            rep_log.pop(0)
                        arms[side]["rep_data"] = make_rep_data()

                # ── Sol panel: tekrar sayısı ──────────────────────────────────
                l_count = arms["left"]["rep_count"]
                r_count = arms["right"]["rep_count"]

                # Her iki kol görünüyor ve sayaçlar eşit → bilateral mod
                bilateral_mode = left_ok and right_ok and l_count == r_count

                y0 = 40
                if bilateral_mode or not (left_ok and right_ok):
                    draw_text(plotted_img, f"Tekrar : {max(l_count, r_count)}",
                              (10, y0), scale=1.2, color=(0, 255, 255), thickness=3)
                else:
                    # Alternating: sayaçlar farklı → ayrı göster
                    draw_text(plotted_img, f"Sol: {l_count}  |  Sag: {r_count}",
                              (10, y0), scale=1.0, color=(0, 255, 255), thickness=3)

                # Faz: herhangi bir kol "up"taysa YUKARI
                any_up      = any(arms[s]["phase"] == "up" for s in arm_results)
                phase_text  = "YUKARI" if any_up else "ASAGI"
                phase_color = (0, 255, 0) if any_up else (0, 165, 255)
                draw_text(plotted_img, f"Faz    : {phase_text}",
                          (10, y0 + 50), color=phase_color)

                # Açılar
                y_ang = y0 + 85
                for side in ["left", "right"]:
                    if side not in arm_results:
                        continue
                    label = "Sol Aci" if side == "left" else "Sag Aci"
                    draw_text(plotted_img, f"{label}: {arm_results[side]['angle']:.1f} deg",
                              (10, y_ang), color=(200, 200, 200))
                    y_ang += 30

                # Ortalama stabilite ve form skoru
                stab_vals = [arm_results[s]["stability"]    for s in arm_results]
                form_vals = [arm_results[s]["overall_form"] for s in arm_results]
                avg_stab  = float(np.mean(stab_vals))
                avg_form  = float(np.mean(form_vals))

                draw_text(plotted_img, f"Stabilite  : {avg_stab:.1f}%",
                          (10, y_ang + 10), color=score_color(avg_stab))
                draw_text(plotted_img, f"Form Skoru : {avg_form:.1f}%",
                          (10, y_ang + 45), scale=0.9,
                          color=score_color(avg_form), thickness=2)

                if not hip_ok:
                    draw_text(plotted_img, "(Tam analiz icin bel gorunur olmali)",
                              (10, y_ang + 80), scale=0.5, color=(150, 150, 150))

                # ── Sağ panel: tekrar geçmişi ─────────────────────────────────
                if rep_log:
                    px = w - 380
                    draw_text(plotted_img, "--- Tekrar Gecmisi ---",
                              (px, 40), scale=0.65, color=(200, 200, 200))
                    for i, entry in enumerate(reversed(rep_log)):
                        ry      = 70 + i * 90
                        sc      = entry["score"]
                        arm_lbl = "Sol" if entry["arm"] == "left" else "Sag"
                        draw_text(plotted_img, f"#{entry['no']} ({arm_lbl})  Form: {sc:.0f}%",
                                  (px, ry), scale=0.7, color=score_color(sc), thickness=2)
                        for wi, w_txt in enumerate(entry["warns"][:2]):
                            draw_text(plotted_img, f"  {w_txt}",
                                      (px, ry + 28 + wi * 24),
                                      scale=0.52, color=(0, 200, 255))

                # ── Anlık uyarılar (alt) ──────────────────────────────────────
                warn_y    = h - 30
                shown_ids = set()

                for side, res in arm_results.items():
                    if "over_curl" not in shown_ids and res["angle"] < ANGLE_OVER_CURL:
                        draw_text(plotted_img, "! Kollarinizi fazla kiriyorsunuz!",
                                  (10, warn_y), color=(0, 0, 255))
                        warn_y -= 35
                        shown_ids.add("over_curl")

                for side, res in arm_results.items():
                    if "elbow" not in shown_ids:
                        if (res["elbow_drift"] is not None and
                                res["elbow_drift"] > ELBOW_ANGLE_TOLERANCE * 0.6):
                            draw_text(plotted_img, "! Dirsekleriniz one/arkaya kaciyor!",
                                      (10, warn_y), color=(0, 0, 255))
                            warn_y -= 35
                            shown_ids.add("elbow")
                        elif (res["elbow_drift"] is None and
                              res["ua_vert_drift"] > UA_VERT_TOLERANCE * 0.6):
                            draw_text(plotted_img, "! Dirsekleriniz one/arkaya kaciyor!",
                                      (10, warn_y), color=(0, 0, 255))
                            warn_y -= 35
                            shown_ids.add("elbow")

                for side, res in arm_results.items():
                    if ("torso" not in shown_ids and res["torso_drift"] is not None
                            and res["torso_drift"] > TORSO_LEAN_TOLERANCE * 0.6):
                        draw_text(plotted_img, "! Govdenizi geriye yasliyorsunuz!",
                                  (10, warn_y), color=(0, 0, 255))
                        warn_y -= 35
                        shown_ids.add("torso")

                if avg_stab < 60:
                    draw_text(plotted_img, "! Hareketi daha kontrollü yapin!",
                              (10, warn_y), color=(0, 0, 255))

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
