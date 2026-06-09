import { z } from 'zod'

export const GroupByItemSchema = z.object({
  field: z.string().max(80),
  timeBucket: z.enum(['day', 'week', 'month']).optional(),
})

export const AiQuerySpecSchema = z.object({
  intent: z.enum(['filter', 'aggregate', 'rank', 'summarize']),
  formType: z.enum(['incident', 'beneficiary', 'both']),
  filters: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        operator: z.enum([
          'eq',
          'neq',
          'gt',
          'lt',
          'gte',
          'lte',
          'contains',
          'contains_any',
          'in',
        ]),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string()),
          z.array(z.number()),
        ]),
      }),
    )
    .default([]),
  groupBy: z.preprocess(
    (val) => (typeof val === 'string' ? [{ field: val }] : val),
    z.array(GroupByItemSchema).nullable().default(null),
  ),
  aggregate: z.enum(['count', 'sum', 'avg']).nullable().default(null),
  aggregateField: z.string().max(80).nullable().default(null),
  scoring: z.enum(['risk']).nullable().optional(),
  sortBy: z
    .object({
      field: z.string().max(80),
      direction: z.enum(['asc', 'desc']),
    })
    .nullable()
    .default(null),
  limit: z.number().int().min(1).max(500).nullable().default(null),
  chartHint: z.enum(['bar', 'line', 'pie', 'table']).default('table'),
  title: z.string().max(140).default(''),
  dateRange: z
    .object({
      start: z.string(),
      end: z.string(),
    })
    .nullable()
    .default(null),
  summary: z.string().max(500).optional(),
})

export type AiQuerySpec = z.infer<typeof AiQuerySpecSchema>
export type GroupByItem = z.infer<typeof GroupByItemSchema>
