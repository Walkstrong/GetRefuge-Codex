import { NativeModules } from 'react-native'

export const DEFAULT_LOCAL_AI_MODEL_PATH = '/data/local/tmp/llm/local-ai.task'

interface LocalAiNativeModule {
  infer(prompt: string, imageBase64: string | null, modelPath: string): Promise<string>
}

const nativeModule = NativeModules.LocalAiModule as LocalAiNativeModule | undefined

export function getLocalAiNative(): LocalAiNativeModule {
  if (!nativeModule) {
    throw new Error('Local AI native module is not available. Rebuild the native Android app.')
  }
  return nativeModule
}
