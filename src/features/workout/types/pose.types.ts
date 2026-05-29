// Tek landmark — MediaPipe normalised koordinatlar [0.0, 1.0]
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;          // kalçaya göre derinlik
  visibility: number; // [0.0, 1.0]
}

// Native tarafından gelen 33 elemanlı ham dizi
export type PoseLandmarks = PoseLandmark[];

// MediaPipe Pose Landmarker indeks → isim haritası (33 nokta)
export const LANDMARK_NAMES = [
  'nose',
  'leftEyeInner',  'leftEye',  'leftEyeOuter',
  'rightEyeInner', 'rightEye', 'rightEyeOuter',
  'leftEar',  'rightEar',
  'mouthLeft', 'mouthRight',
  'leftShoulder',  'rightShoulder',  // 11, 12
  'leftElbow',     'rightElbow',     // 13, 14
  'leftWrist',     'rightWrist',     // 15, 16
  'leftPinky',     'rightPinky',     // 17, 18
  'leftIndex',     'rightIndex',     // 19, 20
  'leftThumb',     'rightThumb',     // 21, 22
  'leftHip',       'rightHip',       // 23, 24
  'leftKnee',      'rightKnee',      // 25, 26
  'leftAnkle',     'rightAnkle',     // 27, 28
  'leftHeel',      'rightHeel',      // 29, 30
  'leftFootIndex', 'rightFootIndex', // 31, 32
] as const;

export type LandmarkName = typeof LANDMARK_NAMES[number];

// Ham dizi + isimle erişim — her iki yaklaşımı destekler
export type PoseResult = {
  raw: PoseLandmarks;
} & Partial<Record<LandmarkName, PoseLandmark>>;

// Ham dizi → PoseResult dönüşümü
export function toPoseResult(raw: PoseLandmarks): PoseResult {
  const result: PoseResult = { raw };
  LANDMARK_NAMES.forEach((name, index) => {
    const lm = raw[index];
    if (lm != null) {
      (result as Record<string, unknown>)[name] = lm;
    }
  });
  return result;
}
