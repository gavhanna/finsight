import { useState, useMemo } from "react"

export type SortDir = "asc" | "desc"

export function useSortable<T>(
  data: T[],
  initialKey: keyof T | null = null,
  initialDir: SortDir = "asc",
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(initialKey)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  function toggle(key: keyof T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp = 0
      if (av == null && bv == null) cmp = 0
      else if (av == null) cmp = 1
      else if (bv == null) cmp = -1
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggle }
}
