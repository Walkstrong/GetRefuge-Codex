import { createServerFn } from '@tanstack/react-start'
import { getCookies } from '@tanstack/react-start/server'
import { createServerClient } from '@supabase/ssr'
import {
  AiQuerySpecSchema,
  type AiQuerySpec,
} from '../../../lib/aiQuerySpec'
import type { EnrichedSchema, FieldInfo } from '../../../lib/enrichedSchema'
import { aiTools } from '../../../lib/aiTools'

type ChatInput = {
  question: string
  schema: EnrichedSchema
  mode?: 'chat' | 'insights'
}

type ChatMessageResponse = {
  content?: unknown
  tool_calls?: unknown
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: ChatMessageResponse
  }>
}

const DEFAULT_AI_MODELS = ['openrouter/auto']

function getAiModels(): string[] {
  const configured = process.env.OPENROUTER_MODEL_IDS ?? process.env.OPENROUTER_MODEL
  const models = configured
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  return models && models.length > 0 ? models : DEFAULT_AI_MODELS
}

function formatFieldLine(f: FieldInfo): string {
  let line = `- ${f.name} (${f.type}`
  if (f.enumValues && f.enumValues.length > 0) {
    line += `: ${f.enumValues.join(' | ')}`
  }
  line += `)`
  if (f.description) {
    line += ` - ${f.description}`
  }
  return line
}

function buildSystemPrompt(schema: EnrichedSchema, today: string): string {
  const incidentList = schema.incident.map(formatFieldLine).join('\n')
  const beneficiaryList = schema.beneficiary.map(formatFieldLine).join('\n')

  let prompt = `You translate humanitarian M&E (Monitoring & Evaluation) questions into a strict AiQuerySpec by calling exactly one available tool.

CURRENT DATE: ${today}

When the user says:
- "this month" → filter where date is in the same calendar month as ${today} (YYYY-MM prefix match)
- "last month" → previous calendar month relative to ${today}
- "this year" → calendar year of ${today}
- "last 30 days" / "recent" → from 30 days before ${today} through ${today}
- "today" → date equals ${today}

NEVER use dates outside the data range. If the user asks about a specific past month or year, use exactly what they specify. If they don't specify a time range, do not add a date filter.

## FIELD TYPE LEGEND
- "string"      — free text. Use "contains" to keyword-match.
- "number"      — numeric. Use eq/gt/lt/gte/lte.
- "boolean"     — true/false.
- "datetime"    — ISO date string. Use dateRange or gte/lte.
- "enum"        — pick ONE value from the listed enum. Use eq/neq/in.
- "enum_array"  — array of enum values. Use "contains" (single) or "contains_any" (multiple). NEVER use eq.

## ENUM VALUES — STRICT
When filtering by an enum or enum_array field, use ONLY values from its enum list shown below. NEVER invent enum values. NEVER use values that don't appear in the list.

## DATA PRIVACY
You receive field names, field types, enum values, and safe field descriptions only. You never receive decrypted record bodies, field examples, encrypted blobs, photos, or full row data.

## INCIDENT FIELDS
${incidentList}

## BENEFICIARY FIELDS
${beneficiaryList}

CRITICAL RULES:
1. NEVER fabricate field names. Only use fields from the lists above.
2. NEVER fabricate enum values. Use only values from a field's enum list.
3. If a question is ambiguous or you cannot map it to fields, return:
   { "intent": "summarize", "formType": "both", "filters": [], "chartHint": "table", "title": "Overview" }
4. Prefer a tool call. If tool calling is unavailable, output ONLY the JSON object. No prose, no markdown, no code fences.
5. Set "chartHint" based on the question:
   - Counts/comparisons by category -> "bar"
   - Time series -> "line"
   - Proportions/breakdowns -> "pie"
   - Lists/details -> "table"
6. Always include a short "title" (max 140 chars) describing what the result shows.

AiQuerySpec schema:
{
  "intent": "filter" | "aggregate" | "rank" | "summarize",
  "formType": "incident" | "beneficiary" | "both",
  "filters": [{ "field": <field>, "operator": "eq"|"neq"|"gt"|"lt"|"gte"|"lte"|"contains"|"contains_any"|"in", "value": <any> }],
  "groupBy": [{ "field": <field>, "timeBucket": "day"|"week"|"month" (optional) }] | null,
  "aggregate": "count" | "sum" | "avg" | null,
  "aggregateField": <field> | null,
  "scoring": "risk" | null,
  "sortBy": { "field": <field>, "direction": "asc"|"desc" } | null,
  "limit": <number> | null,
  "chartHint": "bar" | "line" | "pie" | "table",
  "title": <string>,
  "dateRange": { "start": <iso>, "end": <iso> } | null,
  "summary": <string>
}`

  prompt += "\n\n## ARRAY FILTERS\n\nThe following fields are ARRAYS (enum_array type), not scalars:\n- beneficiary.primaryNeeds (array of needs)\n\nWhen the user asks to filter on an array field, use the contains operator (single value) or contains_any (multiple values). Never use eq on an array field.\n\nExamples:\n- beneficiaries needing shelter -> { field: \"primaryNeeds\", operator: \"contains\", value: \"shelter\" }\n- beneficiaries needing food or water -> { field: \"primaryNeeds\", operator: \"contains_any\", value: [\"food\", \"water\"] }"

  prompt += "\n\n## TIME BUCKETING - MANDATORY\n\nWhen chartHint is 'line' AND a groupBy field ends in 'Date' (incidentDate, reportDate, interviewDate), you MUST include timeBucket on that groupBy item. Without it, the chart breaks.\n\nDefault: timeBucket = 'month'. Use 'week' or 'day' only if the user explicitly says weekly or daily.\n\nCorrect: { groupBy: [{ \"field\": \"incidentDate\", \"timeBucket\": \"month\" }], chartHint: \"line\" }\nWrong:   { groupBy: [{ \"field\": \"incidentDate\" }], chartHint: \"line\" }  // missing timeBucket\n\nFor pie/bar charts grouping by non-date fields, omit timeBucket."

  prompt += "\n\n## BADLY AFFECTED / HIGHEST RISK AREAS\n\nWhen the user asks for the most badly affected, most affected, worst affected, highest-risk, or priority area, call rank_top_n with formType='incident', groupField='region', operation='count', chartHint='bar', and scoring='risk'. The browser applies a deterministic risk score that combines report count, severityLevel, and numberOfAffected. Do not invent risk scores yourself."

  prompt += "\n\n## OUTPUT FORMAT\n\nOutput ONLY a single JSON object that parses with JSON.parse() on the first attempt. NO markdown code fences. NO preamble. NO trailing commentary. First character must be { and last must be }."

  prompt += "\n\n## SUMMARY FIELD\n\nEvery response must include a summary field with 1 to 3 sentences of plain-language explanation referencing specific numbers, regions, or categories from the data when relevant. If no records match, summary should explain why."

  return prompt
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key]
  return typeof raw === 'string' ? raw : null
}

function readNumber(value: Record<string, unknown>, key: string): number | null {
  const raw = value[key]
  return typeof raw === 'number' ? raw : null
}

function readRecordArray(
  value: Record<string, unknown>,
  key: string,
): Array<Record<string, unknown>> {
  const raw = value[key]
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord)
}

function normalizeOperation(value: string | null): 'count' | 'sum' | 'avg' {
  const normalized = value?.toLowerCase()
  return normalized === 'sum' || normalized === 'avg' ? normalized : 'count'
}

function normalizeChartHint(value: string | null): 'bar' | 'line' | 'pie' | 'table' {
  const normalized = value?.toLowerCase()
  if (
    normalized === 'bar' ||
    normalized === 'line' ||
    normalized === 'pie' ||
    normalized === 'table'
  ) {
    return normalized
  }
  return 'bar'
}

function readDateRange(args: Record<string, unknown>): { start: string; end: string } | null {
  const raw = args.dateRange
  if (!isRecord(raw)) return null
  const start = readString(raw, 'start')
  const end = readString(raw, 'end')
  return start && end ? { start, end } : null
}

function inferYearDateRange(question: string): { start: string; end: string } | null {
  const match = question.match(/\b(20\d{2})\b/)
  if (!match) return null
  return { start: `${match[1]}-01-01`, end: `${match[1]}-12-31` }
}

function isRiskQuestion(question: string): boolean {
  return /\b(badly affected|most affected|worst affected|highest[-\s]?risk|priority area|most severe|hardest hit)\b/i.test(
    question,
  )
}

function parseToolArguments(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function titleFromQuestion(question: string, fallback: string): string {
  const trimmed = question.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 140) : fallback
}

function specFromToolCall(
  name: string,
  args: Record<string, unknown>,
  question: string,
): AiQuerySpec | null {
  let rawSpec: unknown
  const filters = readRecordArray(args, 'filters')
  const dateRange = readDateRange(args) ?? inferYearDateRange(question)
  const riskQuestion = isRiskQuestion(question)
  if (name === 'filter_records') {
    rawSpec = {
      intent: 'filter',
      formType: readString(args, 'formType') ?? 'both',
      filters,
      groupBy: null,
      aggregate: null,
      aggregateField: null,
      sortBy: null,
      limit: null,
      chartHint: 'table',
      title: titleFromQuestion(question, 'Filtered records'),
      dateRange,
      summary: 'Filtered records matching the requested criteria.',
    }
  } else if (name === 'aggregate_by') {
    rawSpec = {
      intent: 'aggregate',
      formType: riskQuestion ? 'incident' : (readString(args, 'formType') ?? 'incident'),
      filters,
      groupBy: [{ field: riskQuestion ? 'region' : (readString(args, 'groupField') ?? 'region') }],
      aggregate: riskQuestion ? 'count' : normalizeOperation(readString(args, 'operation')),
      aggregateField: riskQuestion ? null : readString(args, 'aggregateField'),
      scoring: riskQuestion ? 'risk' : undefined,
      sortBy: { field: 'value', direction: 'desc' },
      limit: riskQuestion ? 5 : null,
      chartHint: riskQuestion ? 'bar' : normalizeChartHint(readString(args, 'chartHint')),
      title: titleFromQuestion(question, 'Grouped records'),
      dateRange,
      summary: riskQuestion
        ? 'Areas ranked by a deterministic risk score combining report count, severity, and people affected.'
        : 'Records grouped and aggregated by the requested field.',
    }
  } else if (name === 'time_bucket_aggregate') {
    rawSpec = {
      intent: 'aggregate',
      formType: readString(args, 'formType') ?? 'incident',
      filters,
      groupBy: [
        {
          field: readString(args, 'dateField') ?? 'incidentDate',
          timeBucket: readString(args, 'bucket') ?? 'month',
        },
      ],
      aggregate: normalizeOperation(readString(args, 'operation')),
      aggregateField: readString(args, 'aggregateField'),
      sortBy: null,
      limit: null,
      chartHint: 'line',
      title: titleFromQuestion(question, 'Records over time'),
      dateRange,
      summary: 'Records aggregated over time.',
    }
  } else if (name === 'rank_top_n') {
    const useRiskScore = riskQuestion || readString(args, 'scoring') === 'risk'
    rawSpec = {
      intent: 'rank',
      formType: useRiskScore ? 'incident' : (readString(args, 'formType') ?? 'incident'),
      filters,
      groupBy: [{ field: useRiskScore ? 'region' : (readString(args, 'groupField') ?? 'region') }],
      aggregate: useRiskScore ? 'count' : normalizeOperation(readString(args, 'operation')),
      aggregateField: null,
      scoring: useRiskScore ? 'risk' : undefined,
      sortBy: { field: 'value', direction: 'desc' },
      limit: readNumber(args, 'n') ?? (useRiskScore ? 5 : 10),
      chartHint: 'bar',
      title: titleFromQuestion(question, 'Top records'),
      dateRange,
      summary: useRiskScore
        ? 'Areas ranked by a deterministic risk score combining report count, severity, and people affected.'
        : 'Top groups ranked by the requested aggregate.',
    }
  } else {
    return null
  }

  const validated = AiQuerySpecSchema.safeParse(rawSpec)
  return validated.success ? validated.data : null
}

function specFromMessage(
  message: ChatMessageResponse | undefined,
  question: string,
): AiQuerySpec | null {
  if (!message) return null
  if (Array.isArray(message.tool_calls)) {
    for (const call of message.tool_calls) {
      if (!isRecord(call) || !isRecord(call.function)) continue
      const name = readString(call.function, 'name')
      const args = parseToolArguments(call.function.arguments)
      if (!name || !args) continue
      const spec = specFromToolCall(name, args, question)
      if (spec) return spec
    }
  }

  const rawContent = typeof message.content === 'string' ? message.content : ''
  if (!rawContent) return null
  try {
    const parsed = extractJson(rawContent)
    const validated = AiQuerySpecSchema.safeParse(parsed)
    return validated.success ? validated.data : null
  } catch {
    return null
  }
}

async function callOpenRouter(
  apiKey: string,
  requestBody: Record<string, unknown>,
): Promise<{ status: number; body: unknown; text?: string }> {
  const models = getAiModels()

  for (const model of models) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://getrefuge.org',
        'X-Title': process.env.OPENROUTER_APP_TITLE ?? 'GetRefuge',
      },
      body: JSON.stringify({ ...requestBody, model }),
    })

    if (res.status === 429 && model !== models[models.length - 1]) {
      continue
    }

    if (!res.ok) {
      return { status: res.status, body: null, text: await res.text() }
    }

    return { status: res.status, body: await res.json() }
  }

  return { status: 429, body: null }
}

function extractJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch {}
  const stripped = raw.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim()
  if (stripped !== raw) {
    try { return JSON.parse(stripped) } catch {}
  }
  const start = raw.indexOf("{")
  if (start === -1) throw new Error("No JSON object in response")
  let depth = 0, inString = false, escape = false
  for (let i = start; i < raw.length; i++) {
    const c = raw[i]
    if (escape) { escape = false; continue }
    if (c === "\\") { escape = true; continue }
    if (c === "\"") { inString = !inString; continue }
    if (inString) continue
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return JSON.parse(raw.slice(start, i + 1))
    }
  }
  throw new Error("Unbalanced braces in response")
}

export const chat = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: ChatInput) => data,
  )
  .handler(async ({ data }) => {
    // STEP 1 - Verify Supabase session from request cookies
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
      return { error: 'unauthenticated' as const }
    }

    // STEP 2 - Validate input
    if (data.question.length > 500) {
      return {
        error: 'invalid_response' as const,
        message: 'question too long',
      }
    }

    // STEP 3 - Call the configured OpenRouter model
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error('[api/chat] OPENROUTER_API_KEY not set')
      return { error: 'upstream_error' as const }
    }

    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt = buildSystemPrompt(data.schema, today)
    const requestBody = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: data.question },
      ],
      tools: aiTools,
      tool_choice: 'required',
      parallel_tool_calls: false,
      temperature: 0.1,
      max_tokens: 800,
      reasoning: { enabled: true },
    }

    const firstResponse = await callOpenRouter(apiKey, requestBody)
    if (firstResponse.status === 429) return { error: 'rate_limited' as const }
    if (firstResponse.status < 200 || firstResponse.status >= 300) {
      console.warn(
        '[api/chat] upstream error',
        firstResponse.status,
        firstResponse.text,
      )
      return { error: 'upstream_error' as const }
    }

    // STEP 4 - Parse + Zod-validate the model's tool call or JSON fallback.
    const json: unknown = firstResponse.body
    const firstMessage = isRecord(json)
      ? (json as OpenRouterResponse).choices?.[0]?.message
      : undefined
    const firstSpec = specFromMessage(firstMessage, data.question)
    if (firstSpec) return firstSpec

    const rawContent =
      firstMessage && typeof firstMessage.content === 'string'
        ? firstMessage.content
        : ''
    console.error('[api/chat] First AI response invalid or unparseable')
    if (rawContent) console.error('[api/chat] Raw content was:', rawContent)

      // One retry with tightened follow-up prompt
      const retryResponse = await callOpenRouter(
        apiKey,
        {
          ...requestBody,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: data.question },
            {
              role: 'user',
              content:
                'Use exactly one tool call with valid arguments. If tool calling is unavailable, output ONLY a valid AiQuerySpec JSON object.',
            },
          ],
        },
      )
      if (
        retryResponse.status === 429 ||
        retryResponse.status < 200 ||
        retryResponse.status >= 300
      ) {
        return { error: 'invalid_response' as const }
      }
      const retryJson: unknown = retryResponse.body
      const retryMessage = isRecord(retryJson)
        ? (retryJson as OpenRouterResponse).choices?.[0]?.message
        : undefined
      const retrySpec = specFromMessage(retryMessage, data.question)
      if (retrySpec) return retrySpec

      console.error('[api/chat] Retry also invalid or unparseable')
      return { error: 'invalid_response' as const }
  })
