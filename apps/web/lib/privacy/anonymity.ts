import type { SitRepAggregates } from '../sitrepAggregates'

export type AggregatePoint = { key: string; value: number }

export type KAnonymitySummary = {
  enabled: boolean
  threshold: number
  suppressedGroups: number
  suppressedValue: number
}

type ApplyKAnonymityOptions = {
  threshold?: number
  bucketLabel?: string
  bucketSuppressed?: boolean
}

type ApplySitRepKAnonymityOptions = {
  enabled?: boolean
  threshold?: number
}

export const SITREP_K_ANONYMITY_ENABLED = true
export const SITREP_K_ANONYMITY_THRESHOLD = 5
export const SITREP_SUPPRESSED_BUCKET_LABEL = 'Other (suppressed)'

function emptySummary(enabled: boolean, threshold: number): KAnonymitySummary {
  return {
    enabled,
    threshold,
    suppressedGroups: 0,
    suppressedValue: 0,
  }
}

export function applyKAnonymity(
  points: AggregatePoint[],
  options: ApplyKAnonymityOptions = {},
): { points: AggregatePoint[]; summary: KAnonymitySummary } {
  const threshold = options.threshold ?? SITREP_K_ANONYMITY_THRESHOLD
  const bucketLabel = options.bucketLabel ?? SITREP_SUPPRESSED_BUCKET_LABEL
  const bucketSuppressed = options.bucketSuppressed ?? true
  const kept: AggregatePoint[] = []
  let suppressedGroups = 0
  let suppressedValue = 0

  for (const point of points) {
    if (point.value >= threshold) {
      kept.push(point)
    } else {
      suppressedGroups += 1
      suppressedValue += point.value
    }
  }

  const shouldBucket = bucketSuppressed && suppressedGroups > 0 && suppressedValue >= threshold
  return {
    points: shouldBucket
      ? [...kept, { key: bucketLabel, value: suppressedValue }]
      : kept,
    summary: {
      enabled: true,
      threshold,
      suppressedGroups,
      suppressedValue,
    },
  }
}

function combineSummaries(
  current: KAnonymitySummary,
  next: KAnonymitySummary,
): KAnonymitySummary {
  return {
    enabled: current.enabled || next.enabled,
    threshold: current.threshold,
    suppressedGroups: current.suppressedGroups + next.suppressedGroups,
    suppressedValue: current.suppressedValue + next.suppressedValue,
  }
}

export function applySitRepKAnonymity(
  aggregates: SitRepAggregates,
  options: ApplySitRepKAnonymityOptions = {},
): { aggregates: SitRepAggregates; summary: KAnonymitySummary } {
  const enabled = options.enabled ?? SITREP_K_ANONYMITY_ENABLED
  const threshold = options.threshold ?? SITREP_K_ANONYMITY_THRESHOLD
  if (!enabled) {
    return { aggregates, summary: emptySummary(false, threshold) }
  }

  let summary = emptySummary(true, threshold)
  const apply = (points: AggregatePoint[], bucketSuppressed: boolean) => {
    const result = applyKAnonymity(points, {
      threshold,
      bucketSuppressed,
    })
    summary = combineSummaries(summary, result.summary)
    return result.points
  }

  return {
    aggregates: {
      ...aggregates,
      incidentsByRegion: apply(aggregates.incidentsByRegion, true),
      incidentsBySeverity: apply(aggregates.incidentsBySeverity, false),
      incidentsByType: apply(aggregates.incidentsByType, true),
      incidentsByMonth: apply(aggregates.incidentsByMonth, true),
      topProtectionConcerns: apply(aggregates.topProtectionConcerns, false),
      topPrimaryNeeds: apply(aggregates.topPrimaryNeeds, true),
      beneficiariesByAgeRange: apply(aggregates.beneficiariesByAgeRange, false),
      beneficiariesByGender: apply(aggregates.beneficiariesByGender, false),
      regionalPressureScore: apply(aggregates.regionalPressureScore, true),
    },
    summary,
  }
}
