import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import type { FinanceScore } from "@/server/fn/analytics"

function ScoreBadge({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color =
    score >= 70 ? "text-positive bg-positive/10" :
    score >= 40 ? "text-amber-500 bg-amber-500/10" :
    "text-negative bg-negative/10"

  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-lg px-3 py-2", color)}>
      <span className="text-lg font-bold tabular-nums leading-none">{score}</span>
      <span className="text-[10px] font-medium opacity-80 leading-none">{label}</span>
      <span className="text-[9px] opacity-60 leading-none">{weight}</span>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const gap = circumference - progress

  const color =
    score >= 70 ? "var(--color-positive)" :
    score >= 40 ? "#f59e0b" :
    "var(--color-negative)"

  return (
    <div className="relative flex items-center justify-center">
      <svg width="112" height="112" className="-rotate-90">
        {/* Track */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        {/* Progress */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${gap}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-3xl font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

export function FinanceScoreCard({ data }: { data: FinanceScore }) {
  const { score, savingsScore, adherenceScore, recurringScore, monthLabel } = data

  const label =
    score >= 70 ? "Healthy" :
    score >= 40 ? "Room to improve" :
    "Needs attention"

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="section-label">Finance Score</p>
            <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
          </div>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            score >= 70 ? "text-positive bg-positive/10" :
            score >= 40 ? "text-amber-500 bg-amber-500/10" :
            "text-negative bg-negative/10"
          )}>
            {label}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={score} />
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <ScoreBadge label="Savings Rate" score={savingsScore} weight="40%" />
            <ScoreBadge label="Budget" score={adherenceScore} weight="35%" />
            <ScoreBadge label="Subscriptions" score={recurringScore} weight="25%" />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          Savings Rate score is based on hitting 20% monthly savings. Budget score compares this month (scaled) to last month. Subscription score rewards stable or decreasing recurring costs.
        </p>
      </CardContent>
    </Card>
  )
}
