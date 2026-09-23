import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, Check, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cn,
  formatCurrency,
  formatYearMonthLong,
  stepMonth,
} from "@/lib/utils";
import {
  budgetHistoryVerdict,
  median,
  projectEnvelope,
} from "@/lib/budget-console";
import { ManageTab } from "@/components/budgets/manage-tab";
import {
  setMonthOverride,
  type BudgetRow,
  type BudgetVsActual,
} from "@/server/fn/budgets";

type History = BudgetVsActual[];
type Category = {
  id: number;
  name: string;
  color: string;
  groupId: number | null;
};
type Group = { id: number; name: string; color: string };
type Envelope = {
  budgetId: number;
  name: string;
  color: string;
  planned: number;
  spent: number;
  note?: string | null;
};

function envelopes(data: BudgetVsActual, allBudgets: BudgetRow[]): Envelope[] {
  const notes = new Map(allBudgets.map((row) => [row.id, row.note]));
  return [
    ...data.categoryBudgets.map((row) => ({
      budgetId: row.budgetId,
      name: row.categoryName,
      color: row.categoryColor,
      planned: row.budgeted,
      spent: row.spent,
      note: notes.get(row.budgetId),
    })),
    ...data.groupBudgets.map((row) => ({
      budgetId: row.budgetId,
      name: row.groupName,
      color: row.groupColor,
      planned: row.budgeted,
      spent: row.spent,
      note: notes.get(row.budgetId),
    })),
  ];
}

function monthShort(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
  });
}

export function CurrentBudgetView({
  data,
  allBudgets,
  currency,
  month,
}: {
  data: BudgetVsActual;
  allBudgets: BudgetRow[];
  currency: string;
  month: string;
}) {
  const rows = envelopes(data, allBudgets);
  const now = new Date();
  const selected = new Date(`${month}-01T12:00:00`);
  const days = new Date(
    selected.getFullYear(),
    selected.getMonth() + 1,
    0,
  ).getDate();
  const elapsed =
    month === now.toISOString().slice(0, 7) ? Math.max(1, now.getDate()) : days;
  const elapsedRatio = elapsed / days;
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const spent = rows.reduce((sum, row) => sum + row.spent, 0);
  const left = planned - spent;
  const projected = rows.map((row) => projectEnvelope(row, elapsedRatio));
  const warnings = projected
    .filter((row) => row.miss > 100)
    .sort((a, b) => b.miss - a.miss);
  const pace = Math.max(0, left / Math.max(1, days - elapsed));

  if (!rows.length) return <EmptyBudgets />;

  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        {warnings.length ? (
          <>
            <span className="text-warning">{warnings[0].name}</span> is heading
            over by about <Money value={warnings[0].miss} currency={currency} />
            .{" "}
          </>
        ) : (
          <>Every envelope is currently projected to land inside plan. </>
        )}
        You have <Money value={Math.max(0, left)} currency={currency} /> left
        for the final {Math.max(0, days - elapsed)} days.
      </p>

      <div className="grid gap-3.5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="section-label">Left to spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="font-mono text-4xl font-semibold">
                {formatCurrency(left, currency)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                of {formatCurrency(planned, currency)} planned · pace allows{" "}
                {formatCurrency(pace, currency)} a day
              </p>
            </div>
            <div className="relative h-2 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  spent > planned ? "bg-negative" : "bg-primary",
                )}
                style={{
                  width: `${Math.min(100, planned ? (spent / planned) * 100 : 0)}%`,
                }}
              />
              <span
                className="absolute -inset-y-1 w-px bg-foreground"
                style={{ left: `${Math.min(100, elapsedRatio * 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 divide-x divide-border rounded-lg border p-3 text-xs">
              <Metric
                label="Planned"
                value={formatCurrency(planned, currency)}
              />
              <Metric label="Spent" value={formatCurrency(spent, currency)} />
              <Metric label="Left" value={formatCurrency(left, currency)} />
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="section-label">
              Needs a decision ·{" "}
              {warnings.length + (data.unbudgeted.length ? 1 : 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.slice(0, 2).map((row) => (
              <div
                key={row.budgetId}
                className="flex items-start gap-3 border-b pb-3 last:border-0"
              >
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">
                    {row.name} is trending {formatCurrency(row.miss, currency)}{" "}
                    over.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    At this pace it runs out around day{" "}
                    {Math.min(
                      days,
                      Math.ceil(row.planned / Math.max(1, row.spent / elapsed)),
                    )}
                    .
                  </p>
                </div>
                <Link
                  to="/budgets"
                  search={{ month, view: "plan" }}
                  className="text-xs font-semibold text-primary"
                >
                  Adjust ›
                </Link>
              </div>
            ))}
            {data.unbudgeted.length > 0 && (
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">
                    {formatCurrency(
                      data.unbudgeted.reduce((sum, row) => sum + row.spent, 0),
                      currency,
                    )}{" "}
                    sits outside every envelope.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.unbudgeted.reduce(
                      (sum, row) => sum + Number(row.txCount),
                      0,
                    )}{" "}
                    transactions need a home.
                  </p>
                </div>
                <Link
                  to="/triage"
                  className="text-xs font-semibold text-primary"
                >
                  Assign ›
                </Link>
              </div>
            )}
            {!warnings.length && !data.unbudgeted.length && (
              <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center">
                <Check className="size-5 text-positive" />
                <p className="font-medium">Nothing needs your attention</p>
                <p className="text-xs text-muted-foreground">
                  Every envelope is tracking with elapsed time.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Envelope</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Left</TableHead>
              <TableHead className="min-w-52">Against elapsed time</TableHead>
              <TableHead className="text-right">Lands at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projected.map((row) => {
              const over = row.spent > row.planned;
              const warning = !over && row.miss > 100;
              return (
                <TableRow key={row.budgetId}>
                  <TableCell>
                    <span
                      className="mr-2 inline-block size-2 rounded-sm"
                      style={{ background: row.color }}
                    />
                    <span className="font-medium">{row.name}</span>
                    {row.settled ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-muted-foreground">
                        settled
                      </span>
                    ) : warning ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-warning">
                        trending over
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.planned, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.spent, currency)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      over && "text-negative",
                    )}
                  >
                    {formatCurrency(row.planned - row.spent, currency)}
                  </TableCell>
                  <TableCell>
                    {row.settled ? (
                      <span className="text-xs text-muted-foreground">
                        settled
                      </span>
                    ) : (
                      <div className="relative h-1.5 rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            over
                              ? "bg-negative"
                              : warning
                                ? "bg-warning"
                                : "bg-primary",
                          )}
                          style={{
                            width: `${Math.min(100, row.planned ? (row.spent / row.planned) * 100 : 0)}%`,
                          }}
                        />
                        <span
                          className="absolute -inset-y-1 w-px bg-foreground/70"
                          style={{ left: `${elapsedRatio * 100}%` }}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      over
                        ? "text-negative"
                        : warning
                          ? "text-warning"
                          : "text-muted-foreground",
                    )}
                  >
                    {row.settled
                      ? "on plan"
                      : formatCurrency(row.landing, currency)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function PlanBudgetView({
  data,
  allBudgets,
  history,
  categories,
  groups,
  currency,
  month,
}: {
  data: BudgetVsActual;
  allBudgets: BudgetRow[];
  history: History;
  categories: Category[];
  groups: Group[];
  currency: string;
  month: string;
}) {
  const router = useRouter();
  const rows = useMemo(() => envelopes(data, allBudgets), [data, allBudgets]);
  const typicals = useMemo(
    () =>
      new Map(
        rows.map((row) => [
          row.budgetId,
          median(
            history
              .map(
                (entry) =>
                  envelopes(entry, allBudgets).find(
                    (item) => item.budgetId === row.budgetId,
                  )?.spent ?? 0,
              )
              .filter(Boolean),
          ),
        ]),
      ),
    [rows, history, allBudgets],
  );
  const [drafts, setDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.budgetId, String(row.planned)])),
  );
  const [saving, setSaving] = useState(false);
  const expectedIncome = data.incomeAvg3m || data.incomeActual;
  const allocated = rows.reduce(
    (sum, row) => sum + (Number(drafts[row.budgetId]) || 0),
    0,
  );
  const light = rows.filter(
    (row) =>
      (typicals.get(row.budgetId) ?? 0) - (Number(drafts[row.budgetId]) || 0) >
      20,
  );
  const previous = history.find(
    (entry) => entry.month === stepMonth(month, -1),
  );

  async function save() {
    setSaving(true);
    try {
      await Promise.all(
        rows.map((row) =>
          setMonthOverride({
            data: {
              budgetId: row.budgetId,
              month,
              amount: Math.max(
                0.01,
                Number(drafts[row.budgetId]) || row.planned,
              ),
            },
          }),
        ),
      );
      await router.invalidate();
    } finally {
      setSaving(false);
    }
  }

  function copyPreviousMonth() {
    if (!previous) return;
    const priorRows = new Map(
      envelopes(previous, allBudgets).map((row) => [row.budgetId, row.planned]),
    );
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.budgetId,
          String(priorRows.get(row.budgetId) ?? row.planned),
        ]),
      ),
    );
  }

  function planFromTypical() {
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.budgetId,
          String(typicals.get(row.budgetId) || row.planned),
        ]),
      ),
    );
  }

  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        {light.length ? (
          <>
            {light.length} envelope{light.length === 1 ? " is" : "s are"}{" "}
            planned below what you typically spend.{" "}
          </>
        ) : (
          <>Your plan matches your recent spending pattern. </>
        )}
        <Money value={expectedIncome - allocated} currency={currency} /> remains
        unallocated.
      </p>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Score
          label="Expected income"
          value={formatCurrency(expectedIncome, currency)}
          note="Recent monthly average"
        />
        <Score
          label="Allocated to envelopes"
          value={formatCurrency(allocated, currency)}
          note={`${rows.length} envelopes`}
        />
        <Score
          label="Left to allocate"
          value={formatCurrency(expectedIncome - allocated, currency)}
          note={
            expectedIncome
              ? `${Math.round(((expectedIncome - allocated) / expectedIncome) * 100)}% of income`
              : "Add income history"
          }
          positive
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={copyPreviousMonth}
          disabled={!previous || !rows.length}
        >
          Copy last month
        </Button>
        <Button
          variant="outline"
          onClick={planFromTypical}
          disabled={!rows.length}
        >
          Plan from typical
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            document
              .getElementById("envelope-setup")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <Plus data-icon="inline-start" />
          Manage envelopes
        </Button>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Envelope</TableHead>
              <TableHead className="w-44 text-right">
                {formatYearMonthLong(month)} plan
              </TableHead>
              <TableHead className="text-right">Typical</TableHead>
              <TableHead className="text-right">vs typical</TableHead>
              <TableHead>Basis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const typical = typicals.get(row.budgetId) ?? 0;
              const value = Number(drafts[row.budgetId]) || 0;
              const delta = value - typical;
              return (
                <TableRow key={row.budgetId}>
                  <TableCell>
                    <span
                      className="mr-2 inline-block size-2 rounded-sm"
                      style={{ background: row.color }}
                    />
                    <span className="font-medium">{row.name}</span>
                    {delta < -20 && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-warning">
                        light
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="ml-auto w-32 text-right font-mono"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={drafts[row.budgetId] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.budgetId]: event.target.value,
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {typical ? formatCurrency(typical, currency) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      delta < -20 ? "text-warning" : "text-muted-foreground",
                    )}
                  >
                    {typical
                      ? `${delta >= 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), currency)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.note ||
                      (typical
                        ? `Median of ${history.length} months`
                        : "Not enough history yet")}
                    {delta < -20 && (
                      <Button
                        variant="link"
                        size="xs"
                        className="ml-2"
                        onClick={() =>
                          setDrafts((current) => ({
                            ...current,
                            [row.budgetId]: typical.toFixed(2),
                          }))
                        }
                      >
                        Use typical
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total allocated</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(allocated, currency)}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setDrafts(
              Object.fromEntries(
                rows.map((row) => [row.budgetId, String(row.planned)]),
              ),
            )
          }
        >
          Discard changes
        </Button>
        <Button onClick={save} disabled={saving || !rows.length}>
          {saving ? "Saving…" : "Save plan"}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="section-label">Envelope setup</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageTab
            allBudgets={allBudgets}
            categories={categories}
            groups={groups}
            currency={currency}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function BudgetHistoryView({
  history,
  allBudgets,
  currency,
  monthCount,
}: {
  history: History;
  allBudgets: BudgetRow[];
  currency: string;
  monthCount: 6 | 12;
}) {
  const months = history.slice(-monthCount);
  const latest = months.at(-1);
  if (!latest || !allBudgets.length) return <EmptyBudgets />;
  const latestRows = envelopes(latest, allBudgets);
  const matrix = latestRows.map((row) => ({
    ...row,
    values: months.map((month) => {
      const match = envelopes(month, allBudgets).find(
        (item) => item.budgetId === row.budgetId,
      );
      return (match?.spent ?? 0) - (match?.planned ?? row.planned);
    }),
  }));
  const reliablyOver = matrix
    .filter(
      (row) =>
        row.values.filter((value) => value > 20).length >=
        Math.max(3, months.length - 1),
    )
    .sort(
      (a, b) =>
        b.values.reduce((s, n) => s + n, 0) -
        a.values.reduce((s, n) => s + n, 0),
    );
  const headline = reliablyOver[0];
  const average = headline
    ? headline.values.reduce((s, n) => s + n, 0) / headline.values.length
    : 0;
  function exportCsv() {
    const header = [
      "Envelope",
      ...months.map((entry) => formatYearMonthLong(entry.month)),
      "Verdict",
    ];
    const body = matrix.map((row) => {
      const verdict = budgetHistoryVerdict(row.values);
      return [
        row.name,
        ...row.values.map((value) => value.toFixed(2)),
        verdict,
      ];
    });
    downloadCsv(
      `finsight-budget-history-${months[0]?.month}-${months.at(-1)?.month}.csv`,
      [header, ...body],
    );
  }
  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        {headline ? (
          <>
            <span className="text-warning">{headline.name}</span> has repeatedly
            gone over plan, by {formatCurrency(Math.abs(average), currency)} a
            month on average. The envelope may be set too low.
          </>
        ) : (
          <>
            Your plan has held up well across the last {months.length} months.
            No envelope is repeatedly missing its target.
          </>
        )}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="section-label">
            Planned vs actual, whole month
          </CardTitle>
          <CardAction className="text-xs text-muted-foreground">
            <span className="mr-3 text-positive">■ Under plan</span>
            <span className="text-warning">■ Over plan</span>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Envelope</TableHead>
                {months.map((month) => (
                  <TableHead key={month.month} className="text-right">
                    {monthShort(month.month)}
                  </TableHead>
                ))}
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => {
                const verdict = budgetHistoryVerdict(row.values);
                return (
                  <TableRow key={row.budgetId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    {row.values.map((value, index) => (
                      <TableCell
                        key={index}
                        className={cn(
                          "text-right font-mono",
                          value > 20
                            ? "text-warning"
                            : value < -20
                              ? "text-positive"
                              : "text-muted-foreground",
                        )}
                      >
                        {value > 0 ? "+" : value < 0 ? "−" : ""}
                        {Math.round(Math.abs(value))}
                      </TableCell>
                    ))}
                    <TableCell
                      className={cn(
                        "font-medium",
                        verdict === "Set too low" && "text-warning",
                      )}
                    >
                      {verdict}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={exportCsv}>
          <Download data-icon="inline-start" />
          Export CSV
        </Button>
        <Link to="/budgets" search={{ view: "plan" }}>
          <Button>Rebuild plan from history</Button>
        </Link>
      </div>
    </div>
  );
}

function Money({ value, currency }: { value: number; currency: string }) {
  return (
    <span className="font-mono font-semibold">
      {formatCurrency(value, currency)}
    </span>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3">
      <p className="section-label">{label}</p>
      <p className="mt-2 font-mono font-semibold">{value}</p>
    </div>
  );
}
function Score({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="section-label">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "font-mono text-2xl font-semibold",
            positive && "text-positive",
          )}
        >
          {value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
function EmptyBudgets() {
  return (
    <Card>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
        <Plus className="size-6 text-muted-foreground" />
        <p className="font-medium">No envelopes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add an envelope in Plan to turn this view into a month plan.
        </p>
        <Link to="/budgets" search={{ view: "plan" }}>
          <Button>Add an envelope</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
