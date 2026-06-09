import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { BarChart3, Check, Copy, Grip, MessageSquare, Minus, Send, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chat } from '../src/routes/api/-chat'
import { buildEnrichedSchema } from '../lib/enrichedSchema'
import type { AiQuerySpec } from '../lib/aiQuerySpec'
import {
  executeSpec,
  type DecryptedRecord,
  type ExecutorResult,
} from '../lib/queryExecutor'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text?: string
  result?: ExecutorResult
  error?: { type: string; message?: string }
  routeLabel?: string
  spec?: AiQuerySpec
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  records: DecryptedRecord[]
}

type ChartHoverDatum = {
  label: string
  value: string
}

const CANNED_QUERIES: Array<{ label: string; spec: AiQuerySpec }> = [
  {
    label: 'Incidents by region',
    spec: {
      intent: 'aggregate',
      formType: 'incident',
      filters: [],
      groupBy: [{ field: 'region' }],
      aggregate: 'count',
      aggregateField: null,
      sortBy: { field: 'value', direction: 'desc' },
      limit: 14,
      chartHint: 'bar',
      title: 'Incidents by region',
      dateRange: null,
      summary: 'Total incidents grouped by governorate, ranked highest to lowest.',
    },
  },
  {
    label: 'Severity breakdown',
    spec: {
      intent: 'aggregate',
      formType: 'incident',
      filters: [],
      groupBy: [{ field: 'severityLevel' }],
      aggregate: 'count',
      aggregateField: null,
      sortBy: null,
      limit: null,
      chartHint: 'pie',
      title: 'Incidents by severity',
      dateRange: null,
      summary: 'Distribution of incidents across severity levels.',
    },
  },
  {
    label: 'Beneficiary needs',
    spec: {
      intent: 'aggregate',
      formType: 'beneficiary',
      filters: [],
      groupBy: [{ field: 'primaryNeeds' }],
      aggregate: 'count',
      aggregateField: null,
      sortBy: { field: 'value', direction: 'desc' },
      limit: 10,
      chartHint: 'bar',
      title: 'Beneficiary primary needs',
      dateRange: null,
      summary: 'Most common needs reported by beneficiaries.',
    },
  },
  {
    label: 'Incidents over time',
    spec: {
      intent: 'aggregate',
      formType: 'incident',
      filters: [],
      groupBy: [{ field: 'incidentDate', timeBucket: 'month' }],
      aggregate: 'count',
      aggregateField: null,
      sortBy: null,
      limit: null,
      chartHint: 'line',
      title: 'Incidents over time',
      dateRange: null,
      summary: 'Monthly trend of reported incidents.',
    },
  },
]

const COLORS = [
  '#6BA5B4',
  '#76B08A',
  '#F2A56F',
  '#D96C75',
  '#8FA4F2',
  '#6ECAD0',
  '#B6A2E3',
  '#D6B84D',
]

const DEFAULT_PANEL_SIZE = { width: 704, height: 760 }
const MIN_PANEL_SIZE = { width: 360, height: 420 }

const FIELD_LABELS: Record<string, string> = {
  record_id: 'Record ID',
  created_at: 'Synced At',
  reporterName: 'Reporter',
  reporterRole: 'Reporter Role',
  reportDate: 'Report Date',
  region: 'Region',
  location: 'Location',
  incidentDate: 'Incident Date',
  incidentType: 'Incident Type',
  incidentTypeOther: 'Other Incident Type',
  severityLevel: 'Severity',
  description: 'Description',
  numberOfAffected: 'People Affected',
  actionTaken: 'Action Taken',
  referralMade: 'Referral Made',
  referralDetails: 'Referral Details',
  followUpRequired: 'Follow-Up Required',
  additionalNotes: 'Notes',
  interviewerName: 'Interviewer',
  interviewDate: 'Interview Date',
  beneficiaryCode: 'Beneficiary Code',
  ageRange: 'Age Range',
  gender: 'Gender',
  householdSize: 'Household Size',
  primaryNeeds: 'Primary Needs',
  currentSituation: 'Current Situation',
  servicesReceived: 'Services Received',
  satisfactionLevel: 'Satisfaction',
  protectionConcerns: 'Protection Concerns',
  protectionDetails: 'Protection Details',
}

const INCIDENT_COLUMN_ORDER = [
  'incidentDate',
  'region',
  'incidentType',
  'severityLevel',
  'numberOfAffected',
  'description',
  'actionTaken',
  'referralMade',
  'followUpRequired',
  'reporterName',
  'reporterRole',
  'location',
  'record_id',
  'created_at',
]

const BENEFICIARY_COLUMN_ORDER = [
  'interviewDate',
  'region',
  'beneficiaryCode',
  'primaryNeeds',
  'householdSize',
  'protectionConcerns',
  'currentSituation',
  'servicesReceived',
  'satisfactionLevel',
  'interviewerName',
  'ageRange',
  'gender',
  'record_id',
  'created_at',
]

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function titleize(value: string): string {
  return value
    .replace(/,/g, ', ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatBucketLabel(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(month, 10) - 1]} ${year}`
  }
  return titleize(value)
}

function formatShortBucketLabel(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(month, 10) - 1]} ${year.slice(2)}`
  }
  return titleize(value)
}

type ChartTooltipPayload = {
  name?: unknown
  value?: unknown
  payload?: {
    name?: unknown
    value?: unknown
  }
}

type RechartsHoverState = {
  isTooltipActive?: boolean
  activeLabel?: unknown
  activePayload?: ChartTooltipPayload[]
}

function CompactTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
  label?: unknown
}) {
  if (!active || !payload?.length) return null

  const first = payload[0]
  const name = first.payload?.name ?? label ?? 'Value'
  const value = first.value

  return (
    <div className="rounded-md border border-[var(--dash-warm-border)] bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
      <p className="mb-1 font-semibold text-foreground">
        {formatBucketLabel(String(name))}
      </p>
      <p className="text-muted-foreground">
        Count:{' '}
        <span className="font-semibold text-foreground">
          {typeof value === 'number' ? formatNumber(value) : String(value)}
        </span>
      </p>
    </div>
  )
}

function CompactTooltip() {
  return (
    <Tooltip
      allowEscapeViewBox={{ x: true, y: true }}
      cursor={{ fill: 'rgba(47, 124, 135, 0.08)' }}
      content={<CompactTooltipContent />}
      wrapperStyle={{ zIndex: 80, outline: 'none' }}
    />
  )
}

function getChartHoverDatum(state: RechartsHoverState): ChartHoverDatum | null {
  if (!state.isTooltipActive || !state.activePayload?.length) return null

  const first = state.activePayload[0]
  const label = first.payload?.name ?? state.activeLabel ?? first.name
  const value = first.value ?? first.payload?.value

  if (label === undefined || value === undefined) return null

  return {
    label: formatBucketLabel(String(label)),
    value: typeof value === 'number' ? formatNumber(value) : String(value),
  }
}

function ChartHoverReadout({ datum }: { datum: ChartHoverDatum | null }) {
  return (
    <div className="mb-2 flex min-h-8 justify-end">
      {datum ? (
        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--dash-warm-border)] bg-card px-3 py-1.5 text-xs text-card-foreground shadow-sm">
          <span className="font-semibold text-foreground">{datum.label}</span>
          <span className="text-muted-foreground">Count</span>
          <span className="font-semibold text-primary">{datum.value}</span>
        </div>
      ) : null}
    </div>
  )
}

function formatFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isDateLikeField(field: string): boolean {
  return field === 'created_at' || /date$/i.test(field)
}

function formatCellValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '-'
  if (Array.isArray(value)) return value.map((item) => titleize(String(item))).join(', ')
  if (typeof value === 'string') {
    if (isDateLikeField(field)) return formatDate(value)
    if (field === 'record_id' && value.length > 18) return `${value.slice(0, 8)}...${value.slice(-4)}`
    if (/^[a-z0-9_-]+$/i.test(value) && /[_-]/.test(value)) return titleize(value)
    return value
  }
  return String(value)
}

function getCellTitle(field: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (field === 'record_id') return String(value)
  if (typeof value === 'string' && value.length > 60) return value
  return undefined
}

function hasUsefulValue(rows: Record<string, unknown>[], column: string): boolean {
  return rows.some((row) => {
    const value = row[column]
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  })
}

function getDisplayColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return []
  const allColumns = Object.keys(rows[0]).filter((column) =>
    hasUsefulValue(rows, column),
  )
  const isIncidentResult = allColumns.includes('incidentType') || allColumns.includes('severityLevel')
  const order = isIncidentResult ? INCIDENT_COLUMN_ORDER : BENEFICIARY_COLUMN_ORDER
  const ordered = order.filter((column) => allColumns.includes(column))
  const remaining = allColumns.filter((column) => !ordered.includes(column))
  return [...ordered, ...remaining].slice(0, 14)
}

function columnClassName(column: string): string {
  if (
    column === 'description' ||
    column === 'actionTaken' ||
    column === 'currentSituation' ||
    column === 'servicesReceived' ||
    column === 'referralDetails' ||
    column === 'protectionDetails' ||
    column === 'additionalNotes'
  ) {
    return 'min-w-[240px] max-w-[320px] whitespace-normal leading-5'
  }
  if (column === 'record_id') return 'min-w-[130px] max-w-[150px] whitespace-nowrap'
  return 'min-w-[130px] whitespace-nowrap'
}

function tableToTsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(formatFieldLabel).join('\t')
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const value = row[column]
          if (Array.isArray(value)) return value.map(String).join(', ')
          if (value === undefined || value === null) return ''
          return String(value).replace(/\s+/g, ' ').trim()
        })
        .join('\t'),
    )
    .join('\n')
  return `${header}\n${body}`
}

function CopyTableButton({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[]
  columns: string[]
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tableToTsv(rows, columns))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-md border border-[var(--dash-warm-border)] bg-card px-2.5 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover/table:opacity-100"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy table'}
    </button>
  )
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = getDisplayColumns(rows)
  if (columns.length === 0) return null

  return (
    <div className="group/table relative max-h-[430px] overflow-auto rounded-lg border border-[var(--dash-warm-border)] bg-card shadow-sm">
      <CopyTableButton rows={rows} columns={columns} />
      <table className="min-w-[920px] border-collapse text-sm text-foreground">
        <thead>
          <tr className="border-b border-[var(--dash-warm-border)] bg-muted/95">
            {columns.map((column) => (
              <th
                key={column}
                className={`${columnClassName(column)} sticky top-0 z-10 bg-muted/95 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}
              >
                {formatFieldLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--dash-warm-border)]">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-muted/45">
              {columns.map((column) => (
                <td
                  key={column}
                  className={`${columnClassName(column)} px-3 py-3 align-top text-card-foreground`}
                  title={getCellTitle(column, row[column])}
                >
                  {formatCellValue(column, row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderError(error: ChatMessage['error']) {
  if (!error) return null
  let text = 'Something went wrong.'
  switch (error.type) {
    case 'unauthenticated':
      text = 'Your session has expired. Please log in again.'
      break
    case 'invalid_response':
      text = "I couldn't understand that. Try rephrasing."
      break
    case 'rate_limited':
      text = 'Too many questions in a short time. Try again in a moment.'
      break
    case 'upstream_error':
      text = "Couldn't reach the AI service right now. Try again shortly."
      break
  }
  return <p className="mt-2 text-sm text-destructive">{text}</p>
}

function containsAnyTerm(normalized: string, terms: string[]): boolean {
  return terms.some((term) => normalized.includes(term))
}

function getPrivacyBoundaryMessage(question: string): string | null {
  const normalized = normalizeForMatch(question)
  const sensitiveTerms = [
    'record id',
    'beneficiary code',
    'reporter',
    'interviewer',
    'agent',
    'submitter',
    'submitted',
    'name',
    'phone',
    'contact',
    'address',
    'gps',
    'coordinate',
    'exact location',
    'description',
    'descriptions',
    'note',
    'notes',
    'details',
    'raw',
    'free text',
    'photo',
    'image',
    'attachment',
    'full record',
    'case file',
  ]
  const rowLevelTerms = [
    'show records',
    'show reports',
    'show incidents',
    'show beneficiaries',
    'list records',
    'list reports',
    'list incidents',
    'list beneficiaries',
    'what are the incidents',
    'what are the beneficiaries',
    'display records',
    'view records',
    'export records',
    'download records',
    'all records',
    'all reports',
    'all rows',
    'table of records',
    'table of incidents',
  ]
  const aggregateSafeTerms = [
    'count',
    'counts',
    'how many',
    'group',
    'grouped',
    'aggregate',
    'total',
    'trend',
    'breakdown',
    'by region',
    'by type',
    'by severity',
    'chart',
    'rank',
    'top',
    'highest',
    'lowest',
    'most',
    'least',
    'share',
    'percentage',
    'mix',
  ]
  const asksToReveal = /\b(who|show|list|view|display|export|download|what|which|give|tell|open)\b/.test(normalized)
  const asksSensitiveField = asksToReveal && containsAnyTerm(normalized, sensitiveTerms)
  const asksRowLevelData =
    containsAnyTerm(normalized, rowLevelTerms) &&
    !containsAnyTerm(normalized, aggregateSafeTerms)

  if (!asksSensitiveField && !asksRowLevelData) return null

  return [
    'I cannot answer that through AI because it could expose row-level records, identities, descriptions, notes, exact locations, or other sensitive fields.',
    'Raw decrypted records stay in Record Review for deliberate authorized access. I can help with aggregate-safe questions such as counts by region, severity mix, incident types, needs, trends, or high-level risk scores.',
  ].join(' ')
}

function ResultRenderer({ result }: { result: ExecutorResult }) {
  const [chartHover, setChartHover] = useState<ChartHoverDatum | null>(null)

  if (result.kind === 'empty') {
    return (
      <div className="mt-3">
        {result.summary ? (
          <p className="mb-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">No records match your query.</p>
      </div>
    )
  }

  if (result.kind === 'aggregate') {
    const chartData = result.groups.map((group) => ({
      name: group.key,
      value: group.value,
    }))
    const useVerticalBar = result.chartHint === 'bar' && chartData.length > 6
    const isDenseLineChart = result.chartHint === 'line' && chartData.length > 8
    const chartHeight = useVerticalBar
      ? clamp(chartData.length * 34 + 92, 320, 560)
      : result.chartHint === 'line'
        ? 360
        : 320
    const barRadius: [number, number, number, number] = useVerticalBar
      ? [0, 4, 4, 0]
      : [4, 4, 0, 0]
    if (result.chartHint === 'table') {
      return (
        <div className="mt-3">
          <p className="mb-2 text-base font-semibold text-foreground">{result.title}</p>
          {result.summary ? (
            <p className="mb-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
          ) : null}
          <ResultTable rows={chartData} />
        </div>
      )
    }

    return (
      <div className="mt-3 w-full min-w-0">
        <p className="mb-2 text-base font-semibold text-foreground">{result.title}</p>
        {result.summary ? (
          <p className="mb-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
        ) : null}
        <ChartHoverReadout datum={chartHover} />
        <ResponsiveContainer width="100%" height={chartHeight}>
          {result.chartHint === 'bar' ? (
            <BarChart
              data={chartData}
              layout={useVerticalBar ? 'vertical' : 'horizontal'}
              onMouseMove={(state: RechartsHoverState) =>
                setChartHover(getChartHoverDatum(state))
              }
              onMouseLeave={() => setChartHover(null)}
              margin={
                useVerticalBar
                  ? { top: 8, right: 18, bottom: 8, left: 8 }
                  : { top: 8, right: 12, bottom: chartData.length > 4 ? 34 : 8, left: 0 }
              }
            >
              {useVerticalBar ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    interval={0}
                    width={124}
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickFormatter={formatBucketLabel}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={chartData.length > 4 ? -24 : 0}
                    textAnchor={chartData.length > 4 ? 'end' : 'middle'}
                    height={chartData.length > 4 ? 58 : 30}
                    tickFormatter={formatShortBucketLabel}
                    tick={{ fontSize: 10.5, fill: 'var(--color-muted-foreground)' }}
                    tickMargin={8}
                    minTickGap={10}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                </>
              )}
              <CompactTooltip />
              <Bar
                dataKey="value"
                radius={barRadius}
                activeBar={{
                  fillOpacity: 0.82,
                  stroke: 'var(--color-foreground)',
                  strokeWidth: 1,
                }}
              >
                <LabelList
                  dataKey="value"
                  position={useVerticalBar ? 'right' : 'top'}
                  formatter={(value: number) => formatNumber(value)}
                  style={{
                    fill: 'var(--color-muted-foreground)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index % COLORS.length]}
                    onMouseEnter={() =>
                      setChartHover({
                        label: formatBucketLabel(entry.name),
                        value: formatNumber(entry.value),
                      })
                    }
                    onMouseLeave={() => setChartHover(null)}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : result.chartHint === 'line' ? (
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: isDenseLineChart ? 54 : 34, left: 0 }}
              onMouseMove={(state: RechartsHoverState) =>
                setChartHover(getChartHoverDatum(state))
              }
              onMouseLeave={() => setChartHover(null)}
            >
              <XAxis
                dataKey="name"
                interval={isDenseLineChart ? 'preserveStartEnd' : 0}
                angle={chartData.length > 6 ? -32 : 0}
                textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                height={chartData.length > 6 ? 72 : 30}
                tickFormatter={formatShortBucketLabel}
                tick={{ fontSize: 10.5, fill: 'var(--color-muted-foreground)' }}
                tickMargin={8}
                minTickGap={14}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
              <CompactTooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                activeDot={{ r: 5, strokeWidth: 2 }}
              >
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value: number) => formatNumber(value)}
                    style={{
                      fill: 'var(--color-muted-foreground)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
              </Line>
            </LineChart>
          ) : (
            <PieChart
              onMouseMove={(state: RechartsHoverState) =>
                setChartHover(getChartHoverDatum(state))
              }
              onMouseLeave={() => setChartHover(null)}
            >
              <CompactTooltip />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={105}
                label={({ name, value }) =>
                  `${formatBucketLabel(String(name))}: ${
                    typeof value === 'number' ? formatNumber(value) : String(value)
                  }`
                }
                labelLine
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[index % COLORS.length]}
                    onMouseEnter={() =>
                      setChartHover({
                        label: formatBucketLabel(entry.name),
                        value: formatNumber(entry.value),
                      })
                    }
                    onMouseLeave={() => setChartHover(null)}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-base font-semibold text-foreground">{result.title}</p>
      {result.summary ? (
        <p className="mb-3 text-sm leading-6 text-muted-foreground">{result.summary}</p>
      ) : null}
      <ResultTable rows={result.rows} />
    </div>
  )
}

function findRegionInQuestion(question: string, records: DecryptedRecord[]): string | null {
  const normalizedQuestion = normalizeForMatch(question)
  const regions = Array.from(
    new Set(
      records
        .map((record) => record.data.region)
        .filter((region): region is string => typeof region === 'string' && region.trim() !== ''),
    ),
  ).sort((a, b) => b.length - a.length)

  return regions.find((region) =>
    normalizedQuestion.includes(normalizeForMatch(region)),
  ) ?? null
}

function getLastSpec(messages: ChatMessage[]): AiQuerySpec | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const spec = messages[index].spec
    if (spec) return spec
  }
  return null
}

function getRegionFromSpec(spec: AiQuerySpec | null): string | null {
  if (!spec) return null
  const regionFilter = spec.filters.find((filter) =>
    filter.field === 'region' &&
    filter.operator === 'eq' &&
    typeof filter.value === 'string',
  )
  return typeof regionFilter?.value === 'string' ? regionFilter.value : null
}

function parseRequestedLimit(question: string): number | null {
  const match = question.match(/\b(?:top|show|list)?\s*(\d{1,2})\b/i)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 25) : null
}

function buildLocalSpec(
  question: string,
  records: DecryptedRecord[],
  messages: ChatMessage[],
): AiQuerySpec | null {
  const normalized = normalizeForMatch(question)
  const previousSpec = getLastSpec(messages)
  const explicitRegion = findRegionInQuestion(question, records)
  const region = explicitRegion ?? getRegionFromSpec(previousSpec)
  const mentionsIncident = /\bincidents?\b/.test(normalized)
  const mentionsBeneficiary = /\bbeneficiar/.test(normalized)
  const asksForSubmitter =
    /\b(who|agent|submitted|submitter|reporter|interviewer|staff)\b/.test(normalized) &&
    /\b(agent|submitted|submitter|reporter|interviewer|staff|reports?)\b/.test(normalized)
  const asksForRanking =
    /\b(highest|rank|ranking|top|worst|most severe|highest risk|priority)\b/.test(normalized)

  if (!region) return null

  if (asksForSubmitter) return null

  if (mentionsIncident || mentionsBeneficiary || asksForRanking) {
    const limit = parseRequestedLimit(question)
    const formType = mentionsBeneficiary ? 'beneficiary' : 'incident'
    const groupField = formType === 'beneficiary' ? 'primaryNeeds' : 'incidentType'
    return {
      intent: 'aggregate',
      formType,
      filters: [{ field: 'region', operator: 'eq', value: region }],
      groupBy: [{ field: groupField }],
      aggregate: 'count',
      aggregateField: null,
      sortBy: { field: 'value', direction: 'desc' },
      limit: limit ?? 10,
      chartHint: 'bar',
      title:
        formType === 'beneficiary'
          ? `Beneficiary needs in ${region}`
          : `Incident types in ${region}`,
      dateRange: null,
      summary:
        formType === 'beneficiary'
          ? `Aggregate beneficiary need counts for ${region}. Raw record details stay in Record Review.`
          : `Aggregate incident type counts for ${region}. Raw record details stay in Record Review.`,
    }
  }

  return null
}

export function ChatPanel({ isOpen, onClose, records }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [panelSize, setPanelSize] = useState(DEFAULT_PANEL_SIZE)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setPanelSize(DEFAULT_PANEL_SIZE)
    }
  }, [isOpen])

  const handleResizeStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startSize = panelSize

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const maxWidth = Math.max(MIN_PANEL_SIZE.width, window.innerWidth - 48)
      const maxHeight = Math.max(MIN_PANEL_SIZE.height, window.innerHeight - 48)
      setPanelSize({
        width: clamp(
          startSize.width + startX - moveEvent.clientX,
          MIN_PANEL_SIZE.width,
          maxWidth,
        ),
        height: clamp(
          startSize.height + startY - moveEvent.clientY,
          MIN_PANEL_SIZE.height,
          maxHeight,
        ),
      })
    }

    const handleEnd = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
  }

  const handleMinimize = () => {
    onClose()
  }

  const handleClose = () => {
    setInput('')
    setMessages([])
    setIsLoading(false)
    onClose()
  }

  const appendUserAndResult = (
    question: string,
    spec: AiQuerySpec,
    routeLabel: string,
  ) => {
    setMessages((previous) => [
      ...previous,
      { id: generateId(), role: 'user', text: question },
      {
        id: generateId(),
        role: 'assistant',
        result: executeSpec(spec, records),
        routeLabel,
        spec,
      },
    ])
  }

  const handleSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return
    const question = text.trim()
    if (question.length > 500) return

    setInput('')

    const privacyBoundaryMessage = getPrivacyBoundaryMessage(question)
    if (privacyBoundaryMessage) {
      setMessages((previous) => [
        ...previous,
        { id: generateId(), role: 'user', text: question },
        { id: generateId(), role: 'assistant', text: privacyBoundaryMessage },
      ])
      return
    }

    const localSpec = buildLocalSpec(question, records, messages)
    if (localSpec) {
      appendUserAndResult(question, localSpec, 'AI-assisted dashboard query')
      return
    }

    setMessages((previous) => [
      ...previous,
      { id: generateId(), role: 'user', text: question },
    ])
    setIsLoading(true)

    try {
      const schema = buildEnrichedSchema()
      const result = await chat({ data: { question, schema } })
      if ('error' in result) {
        const fallbackSpec = buildLocalSpec(question, records, messages)
        if (fallbackSpec) {
          setMessages((previous) => [
            ...previous,
            {
              id: generateId(),
              role: 'assistant',
              result: executeSpec(fallbackSpec, records),
              routeLabel: 'AI-assisted dashboard query',
              spec: fallbackSpec,
            },
          ])
          return
        }

        setMessages((previous) => [
          ...previous,
          {
            id: generateId(),
            role: 'assistant',
            error: {
              type: result.error,
              message: 'message' in result ? result.message : undefined,
            },
          },
        ])
      } else {
        setMessages((previous) => [
          ...previous,
          {
            id: generateId(),
            role: 'assistant',
            result: executeSpec(result, records),
            routeLabel: 'AI-assisted dashboard query',
            spec: result,
          },
        ])
      }
    } catch (error: unknown) {
      setMessages((previous) => [
        ...previous,
        {
          id: generateId(),
          role: 'assistant',
          error: {
            type: 'upstream_error',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCannedQuery = (canned: { label: string; spec: AiQuerySpec }) => {
    if (isLoading) return
    appendUserAndResult(canned.label, canned.spec, 'Saved dashboard view')
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[1100] flex min-h-[420px] min-w-[360px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-lg border border-[var(--dash-warm-border)] bg-card text-card-foreground"
      style={{
        width: `min(${panelSize.width}px, calc(100vw - 3rem))`,
        height: `min(${panelSize.height}px, calc(100vh - 3rem))`,
        boxShadow:
          '0 24px 90px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(47, 124, 135, 0.18)',
      }}
    >
      <button
        type="button"
        onPointerDown={handleResizeStart}
        className="absolute bottom-2 left-2 z-30 rounded-md border border-[var(--dash-warm-border)] bg-card/95 p-1 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
        aria-label="Resize analyst panel"
        title="Resize"
      >
        <Grip className="h-4 w-4" />
      </button>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--dash-warm-border)] bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">AI Analyst</h2>
            <p className="text-xs text-muted-foreground">
              Schema-only planning over {records.length} visible records
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleMinimize}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Minimize analyst panel"
            title="Minimize"
          >
            <Minus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close analyst panel"
            title="Close and reset chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-background/40 p-5"
      >
        {messages.length === 0 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-[var(--dash-warm-border)] bg-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Ask operational questions
                </h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Saved views run in this browser. Typed questions use AI to create
                a safe query plan without sending decrypted records.
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Quick views
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CANNED_QUERIES.map((canned) => (
                  <button
                    key={canned.label}
                    type="button"
                    onClick={() => handleCannedQuery(canned)}
                    className="rounded-md border border-[var(--dash-warm-border)] bg-card px-4 py-3 text-left text-sm font-medium text-card-foreground transition-colors hover:border-[var(--dash-warm-terra)] hover:bg-muted hover:text-foreground"
                  >
                    {canned.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`min-w-0 rounded-lg px-4 py-3 text-sm ${
                message.role === 'assistant' && message.result
                  ? 'w-full max-w-[96%]'
                  : 'max-w-[96%]'
              } ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-[var(--dash-warm-border)] bg-card text-card-foreground shadow-sm'
              }`}
            >
              {message.text ? <p>{message.text}</p> : null}
              {message.routeLabel ? (
                <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                  {message.routeLabel}
                </p>
              ) : null}
              {message.result ? <ResultRenderer result={message.result} /> : null}
              {message.error ? renderError(message.error) : null}
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Planning query...
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--dash-warm-border)] bg-card p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSubmit(input)
              }
            }}
            placeholder="Try: Which region needs attention first?"
            maxLength={500}
            rows={1}
            className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => handleSubmit(input)}
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {input.length}/500
        </p>
      </div>
    </div>
  )
}
