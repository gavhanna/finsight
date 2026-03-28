import { cn, formatCurrency } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  icon,
  sub,
  valueClass,
  delta,
  accent = "neutral",
  className,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
  valueClass?: string
  delta?: number | null
  accent?: "positive" | "negative" | "neutral" | "primary"
  className?: string
}) {
  const accentClass = {
    positive: "accent-positive",
    negative: "accent-negative",
    neutral:  "accent-neutral",
    primary:  "accent-primary",
  }[accent]

  return (
    <Card className={cn("hover-glow overflow-hidden", accentClass, className)}>
      <CardContent className="p-4 sm:p-5 flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <span className="section-label">{label}</span>
          <div className="rounded-md bg-muted/70 p-1.5 shrink-0">
            {icon}
          </div>
        </div>
        <p className={cn("metric-number", valueClass)}>{value}</p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground capitalize">{sub}</p>
          {delta != null && (
            delta >= 0 ? (
              <span className="delta-up">
                <ArrowUpRight className="size-2.5" />
                {delta.toFixed(1)}%
              </span>
            ) : (
              <span className="delta-down">
                <ArrowDownRight className="size-2.5" />
                {Math.abs(delta).toFixed(1)}%
              </span>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}
