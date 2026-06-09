import { encryptRecord } from '@getrefuge/crypto'
import { database } from '../../database'
import type RecordAiCheck from '../../model/RecordAiCheck'
import { localAiInfer } from './index'
import type { LocalAiAnalysis } from './types'
import { v4 as uuidv4 } from 'uuid'
import { decodeBase64 } from 'tweetnacl-util'
import { clearAiCheckRunning, publishAiCheckNotice, publishAiCheckRunning, toAiCheckNotice } from './aiCheckEvents'

type FormType = 'incident' | 'beneficiary'
type FormData = { [key: string]: unknown }

interface PersistLocalAiAnalysisInput {
  recordId: string
  formType: FormType
  formData: FormData
  imageBase64?: string | null
  orgPublicKey: Uint8Array
  triggerSync: () => Promise<void>
}

export function persistLocalAiAnalysis(input: PersistLocalAiAnalysisInput): void {
  publishAiCheckRunning({
    recordId: input.recordId,
    formType: input.formType,
    startedAt: new Date().toISOString(),
  })
  void runLocalAiAnalysis(input)
}

function flattenFormData(formType: FormType, formData: FormData): string {
  const lines = Object.entries(formData)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${formatValue(value)}`)

  return [`Form type: ${formType}`, ...lines].join('\n')
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}

async function runLocalAiAnalysis({
  recordId,
  formType,
  formData,
  imageBase64,
  orgPublicKey,
  triggerSync,
}: PersistLocalAiAnalysisInput): Promise<void> {
  try {
    const image = imageBase64 ? decodeBase64(imageBase64) : undefined
    const result = await localAiInfer({ text: flattenFormData(formType, formData), image })
    const encryptedAnalysis = encryptRecord(toEncryptedAnalysisPayload(result.analysis), orgPublicKey)
    const aiCheckId = uuidv4()

    await database.write(async () => {
      const aiChecks = database.collections.get('record_ai_checks')
      await aiChecks.create((check) => {
        const draft = check as RecordAiCheck
        draft.ai_check_id = aiCheckId
        draft.record_id = recordId
        draft.encrypted_analysis = JSON.stringify(encryptedAnalysis)
        draft.sync_status = 'pending'
        draft.created_at = Date.now()
      })
    })

    publishAiCheckNotice(toAiCheckNotice(aiCheckId, recordId, formType, result.analysis))
  } catch (error) {
    console.warn('[local-ai] optional AI check failed; report save/sync is unaffected:', error)
    clearAiCheckRunning(recordId)
  } finally {
    triggerSync().catch((error) => {
      console.warn('[local-ai] post-AI-check sync failed:', error)
    })
  }
}

function toEncryptedAnalysisPayload(analysis: LocalAiAnalysis): { [key: string]: unknown } {
  return {
    severity: analysis.severity,
    imageCheck: analysis.imageCheck,
    suggestedFollowUp: analysis.suggestedFollowUp,
    protectionConcernFlag: analysis.protectionConcernFlag,
    confidenceScore: analysis.confidenceScore,
    modelVersion: analysis.modelVersion,
    generatedAt: analysis.generatedAt,
  }
}
