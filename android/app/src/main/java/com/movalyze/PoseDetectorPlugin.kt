package com.movalyze

import android.graphics.Bitmap
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

class PoseDetectorPlugin(proxy: VisionCameraProxy) : FrameProcessorPlugin() {

    companion object {
        private const val TAG = "PoseDetectorPlugin"
        const val MODEL_NAME = "pose_landmarker_full.task"
        private const val PROCESSING_INTERVAL_MS = 66L // ~15 inference/sn
        const val EVENT_NAME = "PoseLandmarks"
    }

    private val context = proxy.context
    private var poseLandmarker: PoseLandmarker? = null
    private var lastProcessedTime = 0L

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
                .setRunningMode(RunningMode.IMAGE)
                .setNumPoses(1)
                .setMinPoseDetectionConfidence(0.5f)
                .setMinPosePresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .build()

            poseLandmarker = PoseLandmarker.createFromOptions(context, options)
            Log.i(TAG, "PoseLandmarker initialized: $MODEL_NAME")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize PoseLandmarker: ${e.message}", e)
        }
    }

    override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
        val now = System.currentTimeMillis()
        if (now - lastProcessedTime < PROCESSING_INTERVAL_MS) return null
        lastProcessedTime = now

        val landmarker = poseLandmarker ?: return null

        return try {
            val imageProxy = frame.getImageProxy()
            val bitmap: Bitmap = imageProxy.toBitmap()

            val mpImage = BitmapImageBuilder(bitmap).build()
            val result = landmarker.detect(mpImage)
            val poseList = result.landmarks()

            if (poseList.isEmpty()) return null

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

            null
        } catch (e: Exception) {
            Log.e(TAG, "Frame processing error: ${e.message}")
            null
        }
    }
}
