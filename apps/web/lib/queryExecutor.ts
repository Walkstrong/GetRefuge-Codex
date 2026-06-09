import type { AiQuerySpec } from './aiQuerySpec'

export interface DecryptedRecord {
  record_id: string
  form_type: 'incident' | 'beneficiary'
  created_at: string
  data: Record<string, unknown>
}

export type ExecutorResult =
  | {
      kind: 'rows'
      rows: Record<string, unknown>[]
      chartHint: 'table' | 'bar' | 'line' | 'pie'
      title: string
      summary?: string
    }
  | {
      kind: 'aggregate'
      groups: Array<{ key: string; value: number }>
      chartHint: 'table' | 'bar' | 'line' | 'pie'
      title: string
      summary?: string
    }
  | { kind: 'empty'; title: string; summary?: string }

function evaluateFilter(
  fieldValue: unknown,
  operator: string,
  filterValue: unknown,
): boolean {
  if (fieldValue === undefined || fieldValue === null) return false
  switch (operator) {
    case 'eq':
      return fieldValue === filterValue
    case 'neq':
      return fieldValue !== filterValue
    case 'gt':
      return (
        typeof fieldValue === 'number' &&
        typeof filterValue === 'number' &&
        fieldValue > filterValue
      )
    case 'lt':
      return (
        typeof fieldValue === 'number' &&
        typeof filterValue === 'number' &&
        fieldValue < filterValue
      )
    case 'gte':
      return (
        typeof fieldValue === 'number' &&
        typeof filterValue === 'number' &&
        fieldValue >= filterValue
      )
    case 'lte':
      return (
        typeof fieldValue === 'number' &&
        typeof filterValue === 'number' &&
        fieldValue <= filterValue
      )
    case 'contains':
      if (
        typeof fieldValue === 'string' &&
        typeof filterValue === 'string'
      )
        return fieldValue.includes(filterValue)
      return Array.isArray(fieldValue) && fieldValue.includes(filterValue)
    case 'contains_any':
      return (
        Array.isArray(fieldValue) &&
        Array.isArray(filterValue) &&
        (filterValue as unknown[]).some((v) => fieldValue.includes(v))
      )
    case 'in':
      if (Array.isArray(filterValue))
        return (filterValue as unknown[]).includes(fieldValue)
      return false
    default:
      return false
  }
}

function bucketDate(iso: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (bucket === "day") return d.toISOString().slice(0, 10)
  if (bucket === "month") return d.toISOString().slice(0, 7)
  const dayOfWeek = d.getUTCDay() || 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - dayOfWeek + 1)
  return monday.toISOString().slice(0, 10)
}

function groupAndAggregate(
  records: DecryptedRecord[],
  spec: AiQuerySpec,
): Array<{ key: string; value: number }> {
const groupItems = spec.groupBy
  const groupField = groupItems && groupItems.length > 0 ? groupItems[0].field : (spec.aggregateField || 'form_type')
  let timeBucket = groupItems && groupItems.length > 0 ? groupItems[0].timeBucket : undefined

  // Defensive: if groupField is a date field but timeBucket is missing, default to 'month'
  // This protects against the model forgetting to set timeBucket on trend queries.
  const isDateField = typeof groupField === 'string' && /Date$/i.test(groupField)
  if (!timeBucket && isDateField && spec.chartHint === 'line') {
    timeBucket = 'month'
  }
  const agg = spec.aggregate || 'count'
  const aggField = spec.aggregateField || groupField
  const groups: Record<string, { count: number; sum: number; values: number[] }> = {}
  for (const r of records) {
    let key: string
    if (timeBucket) {
      const raw = r.data[groupField]
      key = typeof raw === 'string' ? bucketDate(raw, timeBucket) : String(raw ?? r.form_type)
    } else {
      key = String(r.data[groupField] ?? r.form_type)
    }
    if (!groups[key]) groups[key] = { count: 0, sum: 0, values: [] }
    groups[key].count += 1
    const val = r.data[aggField]
    if (typeof val === 'number') {
      groups[key].sum += val
      groups[key].values.push(val)
    }
  }
  return Object.entries(groups).map(([key, g]) => {
    let value: number
    if (agg === 'count') value = g.count
    else if (agg === 'sum') value = g.sum
    else if (agg === 'avg') value = g.values.length > 0 ? g.sum / g.values.length : 0
    else value = g.count
    return { key, value }
  })
}

const SEVERITY_RISK_WEIGHT: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 8,
}

function readNumericValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readSeverityWeight(value: unknown): number {
  return typeof value === 'string'
    ? (SEVERITY_RISK_WEIGHT[value.toLowerCase()] ?? 0)
    : 0
}

function groupAndRiskScore(
  records: DecryptedRecord[],
  spec: AiQuerySpec,
): Array<{ key: string; value: number }> {
  const groupItems = spec.groupBy
  const groupField =
    groupItems && groupItems.length > 0 ? groupItems[0].field : 'region'
  const groups: Record<
    string,
    { reportCount: number; severityScore: number; affectedPeople: number }
  > = {}

  for (const record of records) {
    const key = String(record.data[groupField] ?? record.form_type)
    if (!groups[key]) {
      groups[key] = { reportCount: 0, severityScore: 0, affectedPeople: 0 }
    }
    groups[key].reportCount += 1
    groups[key].severityScore += readSeverityWeight(record.data.severityLevel)
    groups[key].affectedPeople += readNumericValue(record.data.numberOfAffected)
  }

  return Object.entries(groups).map(([key, group]) => ({
    key,
    value: Number(
      (
        group.reportCount +
        group.severityScore +
        group.affectedPeople / 100
      ).toFixed(2),
    ),
  }))
}

function getRecordDateValue(record: DecryptedRecord): unknown {
  if (record.form_type === 'incident') {
    return (
      record.data.incidentDate ??
      record.data.reportDate ??
      record.created_at
    )
  }
  return record.data.interviewDate ?? record.created_at
}

function sortRows(
  rows: Record<string, unknown>[],
  field: string,
  direction: 'asc' | 'desc',
): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const aVal = a[field]
    const bVal = b[field]
    if (aVal === bVal) return 0
    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal)
    const bStr = String(bVal)
    return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })
}

export function executeSpec(
  spec: AiQuerySpec,
  records: DecryptedRecord[],
): ExecutorResult {
  let filtered = records.filter((r) =>
    spec.formType === 'both' ? true : r.form_type === spec.formType,
  )

  if (spec.dateRange) {
    const start = new Date(spec.dateRange.start).getTime()
    const end = new Date(spec.dateRange.end).getTime()
    filtered = filtered.filter((r) => {
      const recordDate = getRecordDateValue(r)
      const t = new Date(String(recordDate)).getTime()
      return t >= start && t <= end
    })
  }

  for (const f of spec.filters) {
    filtered = filtered.filter((r) =>
      evaluateFilter(r.data[f.field], f.operator, f.value),
    )
  }

if (spec.intent === 'aggregate' || (spec.groupBy && spec.aggregate)) {
    let groups =
      spec.scoring === 'risk'
        ? groupAndRiskScore(filtered, spec)
        : groupAndAggregate(filtered, spec)
    if (spec.chartHint === 'line') {
      groups = [...groups].sort((a, b) => a.key.localeCompare(b.key))
    } else if (spec.sortBy?.field === 'value') {
      groups = [...groups].sort((a, b) =>
        spec.sortBy?.direction === 'asc' ? a.value - b.value : b.value - a.value,
      )
    }
    if (spec.limit) groups = groups.slice(0, spec.limit)
    return {
      kind: 'aggregate',
      groups,
      chartHint: spec.chartHint,
      title: spec.title,
      summary: spec.summary,
    }
  }

  let rows: Array<Record<string, unknown>> = filtered.map((r) => ({
    record_id: r.record_id,
    created_at: r.created_at,
    ...r.data,
  }))
  if (spec.sortBy) rows = sortRows(rows, spec.sortBy.field, spec.sortBy.direction)
  if (spec.limit) rows = rows.slice(0, spec.limit)
  if (rows.length === 0) return { kind: 'empty', title: spec.title, summary: spec.summary }
  return { kind: 'rows', rows, chartHint: spec.chartHint, title: spec.title, summary: spec.summary }
}
