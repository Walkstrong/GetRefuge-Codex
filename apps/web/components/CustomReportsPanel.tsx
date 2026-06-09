import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { generateSitRep, type SitRepNarrative } from '../src/routes/api/-sitrep'
import {
  computeSitRepAggregates,
  type SitRepAggregates,
  type DecryptedRecord as SitRepRecord,
} from '../lib/sitrepAggregates'
import {
  applySitRepKAnonymity,
  SITREP_K_ANONYMITY_ENABLED,
  SITREP_K_ANONYMITY_THRESHOLD,
  type KAnonymitySummary,
} from '../lib/privacy/anonymity'
import type { DecryptedRecord } from '../src/routes/dashboard'

type Audience = 'operations' | 'donors' | 'internal'
type StudioStatus = 'idle' | 'computing' | 'narrating' | 'preview' | 'error'

type SitRepError = {
  error: {
    type: string
    message: string
  }
}

const CHART_COLORS = [
  '#6BA5B4',
  '#76B08A',
  '#F2A56F',
  '#D96C75',
  '#8FA4F2',
  '#6ECAD0',
  '#B6A2E3',
  '#D6B84D',
]

const AUDIENCE_OPTIONS: Array<{ value: Audience; label: string; detail: string }> = [
  {
    value: 'operations',
    label: 'Operations',
    detail: 'Tactical and action-oriented',
  },
  {
    value: 'donors',
    label: 'Donors',
    detail: 'Plain language and outcome-focused',
  },
  {
    value: 'internal',
    label: 'Internal',
    detail: 'Analytical and candid about gaps',
  },
]

function titleize(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function getRecordDate(record: DecryptedRecord): string | null {
  const candidate =
    record.form_type === 'incident'
      ? record.incidentDate ?? record.reportDate ?? record.created_at
      : record.interviewDate ?? record.created_at
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function inferPeriodLabel(records: DecryptedRecord[]): string {
  const dates = records
    .map(getRecordDate)
    .filter((date): date is string => date !== null)
    .sort((a, b) => a.localeCompare(b))
  if (dates.length === 0) return 'Current filtered dataset'
  const start = dates[0]
  const end = dates[dates.length - 1]
  return start === end ? start : `${start} to ${end}`
}

function aggregateItemCount(aggregates: SitRepAggregates): number {
  return [
    aggregates.incidentsByRegion,
    aggregates.incidentsBySeverity,
    aggregates.incidentsByType,
    aggregates.incidentsByMonth,
    aggregates.topProtectionConcerns,
    aggregates.topPrimaryNeeds,
    aggregates.beneficiariesByAgeRange,
    aggregates.beneficiariesByGender,
    aggregates.regionalPressureScore,
  ].reduce((sum, list) => sum + list.length, 0)
}

function asSitRepRecords(records: DecryptedRecord[]): SitRepRecord[] {
  return records.map((record) => {
    const { record_id, form_type, created_at, ...rest } = record
    return { record_id, form_type, created_at, ...rest }
  })
}

function isSitRepError(value: SitRepNarrative | SitRepError): value is SitRepError {
  return 'error' in value
}

function formatDateGenerated(): string {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Methodology({
  aggregates,
  activeFilterLabels,
  periodLabel,
}: {
  aggregates: SitRepAggregates
  activeFilterLabels: string[]
  periodLabel: string
}) {
  const totalRecords =
    aggregates.totals.incidentReports + aggregates.totals.beneficiaryInterviews
  const dateRange = aggregates.totals.dateRange
    ? `${aggregates.totals.dateRange.start} to ${aggregates.totals.dateRange.end}`
    : 'No record date range available'

  return (
    <section className="sitrep-page-break space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">
        Methodology & Provenance
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Evidence base
          </p>
          <p className="mt-2 text-sm leading-relaxed text-card-foreground">
            This SitRep covers {formatNumber(totalRecords)} filtered field records:
            {' '}
            {formatNumber(aggregates.totals.incidentReports)} incident reports
            and {formatNumber(aggregates.totals.beneficiaryInterviews)} beneficiary
            interviews. The period label is {periodLabel}; the detected record
            date range is {dateRange}.
          </p>
        </div>
        <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Privacy boundary
          </p>
          <p className="mt-2 text-sm leading-relaxed text-card-foreground">
            All raw decrypted records, names, descriptions, notes, and free-text
            fields stayed in this browser. Only aggregate counts and distribution
            totals were sent to the configured AI model for narrative drafting. The returned
            narrative was validated against a Zod schema before display.
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Active filters
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(activeFilterLabels.length > 0 ? activeFilterLabels : ['No active filters']).map(
            (label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--dash-warm-border)] px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  )
}

function CompactTooltip() {
  return (
    <Tooltip
      contentStyle={{
        border: '1px solid var(--dash-warm-border)',
        borderRadius: 6,
        boxShadow: '0 8px 20px rgba(15, 35, 40, 0.12)',
        color: 'var(--color-foreground)',
        fontSize: 12,
      }}
      itemStyle={{ color: 'var(--color-foreground)', fontSize: 12 }}
      labelStyle={{ color: 'var(--color-muted-foreground)', fontSize: 11 }}
      formatter={(value, name) => [
        typeof value === 'number' ? formatNumber(value) : String(value),
        titleize(String(name)),
      ]}
      labelFormatter={(label) => titleize(String(label))}
    />
  )
}

function AggregateInspector({
  aggregates,
  privacySummary,
}: {
  aggregates: SitRepAggregates | null
  privacySummary: KAnonymitySummary | null
}) {
  if (!aggregates) {
    return (
      <div className="rounded-md border border-dashed border-[var(--dash-warm-border)] p-4 text-sm text-muted-foreground">
        Aggregates will appear here after local computation.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--dash-warm-border)] bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {aggregateItemCount(aggregates)} aggregate groups ready
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sending counts only - no record contents, names, descriptions, notes,
            or free text.
          </p>
          {privacySummary?.enabled ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Small groups may be hidden before AI drafting to protect privacy
              (k={privacySummary.threshold}).
              {privacySummary.suppressedGroups > 0
                ? ` ${privacySummary.suppressedGroups} small groups suppressed.`
                : ''}
            </p>
          ) : null}
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
          Inspect aggregate JSON sent to AI
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-[var(--dash-warm-border)] bg-background p-3 text-xs text-foreground">
          {JSON.stringify(aggregates, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function SitRepPreview({
  title,
  periodLabel,
  activeFilterLabels,
  aggregates,
  narrative,
  onPrint,
  onRegenerate,
  onEditInputs,
}: {
  title: string
  periodLabel: string
  activeFilterLabels: string[]
  aggregates: SitRepAggregates
  narrative: SitRepNarrative
  onPrint: () => void
  onRegenerate: () => void
  onEditInputs: () => void
}) {
  const totalRecords =
    aggregates.totals.incidentReports + aggregates.totals.beneficiaryInterviews

  return (
    <article className="sitrep-print-root rounded-lg border border-[var(--dash-warm-border)] bg-card p-6 shadow-sm">
      <div className="sitrep-no-print mb-5 flex flex-col gap-3 border-b border-[var(--dash-warm-border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Preview
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            Printable Situation Report
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditInputs}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            Edit inputs
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <header className="border-b border-[var(--dash-warm-border)] pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            GetRefuge Situation Report
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground">
            {title.trim() || `Situation Report - ${periodLabel}`}
          </h1>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-card-foreground md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Organisation
              </p>
              <p className="mt-1 font-medium">GetRefuge HQ</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Period covered
              </p>
              <p className="mt-1 font-medium">{periodLabel}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Date generated
              </p>
              <p className="mt-1 font-medium">{formatDateGenerated()}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(activeFilterLabels.length > 0 ? activeFilterLabels : ['No active filters']).map(
              (label) => (
                <span
                  key={label}
                  className="rounded-full border border-[var(--dash-warm-border)] px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Records
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatNumber(totalRecords)}
            </p>
          </div>
          <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              People affected
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatNumber(aggregates.totals.peopleAffected)}
            </p>
          </div>
          <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Households covered
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatNumber(aggregates.totals.householdsCovered)}
            </p>
          </div>
          <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              High severity share
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatPercent(aggregates.highSeverityShare)}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground">
            Executive Summary
          </h2>
          <p className="mt-3 text-base leading-7 text-card-foreground">
            {narrative.executiveSummary}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground">Key Findings</h2>
          <ul className="mt-3 space-y-2">
            {narrative.keyFindings.map((finding) => (
              <li key={finding} className="flex gap-3 text-sm leading-6 text-card-foreground">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sitrep-page-break">
          <h2 className="text-2xl font-semibold text-foreground">
            Regional Pressure
          </h2>
          <p className="mt-3 text-base leading-7 text-card-foreground">
            {narrative.regionalPressure}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-80 rounded-md border border-[var(--dash-warm-border)] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aggregates.regionalPressureScore}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                  <YAxis
                    type="category"
                    dataKey="key"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    width={96}
                    tickFormatter={titleize}
                  />
                  <CompactTooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {aggregates.regionalPressureScore.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--dash-warm-border)]">
                  <th className="py-2 pr-3 text-left font-semibold text-muted-foreground">
                    Region
                  </th>
                  <th className="py-2 text-right font-semibold text-muted-foreground">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregates.regionalPressureScore.map((row) => (
                  <tr key={row.key} className="border-b border-[var(--dash-warm-border)]">
                    <td className="py-2 pr-3 text-card-foreground">{titleize(row.key)}</td>
                    <td className="py-2 text-right text-card-foreground">
                      {formatNumber(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sitrep-page-break">
          <h2 className="text-2xl font-semibold text-foreground">
            Beneficiary Needs
          </h2>
          <p className="mt-3 text-base leading-7 text-card-foreground">
            {narrative.beneficiaryNeeds}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="h-72 rounded-md border border-[var(--dash-warm-border)] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates.topPrimaryNeeds}>
                  <XAxis
                    dataKey="key"
                    tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                    tickFormatter={titleize}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
                  <CompactTooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {aggregates.topPrimaryNeeds.map((entry, index) => (
                      <Cell
                        key={entry.key}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-md border border-[var(--dash-warm-border)] p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Protection Concern Status
              </h3>
              <div className="mt-3 space-y-2">
                {aggregates.topProtectionConcerns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No protection concern status available.
                  </p>
                ) : (
                  aggregates.topProtectionConcerns.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between border-b border-[var(--dash-warm-border)] py-2 text-sm"
                    >
                      <span className="text-card-foreground">{titleize(row.key)}</span>
                      <span className="font-semibold text-foreground">
                        {formatNumber(row.value)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground">
            Recommendations
          </h2>
          <ol className="mt-3 space-y-2">
            {narrative.recommendations.map((recommendation, index) => (
              <li key={recommendation} className="flex gap-3 text-sm leading-6 text-card-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ol>
        </section>

        <Methodology
          aggregates={aggregates}
          activeFilterLabels={activeFilterLabels}
          periodLabel={periodLabel}
        />
      </div>
    </article>
  )
}

export function CustomReportsPanel({
  records,
  activeFilterLabels,
  onOpenAnalyst,
}: {
  records: DecryptedRecord[]
  activeFilterLabels: string[]
  onOpenAnalyst: () => void
}) {
  const defaultPeriodLabel = useMemo(() => inferPeriodLabel(records), [records])
  const [title, setTitle] = useState(() => `Situation Report - ${defaultPeriodLabel}`)
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel)
  const [audience, setAudience] = useState<Audience>('operations')
  const [status, setStatus] = useState<StudioStatus>('idle')
  const [aggregates, setAggregates] = useState<SitRepAggregates | null>(null)
  const [privacySummary, setPrivacySummary] = useState<KAnonymitySummary | null>(null)
  const [narrative, setNarrative] = useState<SitRepNarrative | null>(null)
  const [error, setError] = useState<SitRepError['error'] | null>(null)
  const [inputsTouched, setInputsTouched] = useState(false)

  useEffect(() => {
    if (inputsTouched) return
    setPeriodLabel(defaultPeriodLabel)
    setTitle(`Situation Report - ${defaultPeriodLabel}`)
  }, [defaultPeriodLabel, inputsTouched])

  const canGenerate = records.length > 0 && title.trim().length > 0 && periodLabel.trim().length > 0

  const runGeneration = async () => {
    if (!canGenerate) return
    setError(null)
    setStatus('computing')
    const nextAggregates = computeSitRepAggregates(asSitRepRecords(records))
    const privacyFiltered = applySitRepKAnonymity(nextAggregates, {
      enabled: SITREP_K_ANONYMITY_ENABLED,
      threshold: SITREP_K_ANONYMITY_THRESHOLD,
    })
    const safeAggregates = privacyFiltered.aggregates
    setPrivacySummary(privacyFiltered.summary)
    setAggregates(safeAggregates)
    await new Promise((resolve) => setTimeout(resolve, 0))
    setStatus('narrating')
    const result = await generateSitRep({
      data: {
        aggregates: safeAggregates,
        filters: activeFilterLabels,
        audience,
        periodLabel: periodLabel.trim(),
      },
    })

    if (isSitRepError(result)) {
      setError(result.error)
      setStatus('error')
      return
    }

    setNarrative(result)
    setStatus('preview')
  }

  const generating = status === 'computing' || status === 'narrating'
  const showPreview = narrative !== null && aggregates !== null && status === 'preview'

  return (
    <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body * { visibility: hidden !important; }
          .sitrep-print-root, .sitrep-print-root * { visibility: visible !important; }
          .sitrep-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
            color: #111827 !important;
            background: #ffffff !important;
          }
          .sitrep-no-print { display: none !important; }
          .sitrep-page-break { break-before: page; page-break-before: always; }
        }
      `}</style>

      <div className="sitrep-no-print rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              AI SitRep Studio
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              Generate publishable report
            </h3>
          </div>
          <Sparkles className="h-5 w-5 text-[var(--dash-warm-terra)]" />
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Dashboard filters
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(activeFilterLabels.length > 0 ? activeFilterLabels : ['No active filters']).map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[var(--dash-warm-border)] px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="sitrepTitle" className="block text-xs font-medium text-card-foreground">
              Report title
            </label>
            <input
              id="sitrepTitle"
              value={title}
              maxLength={140}
              onChange={(event) => {
                setInputsTouched(true)
                setTitle(event.target.value)
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {title.length}/140
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="sitrepAudience" className="block text-xs font-medium text-card-foreground">
              Audience
            </label>
            <select
              id="sitrepAudience"
              value={audience}
              onChange={(event) => setAudience(event.target.value as Audience)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.detail}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="sitrepPeriod" className="block text-xs font-medium text-card-foreground">
              Period label
            </label>
            <input
              id="sitrepPeriod"
              value={periodLabel}
              maxLength={80}
              onChange={(event) => {
                setInputsTouched(true)
                setPeriodLabel(event.target.value)
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {periodLabel.length}/80
            </p>
          </div>

          <div className="rounded-lg border border-[var(--dash-warm-border)] bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Bot className="mt-0.5 h-5 w-5 text-primary" />
              <p className="text-sm leading-relaxed text-card-foreground">
                AI drafting uses only aggregate counts. The browser computes the
                evidence base locally before sending a small, inspectable JSON
                payload.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={runGeneration}
              disabled={!canGenerate || generating}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate SitRep
            </button>
            <button
              type="button"
              onClick={onOpenAnalyst}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--dash-warm-border)] px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              Ask follow-up in AI Analyst
            </button>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {generating ? (
          <div className="sitrep-no-print rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {status === 'computing'
                    ? 'Computing aggregates locally...'
                    : 'AI is drafting the narrative...'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reports use the dashboard's current filtered records.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <AggregateInspector aggregates={aggregates} privacySummary={privacySummary} />
            </div>
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div className="sitrep-no-print rounded-lg border border-destructive/40 bg-destructive/5 p-5 shadow-sm">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h3 className="text-sm font-semibold text-destructive">
                  SitRep generation failed
                </h3>
                <p className="mt-1 text-sm text-destructive">{error.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runGeneration}
                    className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                  {error.type === 'invalid_narrative' ? (
                    <button
                      type="button"
                      onClick={onOpenAnalyst}
                      className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Ask follow-up in AI Analyst
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <AggregateInspector aggregates={aggregates} privacySummary={privacySummary} />
            </div>
          </div>
        ) : null}

        {showPreview ? (
          <SitRepPreview
            title={title}
            periodLabel={periodLabel}
            activeFilterLabels={activeFilterLabels}
            aggregates={aggregates}
            narrative={narrative}
            onPrint={() => window.print()}
            onRegenerate={runGeneration}
            onEditInputs={() => setStatus('idle')}
          />
        ) : null}

        {!showPreview && !generating && status !== 'error' ? (
          <div className="sitrep-no-print rounded-lg border border-[var(--dash-warm-border)] bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Studio preview
                </p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">
                  Ready to generate a Situation Report
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Click Generate SitRep to compute local aggregates, inspect the
                  safe payload, and ask the configured AI model for a validated narrative.
                </p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-5">
              <AggregateInspector aggregates={aggregates} privacySummary={privacySummary} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
