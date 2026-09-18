import { z } from "zod"

export const chatPageKindSchema = z.enum([
  "dashboard",
  "transactions",
  "budgets",
  "recurring",
  "merchant-detail",
  "category-trends",
  "monthly-comparison",
  "unknown",
])

export type ChatPageKind = z.infer<typeof chatPageKindSchema>

export const chatScopeSchema = z.enum(["page", "global"])

export type ChatScope = z.infer<typeof chatScopeSchema>

export const chatContextSchema = z.object({
  page: z.object({
    kind: chatPageKindSchema,
    title: z.string(),
    path: z.string(),
    entityLabel: z.string().optional(),
  }),
  filters: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    preset: z.string().optional(),
    search: z.string().optional(),
    categoryId: z.number().nullable().optional(),
    accountIds: z.array(z.string()).optional(),
  }),
})

export type ChatContext = z.infer<typeof chatContextSchema>

export const financeToolResultSchema = z.object({
  summary: z.string(),
  data: z.any(),
})

export const chatNavigationActionSchema = z.object({
  kind: z.literal("navigation"),
  label: z.string(),
  description: z.string().optional(),
  to: z.string(),
  params: z.record(z.string(), z.string()).optional(),
  search: z.record(z.string(), z.any()).optional(),
})

export type ChatNavigationAction = z.infer<typeof chatNavigationActionSchema>
