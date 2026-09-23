import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  deleteConnection,
  getAccountConsoleData,
  initiateReconnection,
  syncAccount,
} from "@/server/fn/accounts";
import { getSetting } from "@/server/fn/settings";
import { withOfflineCache } from "@/lib/loader-cache";
import {
  aggregateBalanceHistory,
  makeMonthKeys,
  monthEndBalance,
  syncCallsRemaining,
} from "@/lib/account-console";
import { cn, formatCurrency, formatDate, getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstitutionPickerBody } from "@/components/accounts/institution-picker";
import type { Account, BalanceHistory, BankConnection } from "@/db/schema";

const SearchSchema = z.object({
  view: z.enum(["accounts", "balances", "data-quality"]).optional(),
  connected: z.coerce.boolean().optional(),
  error: z.string().optional(),
  range: z.enum(["6m", "12m"]).optional(),
});

export const Route = createFileRoute("/accounts")({
  validateSearch: SearchSchema,
  component: AccountsPage,
  loader: () =>
    withOfflineCache("account-console", async () => {
      const [data, currency] = await Promise.all([
        getAccountConsoleData(),
        getSetting({ data: "preferred_currency" }).catch(() => "EUR"),
      ]);
      return { ...data, currency: currency ?? "EUR" };
    }),
});

type AccountData = {
  connections: Array<BankConnection & { accounts: Account[] }>;
  accounts: Account[];
  history: BalanceHistory[];
  coverage: {
    firstDate: string | null;
    lastDate: string | null;
    transactionCount: number;
    categorisedCount: number;
  };
  duplicates: Array<{
    bookingDate: string;
    amount: number;
    ids: string[];
    accountIds: string[];
    payees: string[];
  }>;
  transferCount: number;
  currency: string;
};

function AccountsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [removeConnectionId, setRemoveConnectionId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const view = search.view ?? "accounts";
  const expired = data.connections.filter(
    (connection) =>
      connection.status === "EXPIRED" || connection.status === "REVOKED",
  );

  async function syncAll() {
    setBusy(true);
    try {
      const linked = data.accounts.filter(
        (account) =>
          data.connections.find(
            (connection) => connection.id === account.connectionId,
          )?.status === "LINKED" && syncCallsRemaining(account) > 0,
      );
      await Promise.all(
        linked.map((account) => syncAccount({ data: account.id })),
      );
      setMessage(
        linked.length
          ? "All eligible connected accounts are up to date."
          : "No accounts have a sync available right now.",
      );
      await router.invalidate();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function syncOne(account: Account) {
    setSyncingAccountId(account.id);
    try {
      const result = await syncAccount({ data: account.id });
      setMessage(
        `${account.name ?? "Account"} is up to date · ${result.imported} new transaction${result.imported === 1 ? "" : "s"}.`,
      );
      await router.invalidate();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSyncingAccountId(null);
    }
  }

  async function removeConnection() {
    if (!removeConnectionId) return;
    setBusy(true);
    try {
      await deleteConnection({ data: removeConnectionId });
      setRemoveConnectionId(null);
      setMessage(
        "The bank connection and its imported account data were removed.",
      );
      await router.invalidate();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function reconnect(connection: AccountData["connections"][number]) {
    setBusy(true);
    try {
      const result = await initiateReconnection({
        data: {
          connectionId: connection.id,
          institutionId: connection.institutionId,
          institutionName: connection.institutionName,
          institutionLogo: connection.institutionLogo ?? undefined,
        },
      });
      window.location.assign(result.link);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="console-page space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Accounts</p>
          <h1 className="mt-2 text-xl font-semibold">
            {view === "accounts"
              ? "Accounts"
              : view === "balances"
                ? "Balances"
                : "Data quality"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.accounts.length} account
            {data.accounts.length === 1 ? "" : "s"} ·{" "}
            {expired.length
              ? `${expired.length} needs attention`
              : "all connections healthy"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "balances" && (
            <>
              <Tabs
                value={search.range ?? "6m"}
                onValueChange={(value) =>
                  value &&
                  navigate({
                    search: (current) => ({
                      ...current,
                      range: value as "6m" | "12m",
                    }),
                  })
                }
              >
                <TabsList>
                  <TabsTrigger value="6m">6M</TabsTrigger>
                  <TabsTrigger value="12m">12M</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                onClick={() =>
                  exportBalances(data, search.range === "12m" ? 12 : 6)
                }
              >
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
            </>
          )}
          {view !== "balances" && (
            <Button variant="outline" onClick={syncAll} disabled={busy}>
              <RefreshCw
                data-icon="inline-start"
                className={cn(busy && "animate-spin")}
              />
              {view === "data-quality" ? "Re-scan" : "Sync all"}
            </Button>
          )}
          <Button onClick={() => setShowPicker(true)}>
            <Plus data-icon="inline-start" />
            Connect an account
          </Button>
        </div>
      </div>
      {message && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          {message}
        </div>
      )}
      {view === "accounts" && (
        <AccountsOverview
          data={data}
          expired={expired}
          reconnect={reconnect}
          syncOne={syncOne}
          syncingAccountId={syncingAccountId}
          removeConnection={setRemoveConnectionId}
        />
      )}
      {view === "balances" && (
        <BalancesView data={data} months={search.range === "12m" ? 12 : 6} />
      )}
      {view === "data-quality" && (
        <DataQualityView data={data} expired={expired} reconnect={reconnect} />
      )}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Connect a bank</DialogTitle>
          </DialogHeader>
          <InstitutionPickerBody onClose={() => setShowPicker(false)} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeConnectionId !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setRemoveConnectionId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove bank connection?</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This permanently removes every account on the connection, including
            imported transactions and balance history. Categories and budgets
            are not affected.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveConnectionId(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeConnection}
              disabled={busy}
            >
              {busy ? "Removing…" : "Remove connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountsOverview({
  data,
  expired,
  reconnect,
  syncOne,
  syncingAccountId,
  removeConnection,
}: {
  data: AccountData;
  expired: AccountData["connections"];
  reconnect: (connection: AccountData["connections"][number]) => void;
  syncOne: (account: Account) => void;
  syncingAccountId: string | null;
  removeConnection: (connectionId: string) => void;
}) {
  const net = data.accounts.reduce(
    (sum, account) => sum + (account.balance ?? 0),
    0,
  );
  const history = aggregateHistory(data.history);
  const first = history[0]?.value ?? net;
  const delta = net - first;
  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        Your tracked accounts put you at{" "}
        <span className="font-mono font-semibold">
          {formatCurrency(net, data.currency)}
        </span>
        {history.length > 1 && (
          <>
            {" "}
            —{" "}
            <span className={delta >= 0 ? "text-positive" : "text-warning"}>
              {delta >= 0 ? "up" : "down"}{" "}
              {formatCurrency(Math.abs(delta), data.currency)}
            </span>{" "}
            across the available balance history.
          </>
        )}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="section-label">Net position</CardTitle>
          <CardAction
            className={cn(
              "font-mono text-xs",
              delta >= 0 ? "text-positive" : "text-warning",
            )}
          >
            {delta >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(delta), data.currency)}
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div>
            <p className="font-mono text-4xl font-semibold">
              {formatCurrency(net, data.currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Current balances across {data.accounts.length} tracked accounts
            </p>
          </div>
          <LineChart values={history.map((point) => point.value)} />
        </CardContent>
      </Card>
      {expired.map((connection) => (
        <Card key={connection.id} className="border-warning/40">
          <CardContent className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium">
                {connection.institutionName} needs to reconnect.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Transactions since its last successful sync may be missing from
                Budgets and Explore.
              </p>
            </div>
            <Button variant="outline" onClick={() => reconnect(connection)}>
              Reconnect
            </Button>
          </CardContent>
        </Card>
      ))}
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.accounts.map((account) => {
              const connection = data.connections.find(
                (item) => item.id === account.connectionId,
              );
              const healthy = connection?.status === "LINKED";
              const remaining = syncCallsRemaining(account);
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <p className="font-medium">
                      {account.name ?? connection?.institutionName ?? "Account"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.iban
                        ? `•• ${account.iban.slice(-4)}`
                        : account.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(account.balance ?? 0) < 0
                      ? "Credit"
                      : "Current / savings"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {account.balance == null
                      ? "—"
                      : formatCurrency(
                          account.balance,
                          account.balanceCurrency ?? data.currency,
                        )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <p>
                      {account.lastSyncAt
                        ? formatDate(account.lastSyncAt)
                        : "Never"}
                    </p>
                    <p className="mt-1 font-mono">
                      {remaining}/4 syncs left today
                    </p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 text-xs font-medium",
                        healthy ? "text-positive" : "text-warning",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          healthy ? "bg-positive" : "bg-warning",
                        )}
                      />
                      {healthy ? "Healthy" : "Re-approve"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`Sync ${account.name ?? "account"}`}
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => syncOne(account)}
                      disabled={
                        !healthy || remaining === 0 || syncingAccountId !== null
                      }
                    >
                      <RefreshCw
                        className={cn(
                          syncingAccountId === account.id && "animate-spin",
                        )}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="section-label">Bank connections</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.connections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{connection.institutionName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {connection.accounts.length} account
                  {connection.accounts.length === 1 ? "" : "s"} ·{" "}
                  {connection.status.toLowerCase()}
                </p>
              </div>
              {connection.status !== "LINKED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reconnect(connection)}
                >
                  Reconnect
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeConnection(connection.id)}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3.5 md:grid-cols-3">
        <Quality
          label="Coverage"
          value={
            data.coverage.firstDate
              ? `Since ${formatDate(data.coverage.firstDate)}`
              : "No history"
          }
        />
        <Quality
          label="Possible duplicates"
          value={`${data.duplicates.length} pair${data.duplicates.length === 1 ? "" : "s"} to review`}
          warning={data.duplicates.length > 0}
        />
        <Quality
          label="Transfers"
          value={`${data.transferCount} matched and excluded`}
        />
      </div>
    </div>
  );
}

function BalancesView({ data, months }: { data: AccountData; months: number }) {
  const monthKeys = makeMonthKeys(months);
  const rows = data.accounts.map((account) => ({
    account,
    values: monthKeys.map((month) =>
      monthEndBalance(data.history, account.id, month),
    ),
  }));
  const totals = monthKeys.map((_, index) =>
    rows.reduce((sum, row) => sum + (row.values[index] ?? 0), 0),
  );
  const delta = totals.at(-1)! - totals[0];
  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        Net position is{" "}
        <span className={delta >= 0 ? "text-positive" : "text-warning"}>
          {delta >= 0 ? "up" : "down"}{" "}
          {formatCurrency(Math.abs(delta), data.currency)}
        </span>{" "}
        across {months} months. Account balances below show where that movement
        came from.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="section-label">
            Net position, month end
          </CardTitle>
          <CardAction className="text-xs text-muted-foreground">
            Axis starts at{" "}
            {formatCurrency(
              Math.floor(Math.min(...totals) / 1000) * 1000,
              data.currency,
              { maximumFractionDigits: 0 },
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <BalanceBars values={totals} labels={monthKeys.map(shortMonth)} />
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              {monthKeys.map((month) => (
                <TableHead key={month} className="text-right">
                  {shortMonth(month)}
                </TableHead>
              ))}
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ account, values }) => {
              const change = (values.at(-1) ?? 0) - (values[0] ?? 0);
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <p className="font-medium">{account.name ?? "Account"}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.iban
                        ? `•• ${account.iban.slice(-4)}`
                        : "tracked balance"}
                    </p>
                  </TableCell>
                  {values.map((value, index) => (
                    <TableCell
                      key={index}
                      className="text-right font-mono text-muted-foreground"
                    >
                      {value == null
                        ? "—"
                        : formatCurrency(
                            value,
                            account.balanceCurrency ?? data.currency,
                            { maximumFractionDigits: 0 },
                          )}
                    </TableCell>
                  ))}
                  <TableCell
                    className={cn(
                      "text-right font-mono font-medium",
                      change >= 0 ? "text-positive" : "text-warning",
                    )}
                  >
                    {change >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(change), data.currency, {
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Net position</TableCell>
              {totals.map((value, index) => (
                <TableCell key={index} className="text-right font-mono">
                  {formatCurrency(value, data.currency, {
                    maximumFractionDigits: 0,
                  })}
                </TableCell>
              ))}
              <TableCell className="text-right font-mono">
                {delta >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(delta), data.currency, {
                  maximumFractionDigits: 0,
                })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </div>
  );
}

function DataQualityView({
  data,
  expired,
  reconnect,
}: {
  data: AccountData;
  expired: AccountData["connections"];
  reconnect: (connection: AccountData["connections"][number]) => void;
}) {
  const categorisedRate = data.coverage.transactionCount
    ? (data.coverage.categorisedCount / data.coverage.transactionCount) * 100
    : 0;
  const issues = expired.length + (data.duplicates.length ? 1 : 0);
  return (
    <div className="space-y-3.5">
      <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">
        {issues ? (
          <>
            <span className="text-warning">
              {issues} thing{issues === 1 ? "" : "s"} need you.
            </span>{" "}
            Everything else is reconciled through{" "}
            {data.coverage.lastDate
              ? formatDate(data.coverage.lastDate)
              : "the latest sync"}
            .
          </>
        ) : (
          <>
            Every tracked account is connected and the imported history is
            clean.
          </>
        )}
      </p>
      {issues > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="section-label">
              Needs you · {issues}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {expired.map((connection) => (
              <div
                key={connection.id}
                className="flex items-start gap-3 border-b pb-4"
              >
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">
                    {connection.institutionName} has stopped syncing.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Spending after its last sync may be missing from every
                    envelope.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reconnect(connection)}
                >
                  Reconnect
                </Button>
              </div>
            ))}
            {data.duplicates.length > 0 && (
              <div>
                <p className="font-medium">
                  {data.duplicates.length} pairs look like the same payment
                  counted twice.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Same amount, same day, on different accounts. Review before
                  deciding.
                </p>
                <div className="mt-3 divide-y">
                  {data.duplicates.slice(0, 4).map((pair) => (
                    <div
                      key={`${pair.bookingDate}-${pair.amount}`}
                      className="flex items-center gap-3 py-3 text-xs"
                    >
                      <span className="w-20 font-mono text-muted-foreground">
                        {formatDate(pair.bookingDate)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {pair.payees.join(" / ")}
                      </span>
                      <span className="font-mono">
                        {formatCurrency(pair.amount, data.currency)}
                      </span>
                      <Link
                        to="/transactions"
                        search={{
                          dateFrom: pair.bookingDate,
                          dateTo: pair.bookingDate,
                          page: 1,
                        }}
                      >
                        <Button variant="outline" size="xs">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="section-label">Handled for you</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Handled
            title="Transfers matched and kept out of spending"
            value={String(data.transferCount)}
            detail="Categorised transfers do not inflate cash out."
          />
          <Handled
            title="Transactions categorised"
            value={`${categorisedRate.toFixed(1)}%`}
            detail={`${data.coverage.categorisedCount} of ${data.coverage.transactionCount} imported transactions`}
          />
          <Handled
            title="History coverage"
            value={
              data.coverage.firstDate
                ? formatDate(data.coverage.firstDate)
                : "—"
            }
            detail={
              data.coverage.lastDate
                ? `Through ${formatDate(data.coverage.lastDate)}`
                : "Sync an account to begin"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function aggregateHistory(history: AccountData["history"]) {
  return aggregateBalanceHistory(history);
}
function shortMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
  });
}
function Quality({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="section-label">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("font-medium", warning && "text-warning")}>{value}</p>
      </CardContent>
    </Card>
  );
}
function Handled({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <Check className="mt-0.5 size-4 text-positive" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
function LineChart({ values }: { values: number[] }) {
  if (values.length < 2)
    return (
      <div className="flex h-24 items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground">
        Sync balances again to build a trend.
      </div>
    );
  const min = Math.min(...values),
    max = Math.max(...values),
    range = Math.max(1, max - min);
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 500},${90 - ((v - min) / range) * 80}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 500 100"
      className="h-28 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={`${points} 500,100 0,100`}
        fill="var(--primary)"
        opacity=".08"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function BalanceBars({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const min = Math.floor(Math.min(...values) / 1000) * 1000,
    range = Math.max(1, Math.max(...values) - min);
  return (
    <div className="flex h-52 items-end gap-3 border-b border-border px-2">
      {values.map((value, index) => (
        <div
          key={labels[index]}
          className="flex h-full flex-1 flex-col justify-end gap-2"
        >
          <span className="text-center font-mono text-[10px] text-muted-foreground">
            {Math.round(value).toLocaleString()}
          </span>
          <div
            className="mx-auto w-full max-w-20 rounded-t bg-primary/70"
            style={{ height: `${24 + ((value - min) / range) * 120}px` }}
          />
          <span className="pb-2 text-center text-[10px] text-muted-foreground">
            {labels[index]}
          </span>
        </div>
      ))}
    </div>
  );
}

function exportBalances(data: AccountData, months: number) {
  const monthKeys = makeMonthKeys(months);
  const rows: Array<Array<string | number>> = [
    ["Account", ...monthKeys.map(shortMonth), "Change"],
    ...data.accounts.map((account) => {
      const values = monthKeys.map((month) =>
        monthEndBalance(data.history, account.id, month),
      );
      const change = (values.at(-1) ?? 0) - (values[0] ?? 0);
      return [
        account.name ?? "Account",
        ...values.map((value) => value ?? ""),
        change,
      ];
    }),
  ];
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `finsight-account-balances-${months}m.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
