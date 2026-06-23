export interface ShoulderAbductionConfig {
  ABDUCTION_UP: number;         // enter UP / count rep above this arm-from-vertical angle
  ABDUCTION_DOWN: number;       // return to DOWN below this (completes the rep)
  ABDUCTION_TARGET: number;     // ideal peak ROM; H1 if the rep's peak stays below this
  TOP_BAND: number;             // within TARGET − this counts as "at the top" (hold timing)
  ELBOW_STRAIGHT_MIN: number;   // elbow angle below this during the raise = bent (H4)
  TRUNK_LEAN_TOLERANCE: number; // lateral trunk lean from vertical, degrees (H2)
  SHRUG_TOLERANCE: number;      // normalized shoulder elevation vs standing baseline (H3)
  OUT_OF_PLANE_TOLERANCE: number; // |elbow.z − shoulder.z| → arm raised forward, not to the side (H6)
  TOP_HOLD_MIN_SEC: number;     // minimum pause at the top, seconds (H5)
  MAX_ANGLE_VELOCITY: number;   // max arm-angle change in deg/sec before "momentum" (H5)
  MIN_VISIBILITY: number;
  SMOOTHING_ALPHA: number;
}

// Starting values — tune freely. Velocity/hold are time-based (deg/sec, seconds)
// so they stay correct under the variable frame rate of LIVE_STREAM inference.
export const SHOULDER_ABDUCTION_CONFIG: ShoulderAbductionConfig = {
  ABDUCTION_UP:           80,
  ABDUCTION_DOWN:         35,
  ABDUCTION_TARGET:       150,
  TOP_BAND:               25,
  ELBOW_STRAIGHT_MIN:     150,
  TRUNK_LEAN_TOLERANCE:   12,
  SHRUG_TOLERANCE:        0.10,
  OUT_OF_PLANE_TOLERANCE: 0.20,
  TOP_HOLD_MIN_SEC:       0.5,
  MAX_ANGLE_VELOCITY:     220,
  MIN_VISIBILITY:         0.5,
  SMOOTHING_ALPHA:        0.7,
};
