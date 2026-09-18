import { createFileRoute, Link } from "@tanstack/react-router"
import { z } from "zod"
import { getMerchantDetail } from "../../server/fn/merchants"
import { getSetting } from "../../server/fn/settings"
import { getPresetDates, type PresetKey } from "@/lib/presets"
import { formatCurrency, formatDate, formatYearMonth } from "@/lib/utils"
import { withOfflineCache } from "@/lib/loader-cache"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, Store, TrendingDown, Receipt, CalendarDays, BarChart2 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChartTooltip } from "@/components/chart-tooltip"

const SearchSchema = z.object({
  preset: z.enum(["month", "3months", "6months", "ytd", "12months", "all"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
})

export const Route = createFileRoute("/merchants/$merchant")({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => {
    const dates =
      !search.dateFrom && !search.dateTo
        ? getPresetDates((search.preset ?? "6months") as PresetKey)
        : { dateFrom: search.dateFrom, dateTo: search.dateTo }
    return { ...search, ...dates }
  },
  loader: ({ deps, params }) =>
    withOfflineCache(`merchants:${params.merchant}`, async () => {
      const [detail, currency] = await Promise.all([
        getMerchantDetail({
          data: {
            merchantName: params.merchant,
            dateFrom: deps.dateFrom,
            dateTo: deps.dateTo,
            accountIds: deps.accountIds ?? [],
          },
        }),
        getSetting({ data: "preferred_currency" }),
      ])
      return { detail, currency: currency ?? "EUR", merchantName: params.merchant }
    }),
  component: MerchantDetailPage,
})

function MerchantDetailPage() {
  const { detail, currency, merchantName } = Route.useLoaderData()
  const search = Route.useSearch()

  const { transactions, monthlySpend } = detail

  const totalSpend = transactions.reduce((s, t) => s + t.amount, 0)
  const avgAmount = transactions.length ? totalSpend / transactions.length : 0
  const firstSeen = transactions.length
    ? transactions[transactions.length - 1].bookingDate
    : null
  const lastSeen = transactions.length ? transactions[0].bookingDate : null

  const chartData = monthlySpend.map((m) => ({
    ...m,
    month: formatYearMonth(m.month),
  }))

  const backSearch = {
    preset: search.preset,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    accountIds: search.accountIds,
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          to=".."
          search={backSearch}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Merchants
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Store className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{merchantName}</h1>
          {firstSeen && lastSeen && (
            <p className="text-xs text-muted-foreground">
              {formatDate(firstSeen)} – {formatDate(lastSeen)}
            </p>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Store className="size-8 opacity-30" />
          <p className="text-sm">No transactions found for this period.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingDown className="size-3.5" />
                  <span className="text-xs">Total Spent</span>
                </div>
                <p className="text-lg font-bold font-mono">{formatCurrency(totalSpend, currency)}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Receipt className="size-3.5" />
                  <span className="text-xs">Transactions</span>
                </div>
                <p className="text-lg font-bold">{transactions.length}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart2 className="size-3.5" />
                  <span className="text-xs">Avg per Visit</span>
                </div>
                <p className="text-lg font-bold font-mono">{formatCurrency(avgAmount, currency)}</p>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="px-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CalendarDays className="size-3.5" />
                  <span className="text-xs">Months Active</span>
                </div>
                <p className="text-lg font-bold">{monthlySpend.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Monthly spend chart */}
          {monthlySpend.length > 1 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Monthly Spend</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.08)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={(v) =>
                        formatCurrency(v, currency, {
                          notation: "compact",
                          maximumFractionDigits: 1,
                          minimumFractionDigits: 0,
                        })
                      }
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                    <Bar dataKey="total" name="Spent" fill="var(--color-chart-5)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Transactions table */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Transactions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs pl-4">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap pl-4">
                        {formatDate(t.bookingDate)}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {t.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        {t.categoryId ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background: t.categoryColor + "22",
                              color: t.categoryColor,
                            }}
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: t.categoryColor }}
                            />
                            {t.categoryName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorised</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono pr-4">
                        {formatCurrency(t.amount, t.currency ?? currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
