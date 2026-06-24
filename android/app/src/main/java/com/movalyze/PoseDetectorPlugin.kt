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
import java.util.concurrent.atomic.AtomicInteger

class PoseDetectorPlugin(proxy: VisionCameraProxy) : FrameProcessorPlugin() {

    companion object {
        private const val TAG = "PoseDetectorPlugin"
        // Dedicated tag for benchmark output — filter logcat with: adb logcat -s PoseBenchmark
        private const val BENCH_TAG = "PoseBenchmark"
        private const val WINDOW_MS = 2000L   // aggregate + log stats every 2 seconds
        const val MODEL_NAME = "pose_landmarker_full.task"
        const val EVENT_NAME = "PoseLandmarks"
    }

    private val context = proxy.context
    private var poseLandmarker: PoseLandmarker? = null

    // Prevents expensive toBitmap() on frames that arrive while inference is running.
    // compareAndSet(false, true) is atomic — safe across camera and MediaPipe threads.
    private val isProcessing = AtomicBoolean(false)

    // ── Benchmark instrumentation ────────────────────────────────────────────
    // droppedFrames is updated from the camera thread; everything else is only
    // touched inside the (single-threaded) MediaPipe result callback.
    private val droppedFrames     = AtomicInteger(0)
    private var winStartMs        = 0L
    private var winProcessed      = 0
    private var winDroppedAtStart = 0
    private var winInfSumMs       = 0.0
    private var winInfMinMs       = Double.MAX_VALUE
    private var winInfMaxMs       = 0.0
    private var totalProcessed    = 0L
    private var totalInfSumMs     = 0.0

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
                    // Inference latency = now - the timestamp we passed into detectAsync().
                    val inferenceMs = SystemClock.elapsedRealtime() - result.timestampMs()
                    isProcessing.set(false)
                    recordBenchmark(inferenceMs.toDouble())
                    emitLandmarks(result)
                }
                .setErrorListener { error ->
                    Log.e(TAG, "MediaPipe error: ${error.message}")
                    isProcessing.set(false)
                }
                .build()

            poseLandmarker = PoseLandmarker.createFromOptions(context, options)
            Log.i(TAG, "PoseLandmarker initialized: $MODEL_NAME (LIVE_STREAM)")
            // Static config line for the report: model + delegate (default = CPU, no GPU set).
            Log.i(BENCH_TAG, "config model=$MODEL_NAME runningMode=LIVE_STREAM delegate=CPU numPoses=1 " +
                "minDetConf=0.5 minPresenceConf=0.5 minTrackConf=0.5")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize PoseLandmarker: ${e.message}", e)
        }
    }

    // Aggregates inference latency + throughput over a fixed time window and logs
    // one summary line per window. Called only from the MediaPipe result callback.
    private fun recordBenchmark(inferenceMs: Double) {
        val now = SystemClock.elapsedRealtime()
        if (winStartMs == 0L) {
            winStartMs = now
            winDroppedAtStart = droppedFrames.get()
        }

        winProcessed++
        winInfSumMs += inferenceMs
        if (inferenceMs < winInfMinMs) winInfMinMs = inferenceMs
        if (inferenceMs > winInfMaxMs) winInfMaxMs = inferenceMs
        totalProcessed++
        totalInfSumMs += inferenceMs

        val elapsed = now - winStartMs
        if (elapsed < WINDOW_MS) return

        val droppedInWin = droppedFrames.get() - winDroppedAtStart
        val totalFrames  = winProcessed + droppedInWin
        val processedFps = winProcessed * 1000.0 / elapsed
        val cameraFps    = totalFrames * 1000.0 / elapsed
        val avgInf       = winInfSumMs / winProcessed
        val dropRate     = if (totalFrames > 0) droppedInWin * 100.0 / totalFrames else 0.0
        val avgInfTotal  = totalInfSumMs / totalProcessed

        Log.i(BENCH_TAG, String.format(
            "processedFPS=%.1f cameraFPS=%.1f avgInferenceMs=%.1f minMs=%.1f maxMs=%.1f " +
                "processed=%d dropped=%d dropRate=%.1f%% | cumulative: frames=%d avgInferenceMs=%.1f",
            processedFps, cameraFps, avgInf, winInfMinMs, winInfMaxMs,
            winProcessed, droppedInWin, dropRate, totalProcessed, avgInfTotal))

        // Reset window.
        winStartMs        = now
        winDroppedAtStart = droppedFrames.get()
        winProcessed      = 0
        winInfSumMs       = 0.0
        winInfMinMs       = Double.MAX_VALUE
        winInfMaxMs       = 0.0
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
        // Each skip is a dropped frame; counted for the drop-rate benchmark.
        if (!isProcessing.compareAndSet(false, true)) {
            droppedFrames.incrementAndGet()
            return null
        }

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
