// Canonical error_code values stored in session_errors.error_code for the
// Shoulder Abduction. Same pattern as the other analyzers: warning string →
// canonical code → human label for the Stats screen breakdown.

export const SHOULDER_ABDUCTION_ERROR_CODES = {
  ROM_LOW:      'rom_low',          // H1 — yetersiz hareket açıklığı
  TRUNK_LEAN:   'trunk_lean',       // H2 — gövde yana yaslanma
  SHRUG:        'shoulder_shrug',   // H3 — omuz silkme
  BENT_ELBOW:   'bent_elbow',       // H4 — bükük dirsek
  MOMENTUM:     'momentum',         // H5 — momentum / kontrolsüz
  OUT_OF_PLANE: 'out_of_plane',     // H6 — kolu öne kaldırma (düzlem dışı)
} as const;

export type ShoulderAbductionErrorCode =
  (typeof SHOULDER_ABDUCTION_ERROR_CODES)[keyof typeof SHOULDER_ABDUCTION_ERROR_CODES];

// Turkish warning strings (emitted by the analyzer) → canonical codes
export const WARNING_TO_ERROR_CODE: Record<string, ShoulderAbductionErrorCode> = {
  'Kolunu daha yukarı kaldır, hareket açıklığını artır':   SHOULDER_ABDUCTION_ERROR_CODES.ROM_LOW,
  'Gövdeni dik tut, yana yaslanma':                        SHOULDER_ABDUCTION_ERROR_CODES.TRUNK_LEAN,
  'Omzunu kulağına doğru kaldırma, omuz sabit kalsın':     SHOULDER_ABDUCTION_ERROR_CODES.SHRUG,
  'Dirseğini düz tut':                                     SHOULDER_ABDUCTION_ERROR_CODES.BENT_ELBOW,
  'Daha yavaş ve kontrollü; tepede kısa dur':              SHOULDER_ABDUCTION_ERROR_CODES.MOMENTUM,
  'Kolunu yana aç, öne doğru kaldırma':                    SHOULDER_ABDUCTION_ERROR_CODES.OUT_OF_PLANE,
};

// Human-readable Turkish labels for the Stats screen
export const ERROR_CODE_LABELS: Record<ShoulderAbductionErrorCode, string> = {
  rom_low:      'Düşük ROM',
  trunk_lean:   'Gövde Eğimi',
  shoulder_shrug: 'Omuz Silkme',
  bent_elbow:   'Bükük Dirsek',
  momentum:     'Momentum',
  out_of_plane: 'Düzlem Dışı',
};
