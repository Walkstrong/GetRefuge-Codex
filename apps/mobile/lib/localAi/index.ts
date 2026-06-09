import { DEFAULT_LOCAL_AI_MODEL_PATH, getLocalAiNative } from './native'
import type { LocalAiAnalysis, LocalAiInferInput, LocalAiInferResult, LocalAiSeverity } from './types'

export type { LocalAiAnalysis, LocalAiInferInput, LocalAiInferResult, LocalAiSeverity }

type RawLocalAiAnalysis = {
  severity?: unknown
  imageCheck?: unknown
  suggestedFollowUp?: unknown
  protectionConcernFlag?: unknown
  confidenceScore?: unknown
}

const SEVERITIES: LocalAiSeverity[] = ['low', 'medium', 'high', 'critical']

export async function localAiInfer(input: LocalAiInferInput): Promise<LocalAiInferResult> {
  const prompt = buildPrompt(input.text, Boolean(input.image))
  const imageBase64 = input.image ? uint8ArrayToBase64(input.image) : null
  const start = Date.now()
  const rawOutput = await getLocalAiNative().infer(prompt, imageBase64, DEFAULT_LOCAL_AI_MODEL_PATH)
  const latencyMs = Date.now() - start
  const parsed = parseAnalysis(rawOutput)

  return {
    analysis: {
      ...parsed,
      modelVersion: 'local-ai',
      generatedAt: new Date().toISOString(),
    },
    latencyMs,
    rawOutput,
  }
}

function buildPrompt(text: string, hasImage: boolean): string {
  if (!hasImage) {
    return `Return one valid JSON object only. The first character must be { and the last character must be }. Do not use markdown.

You are analyzing a humanitarian field report.

Written report:
${text}

Return:
{
  "severity": "medium",
  "suggestedFollowUp": "1-2 sentence recommendation",
  "protectionConcernFlag": true,
  "confidenceScore": 0.8
}

Rules:
- Output valid JSON only. No preamble. No markdown fences.
- severity must be exactly one of these strings: low, medium, high, critical.
- Choose exactly one severity string. Do not copy the list of allowed values.
- Do not assign "critical" unless life-threatening harm is explicit.
- Classify floods, damaged shelter, medical needs, food or water shortage, or displacement as at least "medium" unless the written report clearly says the risk is minor.
- Set protectionConcernFlag to true for minors, sexual violence, imminent harm, detention, forced displacement, or exploitation risk.
- confidenceScore must be a number from 0.1 to 1.0. Use 0.8 when the written report is clear. Never return 0.0.`
  }

  return `Return one valid JSON object only. The first character must be { and the last character must be }. Do not use markdown.

You are analyzing a humanitarian field report. Use the written report as the primary source of truth. Use the image only as supporting context.

Written report:
${text}

Attached image:
Use the image to verify visible damage, flooding, environmental risk, or protection context.

Image inspection rule:
First inspect the attached image. Set imageCheck to a short phrase that describes visible image contents only, not the report text. If the visible image content does not match the written report, begin imageCheck with "mismatch:" and make suggestedFollowUp start with "Verify whether the attached photo belongs to this report;". If the image supports the report, begin imageCheck with "matches:" and do not ask whether the photo belongs to this report.

Return:
{
  "severity": "medium",
  "imageCheck": "matches: visible water across an urban road",
  "suggestedFollowUp": "1-2 sentence recommendation",
  "protectionConcernFlag": true,
  "confidenceScore": 0.8
}

Rules:
- Output valid JSON only. No preamble. No markdown fences.
- severity must be exactly one of these strings: low, medium, high, critical.
- Choose exactly one severity string. Do not copy the list of allowed values.
- Do not assign "critical" unless life-threatening harm is explicit.
- Classify floods, damaged shelter, medical needs, food or water shortage, or displacement as at least "medium" unless the written report clearly says the risk is minor.
- Set protectionConcernFlag to true for minors, sexual violence, imminent harm, detention, forced displacement, or exploitation risk.
- imageCheck must describe visible image content when an image is attached. Do not infer imageCheck from the written report.
- If imageCheck starts with "matches:", suggestedFollowUp must focus on operational next steps, not attachment verification.
- If imageCheck starts with "mismatch:", suggestedFollowUp must begin with "Verify whether the attached photo belongs to this report;".
- confidenceScore must be a number from 0.1 to 1.0. Use 0.8 when the written report and image are clear and consistent. Use 0.6 or lower when the image does not match the written report. Never return 0.0.`
}

function parseAnalysis(rawOutput: string): Omit<LocalAiAnalysis, 'generatedAt' | 'modelVersion'> {
  const raw = parseRawAnalysis(rawOutput)
  const severity = parseSeverity(raw.severity)
  const imageCheck = parseOptionalString(raw.imageCheck)
  const suggestedFollowUp = parseString(
    raw.suggestedFollowUp,
    'Review this report and verify priority needs before follow-up.',
  )
  const protectionConcernFlag = parseBoolean(raw.protectionConcernFlag)
  const confidenceScore = parseConfidence(raw.confidenceScore)

  return {
    severity,
    imageCheck,
    suggestedFollowUp,
    protectionConcernFlag,
    confidenceScore,
  }
}

function parseRawAnalysis(rawOutput: string): RawLocalAiAnalysis {
  try {
    return JSON.parse(extractJsonObject(rawOutput)) as RawLocalAiAnalysis
  } catch {
    return parseLooseAnalysis(rawOutput)
  }
}

function parseLooseAnalysis(rawOutput: string): RawLocalAiAnalysis {
  return {
    severity: matchStringField(rawOutput, 'severity'),
    imageCheck: matchStringField(rawOutput, 'imageCheck'),
    suggestedFollowUp: matchStringField(rawOutput, 'suggestedFollowUp'),
    protectionConcernFlag: matchBooleanField(rawOutput, 'protectionConcernFlag'),
    confidenceScore: matchNumberField(rawOutput, 'confidenceScore'),
  }
}

function matchStringField(source: string, fieldName: string): string | undefined {
  const match = source.match(new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`))
  return match ? match[1].trim() : undefined
}

function matchBooleanField(source: string, fieldName: string): boolean | undefined {
  const match = source.match(new RegExp(`"${fieldName}"\\s*:\\s*(true|false)`, 'i'))
  return match ? match[1].toLowerCase() === 'true' : undefined
}

function matchNumberField(source: string, fieldName: string): number | undefined {
  const match = source.match(new RegExp(`"${fieldName}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`))
  return match ? Number(match[1]) : undefined
}

function extractJsonObject(rawOutput: string): string {
  const trimmed = rawOutput.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = findJsonObjectEnd(candidate, start)

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Local AI output did not contain a JSON object: ${rawOutput}`)
  }

  return sanitizeJsonObject(candidate.slice(start, end + 1))
}

function findJsonObjectEnd(candidate: string, start: number): number {
  const objectEnd = candidate.lastIndexOf('}')
  if (objectEnd > start) {
    return objectEnd
  }

  const bracketEnd = candidate.lastIndexOf(']')
  if (bracketEnd > start) {
    return bracketEnd
  }

  return candidate.length - 1
}

function sanitizeJsonObject(jsonText: string): string {
  let sanitized = jsonText.trim()

  if (sanitized.endsWith(']')) {
    sanitized = `${sanitized.slice(0, -1)}}`
  }

  if (!sanitized.endsWith('}')) {
    sanitized = `${sanitized}}`
  }

  sanitized = sanitized.replace(/"confidenceScore"\s*:\s*(?=[}\]])/g, '"confidenceScore": 0.6')

  return sanitized.replace(/,\s*([}\]])/g, '$1')
}

function parseSeverity(value: unknown): LocalAiSeverity {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, '')
    if (normalized === 'moderate' || normalized === 'mediumseverity') {
      return 'medium'
    }
    if (SEVERITIES.includes(normalized as LocalAiSeverity)) {
      return normalized as LocalAiSeverity
    }
  }
  return 'medium'
}

function parseString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return fallback
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return undefined
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === 'yes') {
      return true
    }
    if (normalized === 'false' || normalized === 'no') {
      return false
    }
  }
  return false
}

function parseConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value))
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) {
      return Math.min(1, Math.max(0, parsed))
    }
  }
  return 0.6
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}
