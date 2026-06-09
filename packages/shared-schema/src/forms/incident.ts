import { z } from 'zod'

export const incidentSchema = z.object({
  reporterName: z.string().min(1).max(200),
  reporterRole: z.string().optional(),
  reportDate: z.string().datetime(),
  region: z.string().min(1).max(200),
  location: z.string().max(500).optional(),

  incidentDate: z.string().datetime(),
  incidentType: z.enum([
    'harassment',
    'detention',
    'property_damage',
    'threat',
    'violence',
    'displacement',
    'restriction_of_movement',
    'other',
  ]),
  incidentTypeOther: z.string().max(200).optional(),
  severityLevel: z.enum(['low', 'medium', 'high', 'critical']),

  description: z.string().min(1).max(5000),
  numberOfAffected: z.number().int().min(0).optional(),

  actionTaken: z.string().max(2000).optional(),
  referralMade: z.boolean().default(false),
  referralDetails: z.string().max(1000).optional(),
  followUpRequired: z.boolean().default(false),

  additionalNotes: z.string().max(3000).optional(),
})

export type IncidentReport = z.infer<typeof incidentSchema>
