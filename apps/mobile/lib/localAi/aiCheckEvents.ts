import type { LocalAiAnalysis } from './types'

export interface AiCheckNotice {
  id: string
  recordId: string
  formType: 'incident' | 'beneficiary'
  priority: string
  imageCheck?: string
  suggestedNextStep: string
  needsSupervisorReview: boolean
  generatedAt: string
}

export interface AiCheckRunningNotice {
  recordId: string
  formType: 'incident' | 'beneficiary'
  startedAt: string
}

type Listener = (notice: AiCheckNotice | null) => void
type RunningListener = (notice: AiCheckRunningNotice | null) => void

let latestNotice: AiCheckNotice | null = null
let runningNotice: AiCheckRunningNotice | null = null
const listeners = new Set<Listener>()
const runningListeners = new Set<RunningListener>()

export function publishAiCheckNotice(notice: AiCheckNotice): void {
  runningNotice = null
  latestNotice = notice
  runningListeners.forEach((listener) => listener(runningNotice))
  listeners.forEach((listener) => listener(latestNotice))
}

export function publishAiCheckRunning(notice: AiCheckRunningNotice): void {
  runningNotice = notice
  runningListeners.forEach((listener) => listener(runningNotice))
}

export function clearAiCheckRunning(recordId: string): void {
  if (runningNotice?.recordId === recordId) {
    runningNotice = null
    runningListeners.forEach((listener) => listener(runningNotice))
  }
}

export function getLatestAiCheckNotice(): AiCheckNotice | null {
  return latestNotice
}

export function subscribeToAiCheckNotices(listener: Listener): () => void {
  listeners.add(listener)
  listener(latestNotice)

  return () => {
    listeners.delete(listener)
  }
}

export function subscribeToAiCheckRunning(listener: RunningListener): () => void {
  runningListeners.add(listener)
  listener(runningNotice)

  return () => {
    runningListeners.delete(listener)
  }
}

export function toAiCheckNotice(
  id: string,
  recordId: string,
  formType: 'incident' | 'beneficiary',
  analysis: LocalAiAnalysis
): AiCheckNotice {
  return {
    id,
    recordId,
    formType,
    priority: toPriorityLabel(analysis.severity),
    imageCheck: analysis.imageCheck,
    suggestedNextStep: analysis.suggestedFollowUp,
    needsSupervisorReview: analysis.protectionConcernFlag,
    generatedAt: analysis.generatedAt,
  }
}

function toPriorityLabel(severity: LocalAiAnalysis['severity']): string {
  switch (severity) {
    case 'critical':
      return 'Immediate help'
    case 'high':
      return 'Urgent'
    case 'medium':
      return 'Important'
    case 'low':
    default:
      return 'Routine'
  }
}
