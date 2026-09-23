export type BalancePoint = {
  accountId: string;
  balance: number;
  recordedAt: Date | string;
};

export type SyncAllowance = {
  syncCallsDate: string | null;
  syncCallsToday: number;
};

export function syncCallsRemaining(
  account: SyncAllowance,
  today = new Date().toISOString().slice(0, 10),
) {
  return account.syncCallsDate === today
    ? Math.max(0, 4 - account.syncCallsToday)
    : 4;
}

export function aggregateBalanceHistory(history: BalancePoint[]) {
  const totals = new Map<string, number>();
  for (const row of history) {
    const date = new Date(row.recordedAt).toISOString().slice(0, 10);
    totals.set(date, (totals.get(date) ?? 0) + row.balance);
  }
  return [...totals]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function makeMonthKeys(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - count + index + 1,
      1,
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function monthEndBalance(
  history: BalancePoint[],
  accountId: string,
  month: string,
) {
  const end = `${month}-31`;
  const rows = history
    .filter(
      (row) =>
        row.accountId === accountId &&
        new Date(row.recordedAt).toISOString().slice(0, 10) <= end,
    )
    .sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt));
  return rows.at(-1)?.balance ?? null;
}
