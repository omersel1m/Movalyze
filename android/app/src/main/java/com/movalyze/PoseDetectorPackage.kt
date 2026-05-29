package com.movalyze

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class PoseDetectorPackage : ReactPackage {

    companion object {
        @Volatile var reactContext: ReactApplicationContext? = null

        init {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectPose") { proxy, _ ->
                PoseDetectorPlugin(proxy)
            }
        }
    }

    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> {
        reactContext = context
        return emptyList()
    }

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
