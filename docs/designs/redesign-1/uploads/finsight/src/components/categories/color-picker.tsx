import { cn } from "@/lib/utils"

export const COLORS = [
  "#22c55e","#f97316","#a855f7","#3b82f6","#ec4899",
  "#f59e0b","#14b8a6","#10b981","#6b7280","#8b5cf6",
  "#d97706","#94a3b8","#ef4444","#06b6d4","#84cc16",
]

export function ColorPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string
  onChange: (color: string) => void
  size?: "sm" | "md"
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full transition-transform",
            size === "sm" ? "h-5 w-5" : "h-6 w-6",
            value === c
              ? size === "sm"
                ? "scale-125 ring-2 ring-offset-1 ring-ring"
                : "scale-125 ring-2 ring-offset-2 ring-ring"
              : "",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
