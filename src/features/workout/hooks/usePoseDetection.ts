import { useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { VisionCameraProxy, useFrameProcessor } from 'react-native-vision-camera';
import { PoseLandmarks, PoseResult, toPoseResult } from '../types/pose.types';

const POSE_EVENT = 'PoseLandmarks';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {});

export function usePoseDetection() {
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(POSE_EVENT, (data: any) => {
      if (!Array.isArray(data) || data.length === 0) return;

      const pose = toPoseResult(data as PoseLandmarks);
      setPoseResult(pose);

      console.log(
        '[PoseDetector]',
        `nose=(${pose.nose?.x.toFixed(3)}, ${pose.nose?.y.toFixed(3)})`,
        `lShoulder=(${pose.leftShoulder?.x.toFixed(3)}, ${pose.leftShoulder?.y.toFixed(3)})`,
        `lElbow=(${pose.leftElbow?.x.toFixed(3)}, ${pose.leftElbow?.y.toFixed(3)})`,
        `lWrist=(${pose.leftWrist?.x.toFixed(3)}, ${pose.leftWrist?.y.toFixed(3)})`,
        `lHip=(${pose.leftHip?.x.toFixed(3)}, ${pose.leftHip?.y.toFixed(3)})`,
        `vis=${pose.leftShoulder?.visibility.toFixed(2)}`,
      );
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

  return { frameProcessor, poseResult };
}
