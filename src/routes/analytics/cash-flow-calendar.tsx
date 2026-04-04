import { createFileRoute } from "@tanstack/react-router"
import { getCashFlowCalendar, getDayTransactions, type DayTransaction } from "../../server/fn/analytics"
import { getSetting } from "../../server/fn/settings"
import { formatCurrency, cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHelp } from "@/components/ui/page-help"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { z } from "zod"
import { useState } from "react"

const SearchSchema = z.object({
  year: z.number().optional(),
  month: z.number().optional(),
})

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const Route = createFileRoute("/analytics/cash-flow-calendar")({
  validateSearch: SearchSchema,
  component: CashFlowCalendarPage,
  loaderDeps: ({ search }) => {
    const today = new Date()
    return {
      year: search.year ?? today.getFullYear(),
      month: search.month ?? today.getMonth() + 1,
    }
  },
  loader: async ({ deps }) => {
    const [calData, currency] = await Promise.all([
      getCashFlowCalendar({ data: { year: deps.year, month: deps.month } }),
      getSetting({ data: "preferred_currency" }),
    ])
    return { calData, currency: currency ?? "EUR" }
  },
})


function CashFlowCalendarPage() {
  const { calData, currency } = Route.useLoaderData()
  const { days, startOffset, year, month } = calData
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayTxns, setDayTxns] = useState<DayTransaction[]>([])
  const [isLoadingDay, setIsLoadingDay] = useState(false)

  async function openDay(date: string) {
    setSelectedDate(date)
    setIsLoadingDay(true)
    try {
      const txns = await getDayTransactions({ data: { date } })
      setDayTxns(txns)
    } finally {
      setIsLoadingDay(false)
    }
  }

  function changeMonth(delta: number) {
    let newMonth = month + delta
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }
    navigate({ search: { ...search, year: newYear, month: newMonth } })
  }

  const totalIncome = days.reduce((s, d) => s + d.income, 0)
  const totalExpenses = days.reduce((s, d) => s + d.expenses, 0)
  const netFlow = totalIncome - totalExpenses

  const maxDayAmount = Math.max(...days.map((d) => Math.max(d.income, d.expenses)), 1)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Cash Flow Calendar</h1>
          <PageHelp title="Cash Flow Calendar">
            <p>A day-by-day view of money in and out for the selected month.</p>
            <p><strong className="text-foreground">Green bars</strong> — income received that day.</p>
            <p><strong className="text-foreground">Red bars</strong> — total spend that day.</p>
            <p><strong className="text-foreground">Expected debits</strong> — upcoming recurring payments (from your detected subscriptions and bills) shown as badges on future days.</p>
          </PageHelp>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-2 md:p-4">
            <p className="section-label">Income</p>
            <p className="metric-number text-sm sm:text-xl text-positive">{formatCurrency(totalIncome, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 md:p-4">
            <p className="section-label">Expenses</p>
            <p className="metric-number text-sm sm:text-xl text-negative">{formatCurrency(totalExpenses, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 md:p-4">
            <p className="section-label">Net</p>
            <p className={cn("metric-number text-sm sm:text-xl", netFlow >= 0 ? "text-positive" : "text-negative")}>
              {formatCurrency(netFlow, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: startOffset }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {days.map((day) => {
              const hasActivity = day.income > 0 || day.expenses > 0
              const hasExpected = day.expectedDebits.length > 0
              const incomeBarH = day.income > 0 ? Math.max(2, (day.income / maxDayAmount) * 24) : 0
              const expenseBarH = day.expenses > 0 ? Math.max(2, (day.expenses / maxDayAmount) * 24) : 0
              const isToday =
                day.date === new Date().toISOString().slice(0, 10)

              return (
                <div
                  key={day.date}
                  onClick={() => openDay(day.date)}
                  className={cn(
                    "relative rounded-lg border p-1.5 min-h-[64px] flex flex-col gap-1 transition-colors cursor-pointer",
                    isToday ? "border-primary/60 bg-primary/5" : "border-border/50 hover:border-border",
                    hasActivity ? "bg-card hover:bg-muted/30" : "bg-muted/20 hover:bg-muted/40",
                  )}
                >
                  <span className={cn(
                    "text-[11px] font-medium leading-none",
                    isToday ? "text-primary" : "text-muted-foreground",
                  )}>
                    {day.dayOfMonth}
                  </span>

                  {/* Micro bar chart */}
                  {hasActivity && (
                    <div className="flex items-end gap-[2px] h-6 mt-auto">
                      {day.income > 0 && (
                        <div
                          className="flex-1 rounded-sm bg-positive/60"
                          style={{ height: `${incomeBarH}px` }}
                          title={`Income: ${formatCurrency(day.income, currency)}`}
                        />
                      )}
                      {day.expenses > 0 && (
                        <div
                          className="flex-1 rounded-sm bg-negative/60"
                          style={{ height: `${expenseBarH}px` }}
                          title={`Expenses: ${formatCurrency(day.expenses, currency)}`}
                        />
                      )}
                    </div>
                  )}

                  {/* Expected debit badges */}
                  {hasExpected && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {day.expectedDebits.slice(0, 2).map((e, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded px-1 leading-4 truncate max-w-full"
                          title={`Expected: ${e.payee} (${formatCurrency(e.amount, currency)})`}
                        >
                          {e.payee.length > 8 ? e.payee.slice(0, 8) + "…" : e.payee}
                        </span>
                      ))}
                      {day.expectedDebits.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{day.expectedDebits.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-positive/60" />
              Income
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-negative/60" />
              Expenses
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-amber-500/15" />
              Expected debit
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily breakdown table */}
      {days.some((d) => d.income > 0 || d.expenses > 0) && (
        <div className="space-y-2">
          <p className="section-label px-0.5">Active Days</p>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pl-5 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Income</th>
                      <th className="py-3 text-right font-medium text-muted-foreground">Expenses</th>
                      <th className="py-3 pr-5 text-right font-medium text-muted-foreground">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days
                      .filter((d) => d.income > 0 || d.expenses > 0)
                      .map((day) => (
                        <tr
                          key={day.date}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => openDay(day.date)}
                        >
                          <td className="pl-5 py-2.5 tabular-nums text-muted-foreground">{day.date}</td>
                          <td className="py-2.5 text-right tabular-nums text-positive">
                            {day.income > 0 ? formatCurrency(day.income, currency) : "—"}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-negative">
                            {day.expenses > 0 ? formatCurrency(day.expenses, currency) : "—"}
                          </td>
                          <td className="py-2.5 pr-5 text-right tabular-nums text-muted-foreground">
                            {day.count}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Day detail sheet */}
      {(() => {
        const selectedDay = days.find((d) => d.date === selectedDate)
        const expectedDebits = selectedDay?.expectedDebits ?? []
        return (
          <Sheet open={selectedDate !== null} onOpenChange={(open) => { if (!open) setSelectedDate(null) }}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{selectedDate}</SheetTitle>
                <SheetDescription>
                  {isLoadingDay
                    ? "Loading transactions…"
                    : `${dayTxns.length} transaction${dayTxns.length !== 1 ? "s" : ""}${expectedDebits.length > 0 ? ` · ${expectedDebits.length} expected` : ""}`}
                </SheetDescription>
              </SheetHeader>

              {isLoadingDay ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-col px-4 gap-5">
                  {dayTxns.length > 0 && (
                    <div>
                      <p className="section-label mb-2">Transactions</p>
                      <div className="flex flex-col divide-y">
                        {dayTxns.map((tx) => {
                          const payee = tx.creditorName ?? tx.debtorName ?? tx.description ?? "Unknown"
                          const isIncome = tx.amount > 0
                          return (
                            <div key={tx.id} className="flex items-start justify-between gap-3 py-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                {tx.categoryColor && (
                                  <div
                                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: tx.categoryColor }}
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{payee}</p>
                                  {tx.description && tx.description !== payee && (
                                    <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
                                  )}
                                  {tx.categoryName && (
                                    <p className="text-xs text-muted-foreground">{tx.categoryName}</p>
                                  )}
                                </div>
                              </div>
                              <span className={cn("text-sm font-medium tabular-nums shrink-0", isIncome ? "text-positive" : "text-negative")}>
                                {isIncome ? "+" : "-"}{formatCurrency(Math.abs(tx.amount), currency)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {expectedDebits.length > 0 && (
                    <div>
                      <p className="section-label mb-2">Expected Debits</p>
                      <div className="flex flex-col divide-y">
                        {expectedDebits.map((e, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500/60" />
                              <p className="text-sm font-medium truncate">{e.payee}</p>
                            </div>
                            <span className="text-sm font-medium tabular-nums shrink-0 text-amber-600 dark:text-amber-400">
                              -{formatCurrency(e.amount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dayTxns.length === 0 && expectedDebits.length === 0 && (
                    <p className="py-6 text-sm text-muted-foreground">No transactions on this day.</p>
                  )}
                </div>
              )}
            </SheetContent>
          </Sheet>
        )
      })()}
    </div>
  )
}
