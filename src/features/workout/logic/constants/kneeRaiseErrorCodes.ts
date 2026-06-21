// Canonical error_code values stored in session_errors.error_code for the
// Standing Knee Raise. Same pattern as bicepsErrorCodes: warning string →
// canonical code → human label for the Stats screen breakdown.

export const KNEE_RAISE_ERROR_CODES = {
  KNEE_LOW:        'knee_low',         // H1 — diz yeterince yükselmiyor
  LEAN_BACK:       'torso_lean_back',  // H2 — geriye yaslanma
  LEAN_FORWARD:    'torso_lean_fwd',   // H3 — öne eğilme
  HIP_TWIST:       'hip_twist',        // H4 — kalça eğilmesi / twist
  MOMENTUM:        'momentum',         // H5 — momentum / hız, tepede duraklama yok
  SUPPORT_LOCKED:  'support_knee_locked', // H6 — destek dizi kilitli
} as const;

export type KneeRaiseErrorCode =
  (typeof KNEE_RAISE_ERROR_CODES)[keyof typeof KNEE_RAISE_ERROR_CODES];

// Turkish warning strings (emitted by the analyzer) → canonical codes
export const WARNING_TO_ERROR_CODE: Record<string, KneeRaiseErrorCode> = {
  'Dizini daha yukarı kaldır, uyluğun yere paralel olsun': KNEE_RAISE_ERROR_CODES.KNEE_LOW,
  'Geriye yaslanma; gövdeni dik tut, core\'unu sık':       KNEE_RAISE_ERROR_CODES.LEAN_BACK,
  'Öne eğilme, omurganı nötr tut':                          KNEE_RAISE_ERROR_CODES.LEAN_FORWARD,
  'Kalçalarını düz tut, yana eğilme':                       KNEE_RAISE_ERROR_CODES.HIP_TWIST,
  'Daha yavaş ve kontrollü; tepede 1 sn dur':               KNEE_RAISE_ERROR_CODES.MOMENTUM,
  'Destek dizini kilitleme, hafif bük':                     KNEE_RAISE_ERROR_CODES.SUPPORT_LOCKED,
};

// Human-readable Turkish labels for the Stats screen
export const ERROR_CODE_LABELS: Record<KneeRaiseErrorCode, string> = {
  knee_low:             'Diz Alçak',
  torso_lean_back:      'Geriye Yaslanma',
  torso_lean_fwd:       'Öne Eğilme',
  hip_twist:            'Kalça Twist',
  momentum:             'Momentum',
  support_knee_locked:  'Destek Diz Kilitli',
};
