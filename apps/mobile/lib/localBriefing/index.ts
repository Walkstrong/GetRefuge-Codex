import type { BeneficiaryInterview, IncidentReport } from '@getrefuge/shared-schema'
import { database } from '../../database'
import type LocalBriefingFact from '../../model/LocalBriefingFact'
import { localAiInfer } from '../localAi'
import type { LocalAiSeverity } from '../localAi'
import { v4 as uuidv4 } from 'uuid'

type FormType = 'incident' | 'beneficiary'
type NeedCategory =
  | 'food'
  | 'water'
  | 'shelter'
  | 'medical'
  | 'psychosocial'
  | 'education'
  | 'legal'
  | 'livelihood'
  | 'protection'
  | 'displacement'

interface LocalBriefingFactDraft {
  recordId: string
  formType: FormType
  severityBucket: LocalAiSeverity
  needCategories: NeedCategory[]
  hasChildren: boolean
  hasProtectionConcern: boolean
  affectedCount?: number
  createdAt: number
}

interface LocalBriefingSummary {
  reportCount: number
  categoryCounts: Map<NeedCategory, number>
  childRelatedCount: number
  protectionConcernCount: number
  highPriorityCount: number
  totalAffectedCount: number
  latestCreatedAt: number | null
}

export interface LocalBriefingResult {
  title: 'Local briefing'
  evidenceText: string
  freshnessText: string
  needsText: string
  uncertaintyText: string
  suggestedNextStep: string
  generatedAt: string
}

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000

const NEED_LABELS: Record<NeedCategory, string> = {
  food: 'food',
  water: 'clean water',
  shelter: 'shelter',
  medical: 'medical support',
  psychosocial: 'psychosocial support',
  education: 'education',
  legal: 'legal help',
  livelihood: 'livelihood support',
  protection: 'protection',
  displacement: 'displacement',
}

const NEED_KEYWORDS: Record<NeedCategory, string[]> = {
  food: ['food', 'meal', 'nutrition', 'hungry', 'ration'],
  water: ['water', 'clean water', 'drinking', 'sanitation', 'hygiene'],
  shelter: ['shelter', 'tent', 'housing', 'roof', 'home', 'damage', 'damaged'],
  medical: ['medical', 'medicine', 'clinic', 'injury', 'injured', 'sick', 'health'],
  psychosocial: ['psychosocial', 'trauma', 'counsel', 'distress', 'mental'],
  education: ['school', 'education', 'class', 'teacher'],
  legal: ['legal', 'documentation', 'document', 'detention', 'permit'],
  livelihood: ['livelihood', 'work', 'income', 'job'],
  protection: ['protection', 'threat', 'violence', 'harassment', 'minor', 'child', 'children', 'exploitation'],
  displacement: ['displacement', 'displaced', 'evacuated', 'eviction', 'relocated'],
}

export async function saveIncidentLocalBriefingFact(input: {
  recordId: string
  data: IncidentReport
  createdAt: number
}): Promise<void> {
  await saveLocalBriefingFact(buildIncidentFact(input.recordId, input.data, input.createdAt))
}

export async function saveBeneficiaryLocalBriefingFact(input: {
  recordId: string
  data: BeneficiaryInterview
  createdAt: number
}): Promise<void> {
  await saveLocalBriefingFact(buildBeneficiaryFact(input.recordId, input.data, input.createdAt))
}

export async function generateLocalBriefing(): Promise<LocalBriefingResult> {
  const facts = await fetchRecentFacts()
  const summary = summarizeFacts(facts)
  const baseResult = buildResult(summary, null)

  if (summary.reportCount === 0) {
    return baseResult
  }

  try {
    const aiResult = await localAiInfer({ text: buildLocalAiPrompt(summary) })
    return buildResult(summary, aiResult.analysis.suggestedFollowUp)
  } catch (error) {
    console.warn('[local-briefing] local AI briefing failed; using aggregate summary only:', error)
    return baseResult
  }
}

function buildIncidentFact(recordId: string, data: IncidentReport, createdAt: number): LocalBriefingFactDraft {
  const textForCategories = [
    data.incidentType,
    data.incidentTypeOther,
    data.description,
    data.actionTaken,
    data.referralDetails,
    data.additionalNotes,
  ].join(' ')
  const categories = inferNeedCategories(textForCategories)

  if (data.incidentType === 'property_damage') {
    categories.push('shelter')
  }
  if (data.incidentType === 'displacement') {
    categories.push('displacement', 'shelter', 'protection')
  }
  if (['harassment', 'detention', 'threat', 'violence', 'restriction_of_movement'].includes(data.incidentType)) {
    categories.push('protection')
  }

  return {
    recordId,
    formType: 'incident',
    severityBucket: data.severityLevel,
    needCategories: uniqueCategories(categories),
    hasChildren: containsAny(textForCategories, ['child', 'children', 'minor', 'minors', 'youth']),
    hasProtectionConcern:
      data.followUpRequired ||
      data.referralMade ||
      containsAny(textForCategories, NEED_KEYWORDS.protection),
    affectedCount: data.numberOfAffected,
    createdAt,
  }
}

function buildBeneficiaryFact(
  recordId: string,
  data: BeneficiaryInterview,
  createdAt: number
): LocalBriefingFactDraft {
  const primaryNeeds = data.primaryNeeds.reduce<NeedCategory[]>((needs, need) => {
    if (isNeedCategory(need)) {
      needs.push(need)
    }
    return needs
  }, [])
  const hasChildren = ['0-5', '6-12', '13-17'].includes(data.ageRange)
  const hasProtectionConcern = data.protectionConcerns || primaryNeeds.includes('protection') || primaryNeeds.includes('legal')

  return {
    recordId,
    formType: 'beneficiary',
    severityBucket: inferBeneficiarySeverity(primaryNeeds, hasChildren, hasProtectionConcern),
    needCategories: uniqueCategories(primaryNeeds),
    hasChildren,
    hasProtectionConcern,
    affectedCount: data.householdSize,
    createdAt,
  }
}

async function saveLocalBriefingFact(draft: LocalBriefingFactDraft): Promise<void> {
  await database.write(async () => {
    const facts = database.collections.get('local_briefing_facts')
    await facts.create((fact) => {
      const row = fact as LocalBriefingFact
      row.fact_id = uuidv4()
      row.record_id = draft.recordId
      row.form_type = draft.formType
      row.severity_bucket = draft.severityBucket
      row.need_categories = JSON.stringify(draft.needCategories)
      row.has_children = draft.hasChildren
      row.has_protection_concern = draft.hasProtectionConcern
      row.affected_count = draft.affectedCount
      row.created_at = draft.createdAt
    })
  })
}

async function fetchRecentFacts(): Promise<LocalBriefingFact[]> {
  const cutoff = Date.now() - RECENT_WINDOW_MS
  const facts = database.collections.get('local_briefing_facts')
  const rows = (await facts.query().fetch()) as LocalBriefingFact[]
  return rows.filter((fact) => fact.created_at >= cutoff)
}

function summarizeFacts(facts: LocalBriefingFact[]): LocalBriefingSummary {
  const categoryCounts = new Map<NeedCategory, number>()
  let childRelatedCount = 0
  let protectionConcernCount = 0
  let highPriorityCount = 0
  let totalAffectedCount = 0
  let latestCreatedAt: number | null = null

  for (const fact of facts) {
    for (const category of parseNeedCategories(fact.need_categories)) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    }
    if (fact.has_children) childRelatedCount += 1
    if (fact.has_protection_concern) protectionConcernCount += 1
    if (fact.severity_bucket === 'high' || fact.severity_bucket === 'critical') highPriorityCount += 1
    if (typeof fact.affected_count === 'number') totalAffectedCount += fact.affected_count
    latestCreatedAt = Math.max(latestCreatedAt ?? 0, fact.created_at)
  }

  return {
    reportCount: facts.length,
    categoryCounts,
    childRelatedCount,
    protectionConcernCount,
    highPriorityCount,
    totalAffectedCount,
    latestCreatedAt,
  }
}

function buildResult(summary: LocalBriefingSummary, localAiSuggestedNextStep: string | null): LocalBriefingResult {
  return {
    title: 'Local briefing',
    evidenceText: buildEvidenceText(summary),
    freshnessText: buildFreshnessText(summary.latestCreatedAt),
    needsText: buildNeedsText(summary),
    uncertaintyText: buildUncertaintyText(summary.reportCount),
    suggestedNextStep: localAiSuggestedNextStep ?? buildSuggestedNextStep(summary),
    generatedAt: new Date().toISOString(),
  }
}

function buildEvidenceText(summary: LocalBriefingSummary): string {
  if (summary.reportCount === 0) {
    return 'No reports from the last 24 hours are stored on this device.'
  }

  const affectedText =
    summary.totalAffectedCount > 0 ? `, covering ${summary.totalAffectedCount} people or household members` : ''
  return `Based on ${summary.reportCount} report${summary.reportCount === 1 ? '' : 's'} from this device${affectedText}.`
}

function buildFreshnessText(latestCreatedAt: number | null): string {
  if (!latestCreatedAt) {
    return 'Last updated: no recent local records.'
  }
  return `Last updated: ${formatAge(Date.now() - latestCreatedAt)} ago.`
}

function buildNeedsText(summary: LocalBriefingSummary): string {
  if (summary.reportCount === 0) {
    return 'Needs seen: not enough local data yet.'
  }

  const topCategories = [...summary.categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([category, count]) => `${NEED_LABELS[category]} (${count})`)

  const signals = [
    ...topCategories,
    summary.childRelatedCount > 0 ? `children mentioned (${summary.childRelatedCount})` : null,
    summary.protectionConcernCount > 0 ? `protection concerns (${summary.protectionConcernCount})` : null,
    summary.highPriorityCount > 0 ? `high-priority reports (${summary.highPriorityCount})` : null,
  ].filter((value): value is string => value !== null)

  return signals.length > 0 ? `Needs seen: ${signals.join(', ')}.` : 'Needs seen: no repeated category yet.'
}

function buildUncertaintyText(reportCount: number): string {
  if (reportCount === 0) {
    return 'Not enough local data to identify a pattern.'
  }
  if (reportCount < 3) {
    return `Limited sample: only ${reportCount} recent report${reportCount === 1 ? '' : 's'} on this device.`
  }
  return 'Data limitation: only records on this device are included.'
}

function buildSuggestedNextStep(summary: LocalBriefingSummary): string {
  if (summary.reportCount === 0) {
    return 'Save a report first, then check this briefing again.'
  }
  if (summary.protectionConcernCount > 0 || summary.highPriorityCount > 0) {
    return 'Review the latest high-priority or protection-related report with a supervisor when safe.'
  }

  const topCategory = [...summary.categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]
  if (topCategory) {
    return `Check whether ${NEED_LABELS[topCategory]} support is still available before the next field visit.`
  }
  return 'Continue collecting reports and compare this briefing after more local records are saved.'
}

function buildLocalAiPrompt(summary: LocalBriefingSummary): string {
  return [
    'Create a short advisory local briefing from aggregate local context only.',
    'Do not invent facts. Keep the worker in control. Mention uncertainty when the sample is small.',
    buildEvidenceText(summary),
    buildFreshnessText(summary.latestCreatedAt),
    buildNeedsText(summary),
    buildUncertaintyText(summary.reportCount),
    'Return a suggested next step that is practical, cautious, and does not say the worker must act.',
  ].join('\n')
}

function inferNeedCategories(text: string): NeedCategory[] {
  return Object.entries(NEED_KEYWORDS).flatMap(([category, keywords]) =>
    containsAny(text, keywords) ? [category as NeedCategory] : []
  )
}

function inferBeneficiarySeverity(
  needs: NeedCategory[],
  hasChildren: boolean,
  hasProtectionConcern: boolean
): LocalAiSeverity {
  if (hasProtectionConcern) return 'high'
  if (hasChildren && (needs.includes('medical') || needs.includes('shelter') || needs.includes('water'))) return 'high'
  if (needs.some((need) => ['food', 'water', 'shelter', 'medical'].includes(need))) return 'medium'
  return 'low'
}

function containsAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

function uniqueCategories(categories: NeedCategory[]): NeedCategory[] {
  return [...new Set(categories)]
}

function isNeedCategory(value: string): value is NeedCategory {
  return value in NEED_LABELS
}

function parseNeedCategories(value: string): NeedCategory[] {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is NeedCategory => typeof item === 'string' && isNeedCategory(item))
    }
  } catch {
    return []
  }
  return []
}

function formatAge(ageMs: number): string {
  const minutes = Math.max(1, Math.round(ageMs / 60000))
  if (minutes < 60) return `${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
