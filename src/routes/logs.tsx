import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { getLogs, getLogDates } from "../server/fn/logs";
import type { LogEntry } from "../server/fn/logs";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  CircleDot,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

const SearchSchema = z.object({
  date: z.string().optional(),
  level: z.enum(["all", "debug", "info", "warn", "error"]).optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute("/logs")({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const levels =
      deps.level && deps.level !== "all" ? [deps.level as Level] : undefined;
    const [entries, dates] = await Promise.all([
      getLogs({
        data: { date: deps.date, levels, search: deps.search, limit: 500 },
      }),
      getLogDates(),
    ]);
    return { entries, dates };
  },
  component: LogsPage,
});

// ── Level styling ──────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<Level, { badge: string; dot: string; row: string }> =
  {
    debug: {
      badge: "text-muted-foreground bg-muted border-transparent",
      dot: "bg-muted-foreground/50",
      row: "opacity-100",
    },
    info: {
      badge:
        "text-[color:var(--color-chart-1)] bg-[color:var(--color-chart-1)]/10 border-transparent",
      dot: "bg-[color:var(--color-chart-1)]",
      row: "",
    },
    warn: {
      badge: "text-warning bg-warning-muted border-transparent",
      dot: "bg-warning",
      row: "",
    },
    error: {
      badge: "text-negative bg-negative-muted border-transparent",
      dot: "bg-negative",
      row: "bg-negative-muted/30",
    },
  };

function formatTs(ts: string): { time: string; date: string } {
  const d = new Date(ts);
  return {
    time: d.toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    date: d.toLocaleDateString("en-IE", { day: "2-digit", month: "short" }),
  };
}

function formatDate(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  return date;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function LogsPage() {
  const { entries, dates } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [localSearch, setLocalSearch] = useState(search.search ?? "");

  const selectedDate: string =
    search.date ?? dates[0] ?? new Date().toISOString().slice(0, 10);
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      navigate({ search: { ...search, search: localSearch || undefined } });
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => router.invalidate(), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  const levelCounts = LEVELS.reduce<Record<string, number>>((acc, l) => {
    acc[l] = entries.filter((e) => e.level === l).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="animate-in border-b px-4 py-3 flex flex-wrap gap-2 items-center shrink-0">
        {/* Date selector */}
        <Select
          value={selectedDate as string | undefined}
          onValueChange={(v: string | undefined) =>
            navigate({ search: { ...search, date: v } })
          }
        >
          <SelectTrigger className="w-36 h-8 text-xs font-mono">
            <SelectValue>{formatDate(selectedDate)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {dates.length === 0 ? (
              <SelectItem value={selectedDate} label="No log files">
                No log files
              </SelectItem>
            ) : (
              dates.map((d) => (
                <SelectItem key={d} value={d} label={formatDate(d)}>
                  <span className="font-mono text-xs">{d}</span>
                  {d === new Date().toISOString().slice(0, 10) && (
                    <span className="ml-1.5 text-primary text-xs">today</span>
                  )}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {/* Level filter */}
        <div className="flex rounded-lg border overflow-hidden h-8 text-xs font-medium">
          {(["all", ...LEVELS] as const).map((l) => (
            <button
              key={l}
              onClick={() =>
                navigate({
                  search: { ...search, level: l === "all" ? undefined : l },
                })
              }
              className={cn(
                "px-2.5 flex items-center gap-1 transition-colors border-r last:border-r-0",
                (search.level ?? "all") === l
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {l !== "all" && (
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    LEVEL_STYLES[l].dot,
                  )}
                />
              )}
              {l.charAt(0).toUpperCase() + l.slice(1)}
              {l !== "all" && levelCounts[l] > 0 && (
                <span className="tabular-nums opacity-60">
                  {levelCounts[l]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1.5 size-3.5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search events or data…"
            className="pl-8 h-8 text-xs font-mono"
          />
        </div>

        {/* Stats + refresh */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="section-label tabular-nums">
            {entries.length} {entries.length === 500 ? "(capped)" : "entries"}
          </span>

          {isToday && (
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              title={
                autoRefresh ? "Stop auto-refresh" : "Auto-refresh every 5s"
              }
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors",
                autoRefresh
                  ? "border-primary/40 text-primary bg-primary/8"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <CircleDot
                className={cn(
                  "size-3",
                  autoRefresh && "text-positive animate-pulse",
                )}
              />
              Live
            </button>
          )}

          <button
            onClick={() => router.invalidate()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
            title="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <CircleDot className="size-8 opacity-20" />
            <p>
              No log entries
              {search.search ? " matching your search" : " for this date"}.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {entries.map((entry, i) => (
                <LogRow key={i} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const level = (entry.level ?? "info") as Level;
  const styles = LEVEL_STYLES[level] ?? LEVEL_STYLES.info;
  const { ts, level: _lvl, event, ...data } = entry;
  const hasData = Object.keys(data).length > 0;
  const { time } = formatTs(ts);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/30 hover:bg-muted/30 transition-colors",
          styles.row,
          hasData && "cursor-pointer",
        )}
        onClick={() => hasData && setExpanded((v) => !v)}
      >
        {/* Expand toggle */}
        <td className="w-7 px-2 py-1.5 text-muted-foreground shrink-0">
          {hasData ? (
            expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : (
            <span className="size-3 inline-block" />
          )}
        </td>

        {/* Timestamp */}
        <td className="pr-4 py-1.5 text-muted-foreground whitespace-nowrap tabular-nums w-24">
          {time}
        </td>

        {/* Level badge */}
        <td className="pr-4 py-1.5 w-16">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
              styles.badge,
            )}
          >
            {level}
          </span>
        </td>

        {/* Event */}
        <td className="py-1.5 pr-4 font-medium text-foreground/90">{event}</td>

        {/* Inline preview of data */}
        {!expanded && hasData && (
          <td className="py-1.5 pr-4 text-muted-foreground/60 truncate max-w-xs hidden lg:table-cell">
            {Object.entries(data).map(([k, v]) => (
              <span key={k} className="mr-3">
                <span className="text-muted-foreground/40">{k}=</span>
                <span>
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </span>
            ))}
          </td>
        )}
      </tr>

      {/* Expanded data */}
      {expanded && hasData && (
        <tr className="border-b border-border/30 bg-muted/20">
          <td colSpan={5} className="px-10 py-2.5">
            <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-all tracking-wider">
              {JSON.stringify(data, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
