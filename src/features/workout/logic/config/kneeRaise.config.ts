export interface KneeRaiseConfig {
  HIP_FLEXION_UP: number;        // enter UP / count rep below this hip-flexion angle (lenient gate)
  HIP_FLEXION_DOWN: number;      // return to DOWN above this (completes the rep)
  HIP_FLEXION_TARGET: number;    // ideal top; H1 if the rep's best (min) angle stays above this
  HIP_TOP_BAND: number;          // within TARGET + this band counts as "at the top" (hold timing)
  TORSO_DEPTH_TOLERANCE: number; // |depth offset − standing baseline| beyond this = lean (H2/H3)
  HIP_TILT_TOLERANCE: number;    // normalized hip tilt beyond this = twist / side bend (H4)
  SUPPORT_KNEE_LOCK: number;     // support-leg knee angle above this = locked knee (H6)
  TOP_HOLD_MIN_SEC: number;      // minimum pause at the top, in seconds (H5)
  MAX_ANGLE_VELOCITY: number;    // max hip-angle change in deg/sec before "momentum" (H5)
  MIN_VISIBILITY: number;
  SMOOTHING_ALPHA: number;
}

// Starting values — tune freely. Velocity/hold are time-based (deg/sec, seconds)
// so they stay correct under the variable frame rate of LIVE_STREAM inference.
export const KNEE_RAISE_CONFIG: KneeRaiseConfig = {
  HIP_FLEXION_UP:        115,
  HIP_FLEXION_DOWN:      150,
  HIP_FLEXION_TARGET:    100,
  HIP_TOP_BAND:          15,
  TORSO_DEPTH_TOLERANCE: 0.12,
  HIP_TILT_TOLERANCE:    0.15,
  SUPPORT_KNEE_LOCK:     175,
  TOP_HOLD_MIN_SEC:      0.7,
  MAX_ANGLE_VELOCITY:    220,
  MIN_VISIBILITY:        0.5,
  SMOOTHING_ALPHA:       0.7,
};
