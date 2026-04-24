import type { ChatContext, ChatPageKind } from "@/lib/ai-chat.types"

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const next = Number(value)
    if (Number.isFinite(next)) return next
  }
  return undefined
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  }
  if (typeof value === "string" && value.trim()) return [value]
  return undefined
}

function decodePathSegment(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return undefined
  const rest = pathname.slice(prefix.length)
  if (!rest) return undefined
  return decodeURIComponent(rest.split("/")[0] ?? "")
}

function getPageKind(pathname: string): ChatPageKind {
  if (pathname === "/") return "dashboard"
  if (pathname === "/transactions" || pathname.startsWith("/transactions/")) return "transactions"
  if (pathname === "/budgets") return "budgets"
  if (pathname === "/recurring") return "recurring"
  if (pathname === "/category-trends") return "category-trends"
  if (pathname === "/comparison") return "monthly-comparison"
  if (pathname.startsWith("/merchants/")) return "merchant-detail"
  return "unknown"
}

function getPageTitle(kind: ChatPageKind) {
  switch (kind) {
    case "dashboard":
      return "Dashboard"
    case "transactions":
      return "Transactions"
    case "budgets":
      return "Budgets"
    case "recurring":
      return "Recurring"
    case "merchant-detail":
      return "Merchant Detail"
    case "category-trends":
      return "Category Trends"
    case "monthly-comparison":
      return "Comparison"
    case "unknown":
      return "Current Page"
  }
}

export function deriveChatContext(pathname: string, search: Record<string, unknown> | undefined): ChatContext {
  const kind = getPageKind(pathname)
  const merchantName = kind === "merchant-detail" ? decodePathSegment(pathname, "/merchants/") : undefined

  return {
    page: {
      kind,
      title: getPageTitle(kind),
      path: pathname,
      entityLabel: merchantName,
    },
    filters: {
      dateFrom: asString(search?.["dateFrom"]),
      dateTo: asString(search?.["dateTo"]),
      preset: asString(search?.["preset"]),
      search: asString(search?.["search"]),
      categoryId: asNumber(search?.["categoryId"]) ?? null,
      accountIds: asStringArray(search?.["accountIds"]),
    },
  }
}

