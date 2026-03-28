import type { Category, Rule, RulePattern } from "@/db/schema"

export type RuleWithMeta = Rule & { category: Category | null; patterns: RulePattern[] }

export type PreviewTx = {
  id: string; bookingDate: string; amount: number; currency: string
  creditorName: string | null; debtorName: string | null; description: string | null
  categoryId: number | null; categorisedBy: string | null; category: Category | null
}

export type PatternDraft = {
  id?: number; pattern: string
  field: RulePattern["field"]; matchType: RulePattern["matchType"]; _deleted?: boolean
}

export const FIELDS = [
  { value: "description", label: "Description" },
  { value: "creditorName", label: "Creditor name" },
  { value: "debtorName", label: "Debtor name" },
  { value: "merchantCategoryCode", label: "MCC" },
] as const

export const MATCH_TYPES = [
  { value: "contains", label: "contains" },
  { value: "exact", label: "exact" },
  { value: "startsWith", label: "starts with" },
] as const

export function fieldLabel(v: string) { return FIELDS.find(f => f.value === v)?.label ?? v }
export function matchLabel(v: string) { return MATCH_TYPES.find(m => m.value === v)?.label ?? v }
