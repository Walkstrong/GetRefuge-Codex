import {
  ZodEnum,
  ZodArray,
  ZodNumber,
  ZodString,
  ZodBoolean,
  ZodDefault,
  ZodOptional,
  ZodNullable,
  type ZodObject,
  type ZodTypeAny,
} from 'zod'
import { incidentSchema, beneficiarySchema } from '@getrefuge/shared-schema'

type ZodInnerDef = ZodTypeAny & { _def: { innerType: ZodTypeAny } }
type ZodStringDef = ZodString & { _def: { checks?: Array<{ kind: string }> } }
type ZodArrayDef = ZodArray<ZodTypeAny> & { _def: { type: ZodTypeAny } }

export type FieldInfo = {
  name: string
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'enum' | 'enum_array'
  enumValues?: string[]
  description?: string
}

export type EnrichedSchema = {
  incident: FieldInfo[]
  beneficiary: FieldInfo[]
}

const FIELD_DESCRIPTIONS: Record<'incident' | 'beneficiary', Record<string, string>> = {
  incident: {
    reporterName: 'staff member who submitted the report',
    reporterRole: 'field role of the person submitting the report',
    reportDate: 'date the report was created',
    region: 'administrative area or governorate',
    location: 'specific place name or locality',
    incidentDate: 'date the incident happened',
    incidentType: 'category of incident reported',
    incidentTypeOther: 'free-text incident category when other is selected',
    severityLevel: 'reported severity level',
    description: 'narrative incident description',
    numberOfAffected: 'estimated number of people affected',
    actionTaken: 'action already taken by the field team',
    referralMade: 'whether a referral was made',
    referralDetails: 'details of any referral',
    followUpRequired: 'whether follow-up is required',
    additionalNotes: 'additional operational notes',
  },
  beneficiary: {
    interviewerName: 'staff member who completed the interview',
    interviewDate: 'date the interview happened',
    region: 'administrative area or governorate',
    beneficiaryCode: 'non-name beneficiary reference code',
    ageRange: 'age range of the beneficiary',
    gender: 'reported gender category',
    householdSize: 'number of people in the household',
    primaryNeeds: 'main needs selected during the interview',
    currentSituation: 'summary of the beneficiary situation',
    servicesReceived: 'services already received',
    satisfactionLevel: 'reported satisfaction level',
    protectionConcerns: 'whether protection concerns were reported',
    protectionDetails: 'details of protection concerns',
    additionalNotes: 'additional operational notes',
  },
}

/** Strip ZodOptional / ZodNullable / ZodDefault wrappers to get the inner type. */
function unwrap(t: ZodTypeAny): ZodTypeAny {
  let cur: ZodTypeAny = t
  while (
    cur instanceof ZodOptional ||
    cur instanceof ZodNullable ||
    cur instanceof ZodDefault
  ) {
    // _def.innerType for Optional/Nullable/Default
    cur = (cur as ZodInnerDef)._def.innerType
  }
  return cur
}

/** Classify a Zod field into our FieldInfo type taxonomy. */
function classify(
  fieldName: string,
  zodType: ZodTypeAny,
): { type: FieldInfo['type']; enumValues?: string[] } {
  const inner = unwrap(zodType)

  // datetime detection — Zod marks z.string().datetime() with a check
  if (inner instanceof ZodString) {
    const checks = (inner as ZodStringDef)._def.checks ?? []
    const isDatetime = checks.some((c) => c.kind === 'datetime')
    return { type: isDatetime ? 'datetime' : 'string' }
  }
  if (inner instanceof ZodNumber) return { type: 'number' }
  if (inner instanceof ZodBoolean) return { type: 'boolean' }
  if (inner instanceof ZodEnum) {
    return { type: 'enum', enumValues: [...inner.options] }
  }
  if (inner instanceof ZodArray) {
    const elem = unwrap((inner as ZodArrayDef)._def.type)
    if (elem instanceof ZodEnum) {
      return { type: 'enum_array', enumValues: [...elem.options] }
    }
    // plain string array — treat as string for prompt purposes
    return { type: 'string' }
  }
  // fallback for any unknown shape (z.union, z.record, etc.)
  return { type: 'string' }
}

/** Walk a ZodObject schema and produce safe field metadata only. */
export function buildFieldInfo(
  schema: ZodObject<Record<string, ZodTypeAny>>,
  formType: 'incident' | 'beneficiary',
): FieldInfo[] {
  const fields: FieldInfo[] = []
  const shape = schema.shape as Record<string, ZodTypeAny>

  for (const [name, zodType] of Object.entries(shape)) {
    const { type, enumValues } = classify(name, zodType)
    const info: FieldInfo = { name, type }
    if (enumValues) info.enumValues = enumValues
    const description = FIELD_DESCRIPTIONS[formType][name]
    if (description) info.description = description
    fields.push(info)
  }
  return fields
}

export function buildEnrichedSchema(): EnrichedSchema {
  return {
    incident: buildFieldInfo(incidentSchema, 'incident'),
    beneficiary: buildFieldInfo(beneficiarySchema, 'beneficiary'),
  }
}
