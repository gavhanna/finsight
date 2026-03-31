import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

type CategoryItem = { categoryId: number | null; categoryName: string; total: number }
type MerchantItem = { name: string; total: number }

export function WhatIfCalculator({
  byCat,
  merchants,
  currency,
  monthsCovered = 3,
}: {
  byCat: CategoryItem[]
  merchants: MerchantItem[]
  currency: string
  monthsCovered?: number
}) {
  const [mode, setMode] = useState<"category" | "merchant">("category")
  const [selectedId, setSelectedId] = useState<string>("")
  const [reductionPct, setReductionPct] = useState(25)

  const items =
    mode === "category"
      ? byCat.map((c) => ({ id: String(c.categoryId ?? "none"), label: c.categoryName, total: c.total }))
      : merchants.map((m) => ({ id: m.name, label: m.name, total: m.total }))

  const selected = items.find((i) => i.id === selectedId) ?? items[0]
  const selectedTotal = selected?.total ?? 0

  // Annualise from the period covered
  const annualTotal = selectedTotal * (12 / monthsCovered)
  const annualSaving = annualTotal * (reductionPct / 100)
  const reducedAnnual = annualTotal - annualSaving

  const chartData = [
    { name: "Current", value: annualTotal, fill: "var(--color-negative)" },
    { name: "Reduced", value: reducedAnnual, fill: "var(--chart-1)" },
  ]

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <p className="section-label mb-4">"What If" Savings Calculator</p>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex rounded-md overflow-hidden border border-border text-xs">
              {(["category", "merchant"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setSelectedId("") }}
                  className={`flex-1 py-1.5 capitalize transition-colors ${
                    mode === m
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Item selector */}
            <Select
              value={selectedId || (items[0]?.id ?? "")}
              onValueChange={setSelectedId}
            >
              <SelectTrigger>
                <SelectValue>
                  {(items.find((i) => i.id === (selectedId || items[0]?.id)))?.label ?? "Select…"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="truncate">{item.label}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {formatCurrency(item.total, currency)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reduction slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Reduction</span>
                <span className="font-medium">{reductionPct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={reductionPct}
                onChange={(e) => setReductionPct(Number(e.target.value))}
                className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Result */}
            <div className="rounded-xl bg-positive/10 border border-positive/20 p-4 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Annual saving</p>
              <p className="text-2xl font-bold text-positive tabular-nums">
                {formatCurrency(annualSaving, currency)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                by cutting {selected?.label ?? "—"} by {reductionPct}%
              </p>
            </div>
          </div>

          {/* Chart */}
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value, currency), "Annual spend"]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Based on last {monthsCovered} months, annualised
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
