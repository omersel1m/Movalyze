import { useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { PoseLandmarks, toPoseResult, PoseResult } from '../types/pose.types';
import { smoothPose } from '../logic/pose/poseSmoothing';
import {
  analyzeBicepsCurl,
  BicepsCurlState,
  BicepsCurlAnalysisResult,
  INITIAL_BICEPS_CURL_STATE,
} from '../logic/analyzers/bicepsCurlAnalyzer';
import { BICEPS_CURL_CONFIG } from '../logic/config/bicepsCurl.config';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
const POSE_EVENT = 'PoseLandmarks';

export function useBicepsCurlAnalyzer() {
  const [result, setResult] = useState<BicepsCurlAnalysisResult | null>(null);

  const smoothedPoseRef  = useRef<PoseResult | null>(null);
  const analyzerStateRef = useRef<BicepsCurlState>(INITIAL_BICEPS_CURL_STATE);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(POSE_EVENT, (data: any) => {
      if (!Array.isArray(data) || data.length === 0) return;

      const rawPose  = toPoseResult(data as PoseLandmarks);
      const smoothed = smoothPose(rawPose, smoothedPoseRef.current, BICEPS_CURL_CONFIG.SMOOTHING_ALPHA);
      smoothedPoseRef.current = smoothed;

      const { result: analysisResult, nextState } = analyzeBicepsCurl(
        smoothed,
        analyzerStateRef.current,
        BICEPS_CURL_CONFIG,
      );
      analyzerStateRef.current = nextState;

      console.log(
        '[BicepsCurl]',
        'L:', analysisResult.angles.leftElbow?.toFixed(1),
        'R:', analysisResult.angles.rightElbow?.toFixed(1),
        '| lRep:', analysisResult.leftRepCount,
        'rRep:', analysisResult.rightRepCount,
        '| lPhase:', analysisResult.leftPhase,
        'rPhase:', analysisResult.rightPhase,
      );

      setResult(analysisResult);
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

  return { frameProcessor, result };
}
