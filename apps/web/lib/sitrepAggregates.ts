import type { AiQuerySpec } from './aiQuerySpec'
import {
  executeSpec,
  type DecryptedRecord as ExecutorRecord,
} from './queryExecutor'

export interface DecryptedRecord {
  record_id: string
  form_type: 'incident' | 'beneficiary'
  created_at: string
  [key: string]: unknown
}

export interface SitRepAggregates {
  totals: {
    incidentReports: number
    beneficiaryInterviews: number
    peopleAffected: number
    householdsCovered: number
    dateRange: { start: string; end: string } | null
  }
  incidentsByRegion: Array<{ key: string; value: number }>
  incidentsBySeverity: Array<{ key: string; value: number }>
  incidentsByType: Array<{ key: string; value: number }>
  incidentsByMonth: Array<{ key: string; value: number }>
  topProtectionConcerns: Array<{ key: string; value: number }>
  topPrimaryNeeds: Array<{ key: string; value: number }>
  beneficiariesByAgeRange: Array<{ key: string; value: number }>
  beneficiariesByGender: Array<{ key: string; value: number }>
  highSeverityShare: number
  regionsCovered: number
  regionalPressureScore: Array<{ key: string; value: number }>
}

type AggregatePoint = { key: string; value: number }

const SEVERITY_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 8,
}

function toExecutorRecords(records: DecryptedRecord[]): ExecutorRecord[] {
  return records.map((record) => {
    const { record_id, form_type, created_at, ...data } = record
    return { record_id, form_type, created_at, data }
  })
}

function buildAggregateSpec(
  formType: 'incident' | 'beneficiary' | 'both',
  groupField: string,
  options: {
    title: string
    chartHint?: 'bar' | 'line' | 'pie' | 'table'
    timeBucket?: 'day' | 'week' | 'month'
    sortDirection?: 'asc' | 'desc'
    limit?: number
  },
): AiQuerySpec {
  return {
    intent: 'aggregate',
    formType,
    filters: [],
    groupBy: [
      options.timeBucket
        ? { field: groupField, timeBucket: options.timeBucket }
        : { field: groupField },
    ],
    aggregate: 'count',
    aggregateField: null,
    scoring: null,
    sortBy: { field: 'value', direction: options.sortDirection ?? 'desc' },
    limit: options.limit ?? null,
    chartHint: options.chartHint ?? 'bar',
    title: options.title,
    dateRange: null,
    summary: undefined,
  }
}

function unwrapAggregate(
  records: ExecutorRecord[],
  spec: AiQuerySpec,
): AggregatePoint[] {
  const result = executeSpec(spec, records)
  if (result.kind !== 'aggregate') return []
  return result.groups.filter((group) => group.key !== 'undefined')
}

function numericValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function recordDate(record: DecryptedRecord): string | null {
  const candidate =
    record.form_type === 'incident'
      ? record.incidentDate ?? record.reportDate ?? record.created_at
      : record.interviewDate ?? record.created_at
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function computeDateRange(records: DecryptedRecord[]): { start: string; end: string } | null {
  const dates = records
    .map(recordDate)
    .filter((date): date is string => date !== null)
    .sort((a, b) => a.localeCompare(b))
  if (dates.length === 0) return null
  return { start: dates[0], end: dates[dates.length - 1] }
}

function countEnumArray(
  records: DecryptedRecord[],
  formType: 'beneficiary' | 'incident',
  field: string,
  limit = 10,
): AggregatePoint[] {
  const counts = new Map<string, number>()
  for (const record of records) {
    if (record.form_type !== formType) continue
    const raw = record[field]
    if (!Array.isArray(raw)) continue
    for (const value of raw) {
      if (typeof value !== 'string' || value.trim() === '') continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, limit)
}

function normalizeBooleanGroup(groups: AggregatePoint[]): AggregatePoint[] {
  return groups
    .map((group) => {
      if (group.key === 'true') return { key: 'Protection Concerns Reported', value: group.value }
      if (group.key === 'false') return { key: 'No Protection Concern Reported', value: group.value }
      return group
    })
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}

function computeRegionalPressure(records: DecryptedRecord[]): AggregatePoint[] {
  const scores = new Map<string, number>()
  for (const record of records) {
    if (record.form_type !== 'incident') continue
    const region = stringValue(record.region)
    if (!region) continue
    const severity = stringValue(record.severityLevel)?.toLowerCase() ?? 'low'
    const weight = SEVERITY_WEIGHTS[severity] ?? 1
    scores.set(region, (scores.get(region) ?? 0) + weight)
  }
  return Array.from(scores.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, 12)
}

function orderedSeverity(groups: AggregatePoint[]): AggregatePoint[] {
  const order = ['critical', 'high', 'medium', 'low']
  return [...groups].sort((a, b) => {
    const aIndex = order.indexOf(a.key.toLowerCase())
    const bIndex = order.indexOf(b.key.toLowerCase())
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? order.length : aIndex) - (bIndex === -1 ? order.length : bIndex)
    }
    return b.value - a.value
  })
}

export function computeSitRepAggregates(records: DecryptedRecord[]): SitRepAggregates {
  const executorRecords = toExecutorRecords(records)
  const incidentRecords = records.filter((record) => record.form_type === 'incident')
  const beneficiaryRecords = records.filter((record) => record.form_type === 'beneficiary')
  const highSeverityCount = incidentRecords.filter((record) => {
    const severity = stringValue(record.severityLevel)
    return severity === 'high' || severity === 'critical'
  }).length
  const regionsCovered = new Set(
    records
      .map((record) => stringValue(record.region))
      .filter((region): region is string => region !== null),
  ).size

  return {
    totals: {
      incidentReports: incidentRecords.length,
      beneficiaryInterviews: beneficiaryRecords.length,
      peopleAffected: incidentRecords.reduce(
        (sum, record) => sum + numericValue(record.numberOfAffected),
        0,
      ),
      householdsCovered: beneficiaryRecords.reduce(
        (sum, record) => sum + numericValue(record.householdSize),
        0,
      ),
      dateRange: computeDateRange(records),
    },
    incidentsByRegion: unwrapAggregate(
      executorRecords,
      buildAggregateSpec('incident', 'region', {
        title: 'Incidents by region',
        limit: 12,
      }),
    ),
    incidentsBySeverity: orderedSeverity(
      unwrapAggregate(
        executorRecords,
        buildAggregateSpec('incident', 'severityLevel', {
          title: 'Incidents by severity',
          limit: 8,
        }),
      ),
    ),
    incidentsByType: unwrapAggregate(
      executorRecords,
      buildAggregateSpec('incident', 'incidentType', {
        title: 'Incidents by type',
        limit: 12,
      }),
    ),
    incidentsByMonth: unwrapAggregate(
      executorRecords,
      buildAggregateSpec('incident', 'incidentDate', {
        title: 'Incidents by month',
        chartHint: 'line',
        timeBucket: 'month',
        sortDirection: 'asc',
      }),
    ).slice(-12),
    topProtectionConcerns: normalizeBooleanGroup(
      unwrapAggregate(
        executorRecords,
        buildAggregateSpec('beneficiary', 'protectionConcerns', {
          title: 'Protection concern status',
          limit: 4,
        }),
      ),
    ),
    topPrimaryNeeds: countEnumArray(records, 'beneficiary', 'primaryNeeds', 10),
    beneficiariesByAgeRange: unwrapAggregate(
      executorRecords,
      buildAggregateSpec('beneficiary', 'ageRange', {
        title: 'Beneficiaries by age range',
        limit: 10,
      }),
    ),
    beneficiariesByGender: unwrapAggregate(
      executorRecords,
      buildAggregateSpec('beneficiary', 'gender', {
        title: 'Beneficiaries by gender',
        limit: 8,
      }),
    ),
    highSeverityShare:
      incidentRecords.length === 0 ? 0 : highSeverityCount / incidentRecords.length,
    regionsCovered,
    regionalPressureScore: computeRegionalPressure(records),
  }
}
