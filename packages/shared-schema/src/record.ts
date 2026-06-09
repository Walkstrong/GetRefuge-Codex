import { z } from 'zod'

export const recordMetaSchema = z.object({
  recordId: z.string().uuid(),
  formType: z.enum(['incident', 'beneficiary']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  syncStatus: z.enum(['pending', 'synced', 'failed']),
  syncedAt: z.string().datetime().optional(),
  hasPhoto: z.boolean().default(false),
})

export type RecordMeta = z.infer<typeof recordMetaSchema>
