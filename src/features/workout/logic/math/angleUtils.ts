import { PoseLandmark } from '../../types/pose.types';

type Vec2 = { x: number; y: number };

function vecAngle(v1: Vec2, v2: Vec2): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI));
}

// Angle at joint B, between rays B→A and B→C (uses 2D x/y)
export function calculateJointAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  return vecAngle(
    { x: a.x - b.x, y: a.y - b.y },
    { x: c.x - b.x, y: c.y - b.y },
  );
}

// Angle between two arbitrary 2D vectors
export function calculateVectorAngle(v1: Vec2, v2: Vec2): number {
  return vecAngle(v1, v2);
}

// Angle between upper arm vector (shoulder→elbow) and vertical axis
export function calculateUpperArmVerticalAngle(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
): number {
  return vecAngle(
    { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y },
    { x: 0, y: 1 },
  );
}

// Angle between torso direction (shoulder→hip) and upper arm direction (shoulder→elbow)
// mirrors get_upper_arm_angle() in biceps_mediapipe.py
export function calculateUpperArmAngle(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
  hip: PoseLandmark,
): number {
  return vecAngle(
    { x: hip.x - shoulder.x, y: hip.y - shoulder.y },
    { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y },
  );
}

// Angle between torso vector (shoulder→hip) and vertical axis
export function calculateTorsoLean(shoulder: PoseLandmark, hip: PoseLandmark): number {
  return vecAngle(
    { x: hip.x - shoulder.x, y: hip.y - shoulder.y },
    { x: 0, y: 1 },
  );
}

// Midpoint of two landmarks (x/y/z averaged)
export function midpoint(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

// Front/back torso lean from a frontal camera, using MediaPipe depth (z).
// z is depth relative to hips; negative ≈ toward camera. Returns shoulderMid.z −
// hipMid.z: positive = shoulders behind hips (leaning back), negative = forward.
// Noisier than 2D angles, so used with a generous tolerance + a standing baseline.
export function calculateTorsoDepthOffset(shoulderMid: PoseLandmark, hipMid: PoseLandmark): number {
  return shoulderMid.z - hipMid.z;
}

// Normalized lateral pelvic drop / hip tilt: vertical hip gap relative to hip
// width. ~0 when hips are level; grows as one hip drops (twist / side bend).
export function calculateHipTilt(leftHip: PoseLandmark, rightHip: PoseLandmark): number {
  const width = Math.abs(leftHip.x - rightHip.x);
  if (width < 1e-4) return 0;
  return Math.abs(leftHip.y - rightHip.y) / width;
}
