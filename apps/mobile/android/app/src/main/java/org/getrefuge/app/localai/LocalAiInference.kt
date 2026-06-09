package org.getrefuge.app.localai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max

class LocalAiInference(private val context: Context) {
  private var activeModelPath: String? = null
  private var llmInference: LlmInference? = null
  private var activeLiteRtModelPath: String? = null
  private var liteRtEngine: Engine? = null

  @Synchronized
  fun infer(prompt: String, imageBase64: String?, modelPath: String): String {
    require(prompt.isNotBlank()) { "Prompt cannot be blank" }
    require(File(modelPath).exists()) { "Model file not found at $modelPath" }

    if (!imageBase64.isNullOrBlank()) {
      return inferWithImage(prompt, imageBase64)
    }

    val engine = getOrCreateEngine(modelPath)
    return engine.generateResponse(prompt)
  }

  @Synchronized
  fun close() {
    llmInference?.close()
    llmInference = null
    activeModelPath = null
    liteRtEngine?.close()
    liteRtEngine = null
    activeLiteRtModelPath = null
  }

  private fun getOrCreateEngine(modelPath: String): LlmInference {
    val existing = llmInference
    if (existing != null && activeModelPath == modelPath) {
      return existing
    }

    close()
    val options = LlmInference.LlmInferenceOptions.builder()
      .setModelPath(modelPath)
      .setMaxTokens(512)
      .build()

    val created = LlmInference.createFromOptions(context, options)
    llmInference = created
    activeModelPath = modelPath
    return created
  }

  private fun inferWithImage(prompt: String, imageBase64: String): String {
    require(File(LITERT_IMAGE_MODEL_PATH).exists()) {
      "LiteRT-LM image model file not found at $LITERT_IMAGE_MODEL_PATH"
    }

    val imageBytes = Base64.decode(imageBase64, Base64.DEFAULT)
    val pngBytes = imageBytes.toScaledPng(maxSide = 768)
    val engine = getOrCreateLiteRtEngine(LITERT_IMAGE_MODEL_PATH)
    val conversation = engine.createConversation(
      ConversationConfig(
        samplerConfig = SamplerConfig(topK = 64, topP = 0.95, temperature = 0.7),
      )
    )

    return conversation.use {
      it.sendMessage(
        Contents.of(
          listOf(
            Content.ImageBytes(pngBytes),
            Content.Text(prompt),
          )
        )
      ).toString()
    }
  }

  private fun getOrCreateLiteRtEngine(modelPath: String): Engine {
    val existing = liteRtEngine
    if (existing != null && activeLiteRtModelPath == modelPath) {
      return existing
    }

    liteRtEngine?.close()
    liteRtEngine = null
    activeLiteRtModelPath = null

    val created = Engine(
      EngineConfig(
        modelPath = modelPath,
        backend = Backend.GPU(),
        visionBackend = Backend.GPU(),
        maxNumTokens = 1024,
        cacheDir = context.getExternalFilesDir(null)?.absolutePath ?: context.cacheDir.absolutePath,
      )
    )
    created.initialize()
    liteRtEngine = created
    activeLiteRtModelPath = modelPath
    return created
  }

  private fun ByteArray.toScaledPng(maxSide: Int): ByteArray {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(this, 0, size, bounds)

    val sampleSize = calculateSampleSize(bounds.outWidth, bounds.outHeight, maxSide)
    val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    val bitmap = BitmapFactory.decodeByteArray(this, 0, size, decodeOptions)
      ?: throw IllegalArgumentException("Attached image could not be decoded")

    val output = ByteArrayOutputStream()
    try {
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
      return output.toByteArray()
    } finally {
      bitmap.recycle()
    }
  }

  private fun calculateSampleSize(width: Int, height: Int, maxSide: Int): Int {
    if (width <= 0 || height <= 0) {
      return 1
    }

    var sampleSize = 1
    var longestSide = max(width, height)
    while (longestSide / 2 >= maxSide) {
      sampleSize *= 2
      longestSide /= 2
    }
    return sampleSize
  }

  private companion object {
    const val LITERT_IMAGE_MODEL_PATH = "/data/local/tmp/llm/local-ai-image.litertlm"
  }
}
