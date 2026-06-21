import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { PoseLandmarks, toPoseResult, PoseResult } from '../types/pose.types';
import { smoothPose } from '../logic/pose/poseSmoothing';
import { SessionPhase } from '../types/analysis.types';
import {
  AnalyzerEngine,
  CommonAnalysisResult,
  RepLogEntry,
  WorkoutSessionSummary,
} from '../logic/analyzers/engine.types';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});
const POSE_EVENT        = 'PoseLandmarks';
const COUNTDOWN_SECONDS = 3;

export type SessionSummarySnapshot = WorkoutSessionSummary & { startedAt: Date; endedAt: Date };

// Generic exercise session hook. The exercise-specific math is injected via an
// AnalyzerEngine; everything here — calibration countdown, session state machine,
// rep-log accumulation, summary snapshot — is shared across all exercises.
export function useExerciseAnalyzer(engine: AnalyzerEngine) {
  const [result, setResult]                 = useState<CommonAnalysisResult | null>(null);
  const [sessionPhase, setSessionPhase]     = useState<SessionPhase>('idle');
  const [countdownValue, setCountdownValue] = useState<number>(COUNTDOWN_SECONDS);
  const [reference, setReference]           = useState<unknown | null>(null);

  // Keep the latest engine in a ref so the long-lived event listener always uses
  // the current exercise without resubscribing.
  const engineRef = useRef(engine);
  engineRef.current = engine;

  const smoothedPoseRef   = useRef<PoseResult | null>(null);
  const analyzerStateRef  = useRef<unknown>(engine.initialState);
  const repLogRef         = useRef<RepLogEntry[]>([]);
  const referenceRef      = useRef<unknown | null>(null);
  const sessionPhaseRef   = useRef<SessionPhase>('idle');
  const countdownStartRef = useRef<number>(0);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);

  // Full (uncapped) session history for the summary; repLogRef is capped for UI.
  const fullRepLogRef  = useRef<RepLogEntry[]>([]);
  const seenRepKeysRef = useRef<Set<string>>(new Set());
  const startedAtRef   = useRef<Date | null>(null);
  const endedAtRef     = useRef<Date | null>(null);

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

      const eng = engineRef.current;
      const ref = eng.captureReference(pose, eng.config);
      if (!ref) {
        sessionPhaseRef.current = 'idle';
        setSessionPhase('idle');
        return;
      }

      analyzerStateRef.current = eng.initialState;
      repLogRef.current        = [];
      fullRepLogRef.current    = [];
      seenRepKeysRef.current   = new Set();
      startedAtRef.current     = new Date();
      endedAtRef.current       = null;
      referenceRef.current     = ref;
      setReference(ref);
      setCountdownValue(0);
      sessionPhaseRef.current = 'tracking';
      setSessionPhase('tracking');

      console.log('[Exercise] Reference captured:', JSON.stringify(ref));
    }, 250);
  }, []);

  const stopSession = useCallback(() => {
    clearTimer();
    endedAtRef.current = new Date();
    sessionPhaseRef.current = 'stopped';
    setSessionPhase('stopped');
  }, []);

  const buildSummary = useCallback((): SessionSummarySnapshot | null => {
    const startedAt = startedAtRef.current;
    if (!startedAt) return null;
    const endedAt = endedAtRef.current ?? new Date();
    return { ...engineRef.current.summarize(fullRepLogRef.current), startedAt, endedAt };
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(POSE_EVENT, (data: any) => {
      if (!Array.isArray(data) || data.length === 0) return;

      const eng      = engineRef.current;
      const rawPose  = toPoseResult(data as PoseLandmarks);
      const smoothed = smoothPose(rawPose, smoothedPoseRef.current, eng.config.SMOOTHING_ALPHA);
      smoothedPoseRef.current = smoothed;

      if (sessionPhaseRef.current !== 'tracking') return;

      const now = Date.now() / 1000;

      const { result: analysisResult, nextState, nextRepLog } = eng.analyze(
        smoothed,
        analyzerStateRef.current,
        referenceRef.current,
        eng.config,
        now,
        repLogRef.current,
      );

      analyzerStateRef.current = nextState;
      repLogRef.current        = nextRepLog;

      // Accumulate newly completed reps into the uncapped session log.
      for (const entry of nextRepLog) {
        const key = `${entry.arm}:${entry.repNo}`;
        if (!seenRepKeysRef.current.has(key)) {
          seenRepKeysRef.current.add(key);
          fullRepLogRef.current.push(entry);
        }
      }

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

  return {
    frameProcessor,
    result,
    sessionPhase,
    countdownValue,
    reference,
    startSession,
    stopSession,
    buildSummary,
  };
}
