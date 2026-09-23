import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
import type { BudgetVsActual } from "@/server/fn/budgets"
import type { RecurringItem } from "@/server/fn/insights"

type MonthFlow = { month: string; income: number; moneyIn: number; expenses: number; net: number }
type Account = { id: string; name: string | null; balance: number | null }
type Summary = { totalIncome: number; totalMoneyIn: number; totalExpenses: number; net: number; count: number }
type CategorySpend = { categoryId: number | null; categoryName: string; categoryColor: string; total: number; count: number }
type Merchant = { name: string; total: number; count: number }

export function CashFlowView({ monthHistory, accounts, recurring, currency }: { monthHistory: MonthFlow[]; accounts: Account[]; recurring: RecurringItem[]; currency: string }) {
  const today = new Date()
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30)
  const spendable = accounts.filter((account) => (account.balance ?? 0) >= 0).reduce((sum, account) => sum + (account.balance ?? 0), 0)
  const upcoming = recurring.filter((item) => item.isActive && new Date(item.nextExpected) >= today && new Date(item.nextExpected) <= horizon).sort((a, b) => itemDate(a) - itemDate(b))
  const schedule = upcoming.reduce<Array<RecurringItem & { after: number }>>((items, item) => {
    const before = items.at(-1)?.after ?? spendable
    return [...items, { ...item, after: before - item.avgAmount }]
  }, [])
  const low = Math.min(spendable, ...schedule.map((item) => item.after))
  const lastSix = monthHistory.slice(-6)
  const typicalDaily = lastSix.length ? lastSix.reduce((sum, month) => sum + month.expenses, 0) / lastSix.length / 30 : 0
  const adjustedLow = low - typicalDaily * 30

  return <div className="space-y-3.5">
    <p className="max-w-4xl text-pretty text-xl font-medium leading-relaxed sm:text-[25px]">On known commitments, you stay above <span className="font-mono font-semibold">{formatCurrency(low, currency)}</span> over the next 30 days. Everyday spending at your recent pace would put the low point closer to <span className={adjustedLow < 0 ? "text-warning" : ""}>{formatCurrency(adjustedLow, currency)}</span>.</p>
    <div className="grid gap-3.5 lg:grid-cols-12">
      <Card className="lg:col-span-7"><CardHeader><CardTitle className="section-label">In and out, by month</CardTitle><CardAction className="text-xs text-muted-foreground"><span className="mr-3 text-positive">■ In</span><span className="text-primary">■ Out</span></CardAction></CardHeader><CardContent className="space-y-5"><FlowBars months={lastSix} /><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader><TableBody>{lastSix.map((month) => <TableRow key={month.month}><TableCell>{formatMonth(month.month)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(month.moneyIn, currency)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(month.expenses, currency)}</TableCell><TableCell className={cn("text-right font-mono font-medium", month.net >= 0 ? "text-positive" : "text-warning")}>{month.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(month.net), currency)}</TableCell></TableRow>)}</TableBody></Table><p className="text-xs leading-relaxed text-muted-foreground">Net here is the change in your spending accounts. Savings transfers are money out, so this deliberately will not match Accounts&rsquo; net position, which counts savings as money kept.</p></CardContent></Card>
      <Card className="lg:col-span-5"><CardHeader><CardTitle className="section-label">Next 30 days</CardTitle><CardAction className="font-mono text-xs text-muted-foreground">Spendable now {formatCurrency(spendable, currency)}</CardAction></CardHeader><CardContent>{schedule.length ? <div className="divide-y">{schedule.map((item) => <div key={`${item.payee}-${item.nextExpected}`} className="grid grid-cols-[72px_1fr_auto] gap-3 py-3 text-xs"><span className="font-mono text-muted-foreground">{formatDate(item.nextExpected)}</span><span className="min-w-0 truncate font-medium">{item.payee}</span><div className="text-right"><p className="font-mono">−{formatCurrency(item.avgAmount, currency)}</p><p className="mt-1 font-mono text-muted-foreground">{formatCurrency(item.after, currency)}</p></div></div>)}</div> : <div className="flex min-h-48 items-center justify-center text-center text-sm text-muted-foreground">No detected commitments fall in the next 30 days.</div>}<div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">If nothing changes:</strong> recent everyday spending averages {formatCurrency(typicalDaily, currency)} a day.</div></CardContent></Card>
    </div>
  </div>
}

function itemDate(item: RecurringItem) { return +new Date(item.nextExpected) }

export function MonthReviewView({ month, stats, categories, previousCategories, budget, previousBudget, merchants, currency }: { month: string; stats: Summary; categories: CategorySpend[]; previousCategories: CategorySpend[]; budget: BudgetVsActual; previousBudget: BudgetVsActual; merchants: Merchant[]; currency: string }) {
  const planned = [...budget.categoryBudgets, ...budget.groupBudgets].reduce((sum, row) => sum + row.budgeted, 0)
  const over = [...budget.categoryBudgets.map((row) => ({ name: row.categoryName, spent: row.spent, planned: row.budgeted })), ...budget.groupBudgets.map((row) => ({ name: row.groupName, spent: row.spent, planned: row.budgeted }))].filter((row) => row.spent > row.planned).sort((a, b) => (b.spent - b.planned) - (a.spent - a.planned))
  const movers = categories.map((category) => ({ name: category.categoryName, value: category.total - (previousCategories.find((item) => item.categoryId === category.categoryId)?.total ?? 0) })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 4)
  const spend = [...budget.categoryBudgets, ...budget.groupBudgets, ...budget.unbudgeted].reduce((sum, row) => sum + row.spent, 0)
  const previousSpend = [...previousBudget.categoryBudgets, ...previousBudget.groupBudgets, ...previousBudget.unbudgeted].reduce((sum, row) => sum + row.spent, 0)
  const kept = stats.totalIncome - spend
  const biggest = merchants[0]
  const variance = spend - planned
  const situation = stats.count === 0 ? `There is no transaction history for ${formatMonth(month)}.` : variance <= 0 ? `A steady month. You spent ${formatCurrency(spend, currency)} against a plan of ${formatCurrency(planned, currency)} and kept ${formatCurrency(kept, currency)}.` : `A more expensive month. You spent ${formatCurrency(spend, currency)}, ${formatCurrency(variance, currency)} above plan, and kept ${formatCurrency(kept, currency)}.`

  return <div className="mx-auto max-w-5xl space-y-9 py-2">
    <div><p className="section-label">{formatMonth(month)} · closed</p><p className="mt-5 text-pretty text-xl font-medium leading-[1.75] sm:text-[25px]">{situation}</p>{over[0] && <p className="mt-4 max-w-4xl text-pretty text-base leading-7 text-secondary-foreground"><span className="text-warning">{over[0].name} went over by {formatCurrency(over[0].spent - over[0].planned, currency)}.</span> {over.length > 1 ? `${over.length - 1} other envelopes also finished above plan.` : "Everything else held inside its envelope."}</p>}<p className="mt-4 max-w-4xl text-pretty text-base leading-7 text-secondary-foreground">Compared with {formatMonth(previousMonth(month))}, spending {spend <= previousSpend ? "fell" : "rose"} by <span className="font-mono">{formatCurrency(Math.abs(spend - previousSpend), currency)}</span>. {biggest ? `${biggest.name} was the busiest payee in the period.` : "There was no merchant activity to call out."}</p></div>
    <div className="grid gap-8 md:grid-cols-2"><section><h2 className="section-label border-b pb-3">Biggest movers vs prior month</h2><div className="divide-y">{movers.map((mover) => <div key={mover.name} className="flex items-center justify-between py-3"><span className="font-medium">{mover.name}</span><span className={cn("font-mono", mover.value <= 0 ? "text-positive" : "text-warning")}>{mover.value >= 0 ? "+" : "−"}{formatCurrency(Math.abs(mover.value), currency)}</span></div>)}</div></section><section><h2 className="section-label border-b pb-3">Month in numbers</h2><div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border"><ReviewNumber label="Transactions" value={String(stats.count)} /><ReviewNumber label="Busiest payee" value={biggest ? `${biggest.name} · ${biggest.count}×` : "—"} /><ReviewNumber label="Largest category" value={categories[0]?.categoryName ?? "—"} /><ReviewNumber label="Kept" value={formatCurrency(kept, currency)} /></div></section></div>
    <section><h2 className="section-label border-b pb-3">What {formatMonth(month).split(" ")[0]} wants from you · {Math.min(2, over.length)}</h2>{over.slice(0, 2).map((row) => <div key={row.name} className="flex items-center gap-4 border-b py-4"><p className="flex-1 text-sm font-medium">Raise {row.name} or decide what changes next month — it finished {formatCurrency(row.spent - row.planned, currency)} over.</p><Link to="/budgets" search={{ view: "plan" }}><Button variant="outline" size="sm">Review plan</Button></Link></div>)}{!over.length && <div className="py-8 text-sm text-muted-foreground">No budget decision is waiting from this month.</div>}</section>
  </div>
}

function formatMonth(month: string) { const [year, value] = month.split("-").map(Number); return new Date(year, value - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) }
function previousMonth(month: string) { const [year, value] = month.split("-").map(Number); const date = new Date(year, value - 2, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` }
function FlowBars({ months }: { months: MonthFlow[] }) { const max=Math.max(1,...months.flatMap((month)=>[month.moneyIn,month.expenses])); return <div className="flex h-36 items-end gap-4 border-b px-2">{months.map((month)=><div key={month.month} className="flex h-full flex-1 items-end justify-center gap-1"><span className="w-3 rounded-t bg-positive/75" style={{height:`${month.moneyIn/max*110}px`}} /><span className="w-3 rounded-t bg-primary/75" style={{height:`${month.expenses/max*110}px`}} /></div>)}</div> }
function ReviewNumber({ label, value }: { label: string; value: string }) { return <div className="bg-card p-4"><p className="section-label">{label}</p><p className="mt-2 truncate font-mono font-semibold">{value}</p></div> }
