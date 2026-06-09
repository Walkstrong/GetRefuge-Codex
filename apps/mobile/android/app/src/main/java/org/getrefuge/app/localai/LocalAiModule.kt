package org.getrefuge.app.localai

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors

class LocalAiModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()
  private val inference = LocalAiInference(reactContext.applicationContext)

  override fun getName(): String = "LocalAiModule"

  @ReactMethod
  fun infer(prompt: String, imageBase64: String?, modelPath: String?, promise: Promise) {
    executor.execute {
      try {
        val resolvedModelPath = modelPath?.takeIf { it.isNotBlank() } ?: DEFAULT_MODEL_PATH
        val result = inference.infer(prompt, imageBase64, resolvedModelPath)
        promise.resolve(result)
      } catch (error: Throwable) {
        promise.reject("LOCAL_AI_INFERENCE_FAILED", error.message, error)
      }
    }
  }

  override fun invalidate() {
    inference.close()
    executor.shutdown()
    super.invalidate()
  }

  private companion object {
    const val DEFAULT_MODEL_PATH = "/data/local/tmp/llm/local-ai.task"
  }
}
