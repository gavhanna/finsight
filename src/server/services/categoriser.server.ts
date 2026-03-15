import { db } from "../../db/index.server"
import { categories, categoryRules } from "../../db/schema"
import type { Category, CategoryRule } from "../../db/schema"
import { MCC_CATEGORY_MAP } from "../../lib/constants"
import { categoriseWithOllama } from "./ollama.server"

interface TransactionData {
  description?: string | null
  creditorName?: string | null
  debtorName?: string | null
  merchantCategoryCode?: string | null
  amount: number
}

interface CategoriseResult {
  categoryId: number | null
  categorisedBy: "rule" | "mcc" | "llm" | null
}

// In-memory cache
let rulesCache: (CategoryRule & { categoryName: string })[] | null = null
let categoriesCache: Category[] | null = null

export function invalidateCategoryCache() {
  rulesCache = null
  categoriesCache = null
}

async function getRules() {
  if (rulesCache) return rulesCache
  const allCategories = await getCategories()
  const rules = await db.select().from(categoryRules).orderBy(categoryRules.priority)
  rulesCache = rules
    .map((r) => ({
      ...r,
      categoryName:
        allCategories.find((c) => c.id === r.categoryId)?.name ?? "",
    }))
    .reverse() // highest priority first
  return rulesCache
}

async function getCategories() {
  if (categoriesCache) return categoriesCache
  categoriesCache = await db.select().from(categories)
  return categoriesCache
}

function matchesRule(
  rule: CategoryRule,
  tx: TransactionData,
): boolean {
  const fieldValue = getField(rule.field, tx)
  if (!fieldValue) return false

  switch (rule.matchType) {
    case "contains":
      return fieldValue.toLowerCase().includes(rule.pattern.toLowerCase())
    case "exact":
      return fieldValue.toLowerCase() === rule.pattern.toLowerCase()
    case "startsWith":
      return fieldValue.toLowerCase().startsWith(rule.pattern.toLowerCase())
    default:
      return false
  }
}

function getField(
  field: CategoryRule["field"],
  tx: TransactionData,
): string | null {
  switch (field) {
    case "description":
      return tx.description ?? null
    case "creditorName":
      return tx.creditorName ?? null
    case "debtorName":
      return tx.debtorName ?? null
    case "merchantCategoryCode":
      return tx.merchantCategoryCode ?? null
    default:
      return null
  }
}

export async function categorise(
  tx: TransactionData,
  ollamaUrl?: string,
): Promise<CategoriseResult> {
  const allCategories = await getCategories()
  const rules = await getRules()

  // 1. Keyword rules (highest priority first)
  for (const rule of rules) {
    if (matchesRule(rule, tx)) {
      const cat = allCategories.find((c) => c.id === rule.categoryId)
      if (cat) {
        return { categoryId: cat.id, categorisedBy: "rule" }
      }
    }
  }

  // 2. MCC code mapping
  if (tx.merchantCategoryCode) {
    const catName = MCC_CATEGORY_MAP[tx.merchantCategoryCode]
    if (catName) {
      const cat = allCategories.find((c) => c.name === catName)
      if (cat) {
        return { categoryId: cat.id, categorisedBy: "mcc" }
      }
    }
  }

  // 3. Ollama LLM fallback
  if (ollamaUrl) {
    const catName = await categoriseWithOllama(tx, allCategories, ollamaUrl)
    if (catName) {
      const cat = allCategories.find((c) => c.name === catName)
      if (cat) {
        return { categoryId: cat.id, categorisedBy: "llm" }
      }
    }
  }

  return { categoryId: null, categorisedBy: null }
}
