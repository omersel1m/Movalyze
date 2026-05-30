import { useEffect, useRef, useState } from 'react';
import { PoseResult } from '../types/pose.types';
import { AnalysisResult } from '../types/analysis.types';
import { smoothPose } from '../logic/pose/poseSmoothing';
import {
  analyzeBicepsCurl,
  BicepsCurlState,
  INITIAL_BICEPS_CURL_STATE,
} from '../logic/analyzers/bicepsCurlAnalyzer';
import { BICEPS_CURL_CONFIG } from '../logic/config/bicepsCurl.config';

export function useBicepsCurlAnalyzer(poseResult: PoseResult | null) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const smoothedPoseRef  = useRef<PoseResult | null>(null);
  const analyzerStateRef = useRef<BicepsCurlState>(INITIAL_BICEPS_CURL_STATE);

  useEffect(() => {
    if (!poseResult) return;

    const smoothed = smoothPose(poseResult, smoothedPoseRef.current, BICEPS_CURL_CONFIG.SMOOTHING_ALPHA);
    smoothedPoseRef.current = smoothed;

    const { result, nextState } = analyzeBicepsCurl(
      smoothed,
      analyzerStateRef.current,
      BICEPS_CURL_CONFIG,
    );
    analyzerStateRef.current = nextState;

    setAnalysisResult(result);
  }, [poseResult]);

  return { analysisResult };
}
