import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { PoseLandmarks, toPoseResult, PoseResult } from '../types/pose.types';
import { smoothPose } from '../logic/pose/poseSmoothing';
import {
  analyzeBicepsCurl,
  BicepsCurlState,
  INITIAL_BICEPS_CURL_STATE,
} from '../logic/analyzers/bicepsCurlAnalyzer';
import { BICEPS_CURL_CONFIG } from '../logic/config/bicepsCurl.config';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
const POSE_EVENT = 'PoseLandmarks';

export function useBicepsCurlAnalyzer() {
  const [leftAngle, setLeftAngle]   = useState<number | null>(null);
  const [rightAngle, setRightAngle] = useState<number | null>(null);

  const smoothedPoseRef  = useRef<PoseResult | null>(null);
  const analyzerStateRef = useRef<BicepsCurlState>(INITIAL_BICEPS_CURL_STATE);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(POSE_EVENT, (data: any) => {
      if (!Array.isArray(data) || data.length === 0) return;

      const rawPose = toPoseResult(data as PoseLandmarks);
      const smoothed = smoothPose(rawPose, smoothedPoseRef.current, BICEPS_CURL_CONFIG.SMOOTHING_ALPHA);
      smoothedPoseRef.current = smoothed;

      const { result, nextState } = analyzeBicepsCurl(
        smoothed,
        analyzerStateRef.current,
        BICEPS_CURL_CONFIG,
      );
      analyzerStateRef.current = nextState;

      const left  = result.angles.leftElbow;
      const right = result.angles.rightElbow;
      console.log('[BicepsCurl] left:', left, 'right:', right);

      setLeftAngle(left);
      setRightAngle(right);
    });

    return () => sub.remove();
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (plugin == null) return;
      plugin.call(frame);
    },
    [],
  );

  return { frameProcessor, leftAngle, rightAngle };
}
