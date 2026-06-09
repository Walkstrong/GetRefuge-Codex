import { createServerFn } from '@tanstack/react-start'
import { getCookies } from '@tanstack/react-start/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import type { SitRepAggregates } from '../../../lib/sitrepAggregates'
import {
  applySitRepKAnonymity,
  SITREP_K_ANONYMITY_ENABLED,
  SITREP_K_ANONYMITY_THRESHOLD,
  SITREP_SUPPRESSED_BUCKET_LABEL,
} from '../../../lib/privacy/anonymity'

const DEFAULT_AI_MODELS = ['openrouter/auto']
const MAX_AGGREGATE_PAYLOAD_BYTES = 8 * 1024
const OPENROUTER_TIMEOUT_MS = 25_000

function getAiModels(): string[] {
  const configured = process.env.OPENROUTER_MODEL_IDS ?? process.env.OPENROUTER_MODEL
  const models = configured
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  return models && models.length > 0 ? models : DEFAULT_AI_MODELS
}

const AggregatePointSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.number().finite(),
})

const SitRepAggregatesSchema: z.ZodType<SitRepAggregates> = z.object({
  totals: z.object({
    incidentReports: z.number().int().min(0),
    beneficiaryInterviews: z.number().int().min(0),
    peopleAffected: z.number().min(0),
    householdsCovered: z.number().min(0),
    dateRange: z
      .object({
        start: z.string().max(40),
        end: z.string().max(40),
      })
      .nullable(),
  }),
  incidentsByRegion: z.array(AggregatePointSchema).max(20),
  incidentsBySeverity: z.array(AggregatePointSchema).max(8),
  incidentsByType: z.array(AggregatePointSchema).max(20),
  incidentsByMonth: z.array(AggregatePointSchema).max(12),
  topProtectionConcerns: z.array(AggregatePointSchema).max(8),
  topPrimaryNeeds: z.array(AggregatePointSchema).max(20),
  beneficiariesByAgeRange: z.array(AggregatePointSchema).max(12),
  beneficiariesByGender: z.array(AggregatePointSchema).max(10),
  highSeverityShare: z.number().min(0).max(1),
  regionsCovered: z.number().int().min(0),
  regionalPressureScore: z.array(AggregatePointSchema).max(20),
})

export const SitRepNarrativeSchema = z.object({
  executiveSummary: z.string().min(40).max(800),
  keyFindings: z.array(z.string().min(10).max(280)).min(3).max(6),
  regionalPressure: z.string().min(40).max(800),
  beneficiaryNeeds: z.string().min(40).max(800),
  recommendations: z.array(z.string().min(10).max(280)).min(3).max(5),
})

export type SitRepNarrative = z.infer<typeof SitRepNarrativeSchema>

const SitRepInputSchema = z.object({
  aggregates: SitRepAggregatesSchema,
  filters: z.array(z.string().min(1).max(120)).max(20),
  audience: z.enum(['operations', 'donors', 'internal']),
  periodLabel: z.string().min(1).max(80),
})

type SitRepInput = z.infer<typeof SitRepInputSchema>

type SitRepErrorType =
  | 'unauthenticated'
  | 'invalid_input'
  | 'payload_too_large'
  | 'missing_api_key'
  | 'rate_limited'
  | 'upstream_error'
  | 'invalid_narrative'

type SitRepError = {
  error: {
    type: SitRepErrorType
    message: string
  }
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
    finish_reason?: unknown
  }>
}

const AUDIENCE_GUIDANCE: Record<SitRepInput['audience'], string> = {
  operations: 'Audience tone: operations - tactical and action-oriented.',
  donors: 'Audience tone: donors - outcome-focused and plain language.',
  internal: 'Audience tone: internal - analytical and candid about gaps.',
}

const SYSTEM_PROMPT =
  'You are an experienced humanitarian field officer drafting a Situation Report (SitRep) for an NGO operations leadership team. You receive ONLY aggregate statistics - never individual records or PII. Write in a calm, factual, operationally useful tone. Be specific with numbers. Do not invent figures not present in the aggregates. Do not speculate about individuals. If the data is sparse, say so plainly. Avoid hype words. Output strictly the requested JSON schema, nothing else.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {}
  const stripped = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .trim()
  if (stripped !== raw) {
    try {
      return JSON.parse(stripped)
    } catch {}
  }
  const start = raw.indexOf('{')
  if (start === -1) throw new Error('No JSON object in response')
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i]
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1))
    }
  }
  throw new Error('Unbalanced braces in response')
}

function readContent(body: unknown): string {
  if (!isRecord(body)) return ''
  const message = (body as OpenRouterResponse).choices?.[0]?.message
  return typeof message?.content === 'string' ? message.content : ''
}

function readFinishReason(body: unknown): string | null {
  if (!isRecord(body)) return null
  const finishReason = (body as OpenRouterResponse).choices?.[0]?.finish_reason
  return typeof finishReason === 'string' ? finishReason : null
}

function buildUserPrompt(data: SitRepInput): string {
  return [
    AUDIENCE_GUIDANCE[data.audience],
    `Period label: ${data.periodLabel}`,
    `Active filters: ${data.filters.length > 0 ? data.filters.join(', ') : 'None'}`,
    SITREP_K_ANONYMITY_ENABLED
      ? `Privacy filter: aggregate groups smaller than ${SITREP_K_ANONYMITY_THRESHOLD} may be hidden or bucketed as "${SITREP_SUPPRESSED_BUCKET_LABEL}" before AI drafting.`
      : 'Privacy filter: k-anonymity suppression is disabled for this run.',
    'Keep the complete JSON concise: executiveSummary 2 sentences, each narrative paragraph 2 sentences, and each finding or recommendation 1 sentence.',
    'Do not include markdown, citations, commentary, or fields outside the schema.',
    '',
    'Return only this JSON object shape:',
    '{',
    '  "executiveSummary": "2-4 calm operational sentences",',
    '  "keyFindings": ["3-6 numeric findings grounded in the aggregates"],',
    '  "regionalPressure": "short paragraph on region-level pressure",',
    '  "beneficiaryNeeds": "short paragraph on needs and protection concern status",',
    '  "recommendations": ["3-5 actionable recommendations grounded in the findings"]',
    '}',
    '',
    'Aggregate statistics only:',
    JSON.stringify(data.aggregates),
  ].join('\n')
}

function isTransientStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

async function fetchOpenRouter(
  apiKey: string,
  requestBody: Record<string, unknown>,
  model: string,
): Promise<{ status: number; body: unknown; text?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS)
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://getrefuge.org',
        'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'GetRefuge',
      },
      body: JSON.stringify({ ...requestBody, model }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { status: response.status, body: null, text: await response.text() }
    }

    return { status: response.status, body: await response.json() }
  } catch (error) {
    return {
      status: 0,
      body: null,
      text: error instanceof Error ? error.message : 'OpenRouter request failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function callOpenRouter(
  apiKey: string,
  requestBody: Record<string, unknown>,
): Promise<{ status: number; body: unknown; text?: string }> {
  const models = getAiModels()

  for (const model of models) {
    const response = await fetchOpenRouter(apiKey, requestBody, model)
    if (response.status === 429 && model !== models[models.length - 1]) {
      continue
    }
    return response
  }
  return { status: 429, body: null }
}

async function callOpenRouterWithRetry(
  apiKey: string,
  requestBody: Record<string, unknown>,
): Promise<{ status: number; body: unknown; text?: string }> {
  const first = await callOpenRouter(apiKey, requestBody)
  if (!isTransientStatus(first.status)) return first
  return callOpenRouter(apiKey, requestBody)
}

export const generateSitRep = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown): SitRepInput => SitRepInputSchema.parse(data))
  .handler(async ({ data }): Promise<SitRepNarrative | SitRepError> => {
    const cookies = getCookies()
    const cookieList = Object.entries(cookies).map(([name, value]) => ({
      name,
      value: value as string,
    }))

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
    const supabaseKey =
      process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => cookieList,
        setAll: () => {
          /* no-op: server function does not set cookies */
        },
      },
    })

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return {
        error: {
          type: 'unauthenticated',
          message: 'Sign in again before generating a SitRep.',
        },
      }
    }

    const privacyFiltered = applySitRepKAnonymity(data.aggregates, {
      enabled: SITREP_K_ANONYMITY_ENABLED,
      threshold: SITREP_K_ANONYMITY_THRESHOLD,
    })
    const safeData: SitRepInput = {
      ...data,
      aggregates: privacyFiltered.aggregates,
    }

    const aggregatePayload = JSON.stringify({
      aggregates: safeData.aggregates,
      filters: data.filters,
      audience: data.audience,
      periodLabel: data.periodLabel,
    })
    if (byteLength(aggregatePayload) > MAX_AGGREGATE_PAYLOAD_BYTES) {
      return {
        error: {
          type: 'payload_too_large',
          message: 'The aggregate payload is too large for the safe SitRep prompt.',
        },
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return {
        error: {
          type: 'missing_api_key',
          message: 'OpenRouter is not configured for SitRep generation.',
        },
      }
    }

    const requestBody = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(safeData) },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }

    const response = await callOpenRouterWithRetry(apiKey, requestBody)
    if (response.status === 429) {
      return {
        error: {
          type: 'rate_limited',
          message: 'The AI service is rate-limited right now. Try again in a moment.',
        },
      }
    }
    if (response.status < 200 || response.status >= 300) {
      console.warn('[api/sitrep] upstream error', response.status, response.text)
      return {
        error: {
          type: 'upstream_error',
          message: 'The AI service could not draft the SitRep narrative.',
        },
      }
    }

    const finishReason = readFinishReason(response.body)
    const content = readContent(response.body)
    if (!content) {
      return {
        error: {
          type: 'invalid_narrative',
          message:
            finishReason === 'length'
              ? 'The AI response was cut off before valid narrative JSON was complete. Try again.'
              : 'The AI service returned an empty narrative response.',
        },
      }
    }

    let parsed: unknown
    try {
      parsed = extractJson(content)
    } catch {
      return {
        error: {
          type: 'invalid_narrative',
          message:
            finishReason === 'length'
              ? 'The AI response was cut off before valid narrative JSON was complete. Try again.'
              : 'The AI service returned text that was not valid narrative JSON.',
        },
      }
    }

    const validated = SitRepNarrativeSchema.safeParse(parsed)
    if (!validated.success) {
      return {
        error: {
          type: 'invalid_narrative',
          message: validated.error.issues
            .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
            .join('; '),
        },
      }
    }

    return validated.data
  })
