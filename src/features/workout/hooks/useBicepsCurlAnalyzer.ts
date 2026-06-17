import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { PoseLandmarks, toPoseResult, PoseResult } from '../types/pose.types';
import { smoothPose } from '../logic/pose/poseSmoothing';
import {
  analyzeBicepsCurl,
  captureReference,
  BicepsCurlState,
  BicepsCurlAnalysisResult,
  BicepsReference,
  RepLogEntry,
  INITIAL_BICEPS_CURL_STATE,
} from '../logic/analyzers/bicepsCurlAnalyzer';
import { BICEPS_CURL_CONFIG } from '../logic/config/bicepsCurl.config';
import { SessionPhase } from '../types/analysis.types';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
const POSE_EVENT       = 'PoseLandmarks';
const COUNTDOWN_SECONDS = 3;

export function useBicepsCurlAnalyzer() {
  const [result, setResult]               = useState<BicepsCurlAnalysisResult | null>(null);
  const [sessionPhase, setSessionPhase]   = useState<SessionPhase>('idle');
  const [countdownValue, setCountdownValue] = useState<number>(COUNTDOWN_SECONDS);
  const [reference, setReference]         = useState<BicepsReference | null>(null);

  const smoothedPoseRef   = useRef<PoseResult | null>(null);
  const analyzerStateRef  = useRef<BicepsCurlState>(INITIAL_BICEPS_CURL_STATE);
  const repLogRef         = useRef<RepLogEntry[]>([]);
  const referenceRef      = useRef<BicepsReference | null>(null);
  const sessionPhaseRef   = useRef<SessionPhase>('idle');
  const countdownStartRef = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startSession = useCallback(() => {
    clearTimer();
    sessionPhaseRef.current = 'countdown';
    setSessionPhase('countdown');
    setCountdownValue(COUNTDOWN_SECONDS);
    countdownStartRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed   = (Date.now() - countdownStartRef.current) / 1000;
      const remaining = COUNTDOWN_SECONDS - Math.floor(elapsed);

      if (remaining > 0) {
        setCountdownValue(remaining);
        return;
      }

      clearTimer();

      const pose = smoothedPoseRef.current;
      if (!pose) {
        sessionPhaseRef.current = 'idle';
        setSessionPhase('idle');
        return;
      }

      const ref = captureReference(pose, BICEPS_CURL_CONFIG);
      if (!ref) {
        sessionPhaseRef.current = 'idle';
        setSessionPhase('idle');
        return;
      }

      analyzerStateRef.current = INITIAL_BICEPS_CURL_STATE;
      repLogRef.current        = [];
      referenceRef.current     = ref;
      setReference(ref);
      setCountdownValue(0);
      sessionPhaseRef.current = 'tracking';
      setSessionPhase('tracking');

      console.log('[BicepsCurl] Reference captured:', JSON.stringify(ref));
    }, 250);
  }, []);

  const stopSession = useCallback(() => {
    clearTimer();
    sessionPhaseRef.current = 'stopped';
    setSessionPhase('stopped');
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(POSE_EVENT, (data: any) => {
      if (!Array.isArray(data) || data.length === 0) return;

      const rawPose  = toPoseResult(data as PoseLandmarks);
      const smoothed = smoothPose(rawPose, smoothedPoseRef.current, BICEPS_CURL_CONFIG.SMOOTHING_ALPHA);
      smoothedPoseRef.current = smoothed;

      if (sessionPhaseRef.current !== 'tracking') return;

      const now = Date.now() / 1000;

      const { result: analysisResult, nextState, nextRepLog } = analyzeBicepsCurl(
        smoothed,
        analyzerStateRef.current,
        referenceRef.current,
        BICEPS_CURL_CONFIG,
        now,
        repLogRef.current,
      );

      analyzerStateRef.current = nextState;
      repLogRef.current        = nextRepLog;

      console.log(
        '[BicepsCurl]',
        'L:', analysisResult.angles.leftElbow?.toFixed(1),
        'R:', analysisResult.angles.rightElbow?.toFixed(1),
        '| lRep:', analysisResult.leftRepCount,
        'rRep:', analysisResult.rightRepCount,
        '| form:', analysisResult.liveFormScore?.toFixed(1),
      );

      setResult(analysisResult);
    });

    return () => {
      sub.remove();
      clearTimer();
    };
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      if (plugin == null) return;
      plugin.call(frame);
    },
    [],
  );

  return { frameProcessor, result, sessionPhase, countdownValue, reference, startSession, stopSession };
}
