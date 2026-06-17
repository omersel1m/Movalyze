// Canonical error_code values stored in session_errors.error_code.
// These are the keys used for Form Error Breakdown on the Stats screen.

export const BICEPS_ERROR_CODES = {
  OVER_CURL:            'over_curl',
  INCOMPLETE_CURL:      'incomplete_curl',
  INCOMPLETE_EXTENSION: 'incomplete_extension',
  UNSTABLE_SEVERE:      'unstable_motion_severe',
  UNSTABLE:             'unstable_motion',
  ELBOW_DRIFT_SEVERE:   'elbow_drift_severe',
  ELBOW_DRIFT:          'elbow_drift',
  TORSO_LEAN_SEVERE:    'torso_lean_severe',
  TORSO_LEAN:           'torso_lean',
} as const;

export type BicepsErrorCode = (typeof BICEPS_ERROR_CODES)[keyof typeof BICEPS_ERROR_CODES];

// Map Turkish warning strings → canonical error codes
export const WARNING_TO_ERROR_CODE: Record<string, BicepsErrorCode> = {
  'Kollarınızı fazla kırdınız':                                       BICEPS_ERROR_CODES.OVER_CURL,
  'Kollarınızı yeterince kırmıyorsunuz — daha yukarı kaldırın':       BICEPS_ERROR_CODES.INCOMPLETE_CURL,
  'Kolu tam açmıyorsunuz — aşağı fazını tamamlayın':                  BICEPS_ERROR_CODES.INCOMPLETE_EXTENSION,
  'Hareket çok sarsıntılı — daha yavaş ve kontrollü yapın':           BICEPS_ERROR_CODES.UNSTABLE_SEVERE,
  'Hareketi biraz daha kontrollü yapın':                               BICEPS_ERROR_CODES.UNSTABLE,
  'Dirsekleriniz çok fazla öne/arkaya kaçıyor':                       BICEPS_ERROR_CODES.ELBOW_DRIFT_SEVERE,
  'Dirseklerinizi biraz daha sabit tutun':                             BICEPS_ERROR_CODES.ELBOW_DRIFT,
  'Dirsekleriniz öne/arkaya kaçıyor':                                  BICEPS_ERROR_CODES.ELBOW_DRIFT,
  'Gövdenizi çok fazla geriye yatırıyorsunuz — dik durun':            BICEPS_ERROR_CODES.TORSO_LEAN_SEVERE,
  'Gövdenizi hafif geriye yatırıyorsunuz':                             BICEPS_ERROR_CODES.TORSO_LEAN,
};

// Human-readable Turkish labels for the Stats screen
export const ERROR_CODE_LABELS: Record<BicepsErrorCode, string> = {
  over_curl:               'Fazla Kırma',
  incomplete_curl:         'Yetersiz Curl',
  incomplete_extension:    'Eksik Açılım',
  unstable_motion_severe:  'Çok Sarsıntılı',
  unstable_motion:         'Sarsıntılı',
  elbow_drift_severe:      'Dirsek Kayması',
  elbow_drift:             'Hafif Kayma',
  torso_lean_severe:       'Gövde Eğimi',
  torso_lean:              'Hafif Eğim',
};
