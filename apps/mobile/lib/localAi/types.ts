export type LocalAiSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface LocalAiInferInput {
  text: string
  image?: Uint8Array
}

export interface LocalAiAnalysis {
  severity: LocalAiSeverity
  imageCheck?: string
  suggestedFollowUp: string
  protectionConcernFlag: boolean
  confidenceScore: number
  modelVersion: string
  generatedAt: string
}

export interface LocalAiInferResult {
  analysis: LocalAiAnalysis
  latencyMs: number
  rawOutput: string
}
