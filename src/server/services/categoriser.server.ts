import { db } from "../../db/index.server"
import { categories, rules, rulePatterns } from "../../db/schema"
import type { Category, Rule, RulePattern } from "../../db/schema"
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

type RuleWithPatterns = Rule & { patterns: RulePattern[] }

// In-memory cache
let rulesCache: RuleWithPatterns[] | null = null
let categoriesCache: Category[] | null = null

export function invalidateCategoryCache() {
  rulesCache = null
  categoriesCache = null
}

async function getRules(): Promise<RuleWithPatterns[]> {
  if (rulesCache) return rulesCache
  const allRules = await db.select().from(rules).orderBy(rules.priority)
  const patterns = await db.select().from(rulePatterns)
  rulesCache = allRules
    .map((r) => ({ ...r, patterns: patterns.filter((p) => p.ruleId === r.id) }))
    .reverse() // highest priority first
  return rulesCache
}

async function getCategories() {
  if (categoriesCache) return categoriesCache
  categoriesCache = await db.select().from(categories)
  return categoriesCache
}

function matchesField(
  pattern: RulePattern,
  tx: TransactionData,
): boolean {
  const val = {
    description: tx.description,
    creditorName: tx.creditorName,
    debtorName: tx.debtorName,
    merchantCategoryCode: tx.merchantCategoryCode,
  }[pattern.field]
  if (!val) return false
  const v = val.toLowerCase()
  const p = pattern.pattern.toLowerCase()
  switch (pattern.matchType) {
    case "contains": return v.includes(p)
    case "exact": return v === p
    case "startsWith": return v.startsWith(p)
    default: return false
  }
}

export async function categorise(
  tx: TransactionData,
  ollamaUrl?: string,
  ollamaModel?: string,
): Promise<CategoriseResult> {
  const allCategories = await getCategories()
  const allRules = await getRules()

  // 1. Keyword rules — a rule matches if ANY of its patterns match
  for (const rule of allRules) {
    if (rule.patterns.some((p) => matchesField(p, tx))) {
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
    const catName = await categoriseWithOllama(tx, allCategories, ollamaUrl, ollamaModel)
    if (catName) {
      const cat = allCategories.find((c) => c.name === catName)
      if (cat) {
        return { categoryId: cat.id, categorisedBy: "llm" }
      }
    }
  }

  return { categoryId: null, categorisedBy: null }
}
