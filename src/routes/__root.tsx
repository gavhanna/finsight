import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
  type ErrorComponentProps,
  type NotFoundRouteProps,
} from "@tanstack/react-router"
import { useSyncExternalStore } from "react"
import {
  ChartNoAxesCombined,
  Landmark,
  MessageSquareText,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Target,
  WifiOff,
  House,
} from "lucide-react"
import { getNeedsReviewCount } from "@/server/fn/transactions"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AiChatProvider, useAiChat } from "@/components/ai-chat/chat-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  loader: async () => {
    try {
      return { uncategorisedCount: await getNeedsReviewCount() }
    } catch {
      return { uncategorisedCount: 0 }
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FinSight" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "FinSight" },
      { name: "theme-color", content: "#0b1017" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1668x2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1536x2048.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
})

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

function getOnlineSnapshot() {
  return typeof navigator === "undefined" || navigator.onLine
}

function useOnlineStatus() {
  return useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, () => true)
}

function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <WifiOff />
      You&rsquo;re offline &mdash; showing last cached data
    </div>
  )
}

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'dark';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`
const swScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Toaster richColors position="bottom-right" />
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  )
}

const primaryNav = [
  { id: "home", to: "/", label: "Home", icon: House },
  { id: "transactions", to: "/transactions", label: "Transactions", icon: ReceiptText },
  { id: "budgets", to: "/budgets", label: "Budgets", icon: Target },
  { id: "explore", to: "/explore", label: "Explore", icon: ChartNoAxesCombined },
  { id: "accounts", to: "/accounts", label: "Accounts", icon: Landmark },
  { id: "setup", to: "/settings", label: "Setup", icon: SlidersHorizontal },
] as const

const subNav = {
  home: [
    { to: "/", label: "Overview" },
    { to: "/", label: "Cash flow", search: { view: "cash-flow" as const } },
    { to: "/", label: "Month in review", search: { view: "month-review" as const } },
  ],
  transactions: [
    { to: "/transactions", label: "All transactions" },
    { to: "/transactions", label: "Needs review", search: { page: 1, reviewState: "needs-review" as const } },
    { to: "/triage", label: "Review mode" },
  ],
  budgets: [
    { to: "/budgets", label: "This month" },
    { to: "/budgets", label: "Plan", search: { view: "plan" as const } },
    { to: "/budgets", label: "History", search: { view: "history" as const } },
  ],
  explore: [
    { to: "/explore", label: "All analyses" },
    { to: "/recurring", label: "Recurring" },
    { to: "/comparison", label: "Comparison" },
    { to: "/merchants", label: "Merchants" },
  ],
  accounts: [
    { to: "/accounts", label: "Accounts" },
    { to: "/accounts", label: "Balances", search: { view: "balances" as const } },
    { to: "/accounts", label: "Data quality", search: { view: "data-quality" as const } },
  ],
  setup: [
    { to: "/categories", label: "Categories" },
    { to: "/rules", label: "Rules" },
    { to: "/settings", label: "Settings" },
    { to: "/logs", label: "Logs" },
  ],
} as const

function activeSection(pathname: string): keyof typeof subNav {
  if (pathname === "/") return "home"
  if (pathname.startsWith("/transactions") || pathname.startsWith("/triage")) return "transactions"
  if (pathname.startsWith("/budgets")) return "budgets"
  if (pathname.startsWith("/accounts")) return "accounts"
  if (
    pathname.startsWith("/explore") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/comparison") ||
    pathname.startsWith("/category-trends") ||
    pathname.startsWith("/recurring") ||
    pathname.startsWith("/merchants")
  ) return "explore"
  return "setup"
}

function isSubNavActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/"
  return pathname === to || pathname.startsWith(`${to}/`)
}

function ConnectionStatus() {
  const online = useOnlineStatus()
  return (
    <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground sm:flex">
      <span className={cn("size-1.5 rounded-full", online ? "bg-positive" : "bg-warning")} />
      {online ? "Connected" : "Offline"}
    </div>
  )
}

function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState()
  const { uncategorisedCount } = Route.useLoaderData()
  const embedded = Boolean((location.search as Record<string, unknown>).embed)
  const section = activeSection(location.pathname)
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date())

  if (embedded) return <main className="min-h-svh bg-background">{children}</main>

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="hidden h-[52px] items-center gap-2 px-5 lg:flex">
          <Link to="/" className="mr-1 flex items-center gap-2 border-r border-border pr-4">
            <img src="/icon.svg" alt="" className="size-5" />
            <span className="text-sm font-semibold tracking-tight">FinSight</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-0.5">
            {primaryNav.map((item) => {
              const active = section === item.id
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                  {item.id === "transactions" && uncategorisedCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] font-semibold text-primary-foreground">
                      {uncategorisedCount > 99 ? "99+" : uncategorisedCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/transactions"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-52 justify-start text-muted-foreground")}
            >
              <Search data-icon="inline-start" />
              Search transactions
              <span className="ml-auto rounded border border-border px-1 font-mono text-[10px]">/</span>
            </Link>
            <ConnectionStatus />
            <ChatButton />
          </div>
        </div>

        <div className="flex h-12 items-center gap-2 px-4 lg:hidden">
          <img src="/icon.svg" alt="FinSight" className="size-5" />
          <span className="text-sm font-semibold">{monthLabel}</span>
          <div className="ml-auto flex items-center gap-2">
            <ConnectionStatus />
            <ChatButton />
          </div>
        </div>

        <nav aria-label="Section navigation" className="scrollbar-none flex h-[42px] items-center gap-5 overflow-x-auto border-t border-border/60 px-5">
          {subNav[section].map((item) => {
            const reviewItem = item.label === "Needs review"
            const itemView = "search" in item ? (item.search as Record<string, unknown>).view : undefined
            const currentView = (location.search as Record<string, unknown>).view
            const defaultView = section === "home" ? "overview" : section === "budgets" ? "this-month" : section === "accounts" ? "accounts" : undefined
            const viewMatches = itemView ? currentView === itemView : !defaultView || currentView === undefined || currentView === defaultView
            const active = isSubNavActive(location.pathname, item.to) && viewMatches && (section !== "transactions" || reviewItem === ((location.search as Record<string, unknown>).reviewState === "needs-review"))
            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                search={"search" in item ? item.search : undefined}
                className={cn(
                  "relative flex h-full shrink-0 items-center text-[13px] font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0",
                  active ? "text-foreground after:opacity-100" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.label === "Needs review" && uncategorisedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 font-mono text-[10px] font-semibold text-primary-foreground">
                    {uncategorisedCount > 99 ? "99+" : uncategorisedCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="min-h-0 flex-1 pb-16 lg:pb-0">{children}</main>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-6 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        {primaryNav.map((item) => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 text-[9px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-[18px]" />
                {item.id === "transactions" && uncategorisedCount > 0 && (
                  <span className="absolute -right-2 -top-1 size-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </span>
              <span className="w-full truncate px-0.5 text-center">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function ChatButton() {
  const { setOpen } = useAiChat()
  return (
    <Button variant="outline" size="icon-sm" onClick={() => setOpen(true)} aria-label="Open finance assistant">
      <MessageSquareText />
    </Button>
  )
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <AiChatProvider>{children}</AiChatProvider>
    </TooltipProvider>
  )
}

function RootNotFoundComponent(_: NotFoundRouteProps) {
  return (
    <AppProviders>
      <ConsoleShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="font-mono text-5xl font-semibold text-muted-foreground/30">404</p>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Page not found</p>
            <p className="text-sm text-muted-foreground">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
          </div>
          <Link to="/" className="text-sm text-primary hover:underline">Go home</Link>
        </div>
      </ConsoleShell>
    </AppProviders>
  )
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  const online = useOnlineStatus()
  return (
    <AppProviders>
      <ConsoleShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <WifiOff className="size-8 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">No data available for this page</p>
            <p className="text-sm text-muted-foreground">
              {!online ? "Visit this page while online to enable offline access." : (error as Error)?.message ?? "Something went wrong."}
            </p>
          </div>
        </div>
      </ConsoleShell>
    </AppProviders>
  )
}

function RootLayout() {
  return (
    <AppProviders>
      <ConsoleShell>
        <Outlet />
      </ConsoleShell>
    </AppProviders>
  )
}
