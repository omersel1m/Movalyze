package com.movalyze

import android.graphics.Bitmap
import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import java.util.concurrent.atomic.AtomicBoolean

class PoseDetectorPlugin(proxy: VisionCameraProxy) : FrameProcessorPlugin() {

    companion object {
        private const val TAG = "PoseDetectorPlugin"
        const val MODEL_NAME = "pose_landmarker_full.task"
        const val EVENT_NAME = "PoseLandmarks"
    }

    private val context = proxy.context
    private var poseLandmarker: PoseLandmarker? = null

    // Prevents expensive toBitmap() on frames that arrive while inference is running.
    // compareAndSet(false, true) is atomic — safe across camera and MediaPipe threads.
    private val isProcessing = AtomicBoolean(false)

    init {
        initializeLandmarker()
    }

    private fun initializeLandmarker() {
        try {
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath(MODEL_NAME)
                .build()

            val options = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setRunningMode(RunningMode.LIVE_STREAM)   // non-blocking + temporal tracking
                .setNumPoses(1)
                .setMinPoseDetectionConfidence(0.5f)
                .setMinPosePresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .setResultListener { result, _ ->
                    isProcessing.set(false)
                    emitLandmarks(result)
                }
                .setErrorListener { error ->
                    Log.e(TAG, "MediaPipe error: ${error.message}")
                    isProcessing.set(false)
                }
                .build()

            poseLandmarker = PoseLandmarker.createFromOptions(context, options)
            Log.i(TAG, "PoseLandmarker initialized: $MODEL_NAME (LIVE_STREAM)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize PoseLandmarker: ${e.message}", e)
        }
    }

    private fun emitLandmarks(result: com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult) {
        val poseList = result.landmarks()
        if (poseList.isEmpty()) return

        val writableArray = Arguments.createArray()
        poseList[0].forEach { lm ->
            val map = Arguments.createMap()
            map.putDouble("x", lm.x().toDouble())
            map.putDouble("y", lm.y().toDouble())
            map.putDouble("z", lm.z().toDouble())
            map.putDouble("visibility", lm.visibility().orElse(0f).toDouble())
            writableArray.pushMap(map)
        }

        PoseDetectorPackage.reactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(EVENT_NAME, writableArray)
    }

    override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
        // Skip this frame entirely if inference is already running — avoids toBitmap() cost.
        if (!isProcessing.compareAndSet(false, true)) return null

        val landmarker = poseLandmarker ?: run {
            isProcessing.set(false)
            return null
        }

        return try {
            val bitmap: Bitmap = frame.getImageProxy().toBitmap()
            val mpImage = BitmapImageBuilder(bitmap).build()
            // Monotonic timestamp required by LIVE_STREAM mode.
            landmarker.detectAsync(mpImage, SystemClock.elapsedRealtime())
            null
        } catch (e: Exception) {
            Log.e(TAG, "Frame processing error: ${e.message}")
            isProcessing.set(false)
            null
        }
    }
}
