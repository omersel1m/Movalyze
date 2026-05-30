export interface BicepsCurlConfig {
  ANGLE_DOWN: number;           // arm fully extended (rep bottom)
  ANGLE_UP: number;             // arm fully curled (rep top)
  ANGLE_OVER_CURL: number;      // over-curl warning threshold
  ANGLE_MIN_EXTEND: number;     // minimum extension to count full rep
  ELBOW_ANGLE_TOLERANCE: number;
  UA_VERT_TOLERANCE: number;
  TORSO_LEAN_TOLERANCE: number;
  MIN_VISIBILITY: number;
  SMOOTHING_ALPHA: number;
}

export const BICEPS_CURL_CONFIG: BicepsCurlConfig = {
  ANGLE_DOWN: 155,
  ANGLE_UP: 50,
  ANGLE_OVER_CURL: 20,
  ANGLE_MIN_EXTEND: 145,
  ELBOW_ANGLE_TOLERANCE: 15,
  UA_VERT_TOLERANCE: 12,
  TORSO_LEAN_TOLERANCE: 10,
  MIN_VISIBILITY: 0.3,
  SMOOTHING_ALPHA: 0.3,
};
