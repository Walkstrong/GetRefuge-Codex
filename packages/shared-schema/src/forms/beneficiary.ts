import { z } from 'zod'

export const beneficiarySchema = z.object({
  interviewerName: z.string().min(1).max(200),
  interviewDate: z.string().datetime(),
  region: z.string().min(1).max(200),

  beneficiaryCode: z.string().min(1).max(50),
  ageRange: z.enum(['0-5', '6-12', '13-17', '18-25', '26-40', '41-60', '60+']),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  householdSize: z.number().int().min(1).max(50).optional(),

  primaryNeeds: z
    .array(
      z.enum([
        'food',
        'water',
        'shelter',
        'medical',
        'psychosocial',
        'education',
        'legal',
        'livelihood',
        'protection',
        'other',
      ])
    )
    .min(1),
  primaryNeedsOther: z.string().max(200).optional(),

  // TODO: original spec ambiguous due to redaction; assumed required string
  currentSituation: z.string().max(5000),
  servicesReceived: z.string().max(2000).optional(),
  satisfactionLevel: z
    .enum([
      'very_dissatisfied',
      'dissatisfied',
      'neutral',
      'satisfied',
      'very_satisfied',
    ])
    .optional(),

  protectionConcerns: z.boolean().default(false),
  protectionDetails: z.string().max(2000).optional(),

  additionalNotes: z.string().max(3000).optional(),
})

export type BeneficiaryInterview = z.infer<typeof beneficiarySchema>
