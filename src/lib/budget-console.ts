export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function projectEnvelope<
  T extends { planned: number; spent: number; note?: string | null },
>(row: T, elapsedRatio: number) {
  const settled =
    row.spent > 0 &&
    (Math.abs(row.spent - row.planned) < 0.01 ||
      Boolean(row.note?.toLowerCase().includes("fixed")));
  const landing = settled
    ? row.spent
    : row.spent / Math.max(elapsedRatio, 0.01);
  return { ...row, settled, landing, miss: landing - row.planned };
}

export function budgetHistoryVerdict(values: number[]) {
  const overCount = values.filter((value) => value > 20).length;
  if (overCount >= Math.max(3, values.length - 1))
    return "Set too low" as const;
  if (values.some((value) => value > 20) && values.some((value) => value < -20))
    return "Variable" as const;
  return "Well set" as const;
}
