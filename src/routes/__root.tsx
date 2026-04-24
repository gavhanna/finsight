import { HeadContent, Outlet, Scripts, createRootRoute, Link, useRouterState, type ErrorComponentProps, type NotFoundRouteProps } from "@tanstack/react-router"
import { useState, useSyncExternalStore } from "react"
import { getUncategorisedCount } from "@/server/fn/transactions"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import {
  LayoutDashboard,
  ArrowLeftRight,
  Building2,
  Tag,
  Filter,
  Settings,
  GitCompare,
  Inbox,
  AreaChart,
  ScrollText,
  Sun,
  Moon,
  Monitor,
  Repeat,
  Store,
  PiggyBank,
  Activity,
  Telescope,
  CalendarDays,
  BarChart2,
  Lightbulb,
  ShoppingBag,
  ChevronDown,
  Target,
  MessageSquareText,
} from "lucide-react"
import { useTheme, type Theme } from "@/hooks/use-theme"
import { WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { AiChatProvider, useAiChat } from "@/components/ai-chat/chat-provider"
import { Button } from "@/components/ui/button"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  loader: async () => {
    try {
      const uncategorisedCount = await getUncategorisedCount()
      return { uncategorisedCount }
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
      { name: "theme-color", content: "#0f172a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      // iOS splash screens
      { rel: "apple-touch-startup-image", href: "/splash/splash-2048x2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1668x2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1536x2048.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-828x1792.png",  media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/splash-750x1334.png",  media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
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

function OfflineBanner() {
  const online = useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, () => true)

  if (online) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-amber-400 text-xs font-medium shrink-0">
      <WifiOff className="size-3 shrink-0" />
      You&rsquo;re offline &mdash; showing last cached data
    </div>
  )
}

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`

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

const navGroups = [
  {
    label: "Daily",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/budgets", label: "Budgets", icon: Target },
      { to: "/triage", label: "Triage", icon: Inbox, badge: true },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/comparison", label: "Comparison", icon: GitCompare },
      { to: "/recurring", label: "Recurring", icon: Repeat },
      { to: "/category-trends", label: "Category Trends", icon: AreaChart },
      { to: "/merchants", label: "Merchants", icon: Store },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/analytics/savings-rate",        label: "Savings Rate",    icon: PiggyBank },
      { to: "/analytics/inflation",           label: "Inflation Rate",  icon: Activity },
      { to: "/analytics/forecast",            label: "Forecast",        icon: Telescope },
      { to: "/analytics/what-if",              label: "What If?",        icon: Lightbulb },
      { to: "/analytics/cash-flow-calendar",  label: "Cash Calendar",   icon: CalendarDays },
      { to: "/analytics/patterns",            label: "Patterns",        icon: BarChart2 },
      { to: "/analytics/discretionary",      label: "Discretionary",   icon: ShoppingBag },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/categories", label: "Categories", icon: Tag },
      { to: "/rules", label: "Rules", icon: Filter },
      { to: "/accounts", label: "Accounts", icon: Building2 },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/settings", label: "Settings", icon: Settings },
      { to: "/logs", label: "Logs", icon: ScrollText },
    ],
  },
]

const navItems = navGroups.flatMap((g) => g.items)

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="size-3.5" />, label: "Light" },
    { value: "system", icon: <Monitor className="size-3.5" />, label: "System" },
    { value: "dark", icon: <Moon className="size-3.5" />, label: "Dark" },
  ]

  return (
    <div className="flex rounded-md overflow-hidden border border-sidebar-border">
      {options.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={label}
          className={cn(
            "flex-1 flex items-center justify-center py-1.5 transition-colors",
            theme === value
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  )
}

const COLLAPSED_STORAGE_KEY = "finsight:sidebar:collapsed"

function AppSidebar() {
  const { location } = useRouterState()
  const { isMobile, setOpenMobile } = useSidebar()
  const { uncategorisedCount } = Route.useLoaderData()

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  function handleNavClick() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="flex aspect-square size-7 items-center justify-center rounded-lg overflow-hidden flex-shrink-0 shadow-md ring-1 ring-sidebar-primary/25">
                <img src="/icon.svg" alt="FinSight" className="size-7" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sm tracking-tight text-sidebar-foreground leading-none">
                  FinSight
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-wide leading-none mt-0.5 uppercase">
                  Financial Insights
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const isCollapsed = collapsed.has(group.label)
          return (
            <SidebarGroup key={group.label} className="px-2 py-1">
              <SidebarGroupLabel
                className="flex cursor-pointer select-none items-center justify-between hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
                onClick={() => toggleGroup(group.label)}
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "size-3.5 text-sidebar-foreground/50 transition-transform duration-200",
                    isCollapsed && "-rotate-90",
                  )}
                />
              </SidebarGroupLabel>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
              >
                <div className="overflow-hidden">
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map(({ to, label, icon: Icon, exact, badge }) => {
                        const isActive = exact
                          ? location.pathname === to
                          : location.pathname.startsWith(to)
                        const badgeCount = badge ? uncategorisedCount : 0
                        return (
                          <SidebarMenuItem key={to}>
                            <SidebarMenuButton
                              render={<Link to={to} onClick={handleNavClick} />}
                              isActive={isActive}
                              tooltip={badgeCount > 0 ? `${label} (${badgeCount} uncategorised)` : label}
                            >
                              <Icon />
                              <span>{label}</span>
                              {badgeCount > 0 && (
                                <span className="ml-auto flex items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] font-semibold min-w-[18px] h-[18px] px-1 group-data-[collapsible=icon]:hidden">
                                  {badgeCount > 99 ? "99+" : badgeCount}
                                </span>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </div>
              </div>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <div className="px-2 pb-2 flex items-center justify-center text-xs text-muted-foreground">
            {__APP_VERSION__}
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function RootNotFoundComponent(_: NotFoundRouteProps) {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <OfflineBanner />
          <header className="header-frosted flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-4xl font-bold text-muted-foreground/30">404</p>
            <div className="space-y-1">
              <p className="font-semibold text-sm">Page not found</p>
              <p className="text-muted-foreground text-sm">The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
            </div>
            <Link to="/" className="text-sm text-primary hover:underline">
              Go to dashboard
            </Link>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function RootErrorComponent({ error }: ErrorComponentProps) {
  const online = useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, () => true)
  const offline = !online

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <OfflineBanner />
          <header className="header-frosted flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <WifiOff className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">No cached data for this page</p>
              <p className="text-muted-foreground text-sm">
                {offline
                  ? "Visit this page while online to enable offline access."
                  : (error as Error)?.message ?? "Something went wrong."}
              </p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function RootLayout() {
  const { location } = useRouterState()

  const currentNav = navItems.find((item) =>
    item.exact ? location.pathname === item.to : item.to !== "/" && location.pathname.startsWith(item.to),
  ) ?? navItems[0]

  const { icon: NavIcon } = currentNav

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <AiChatProvider>
          <RootLayoutContent navIcon={NavIcon} navLabel={currentNav.label} />
        </AiChatProvider>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function RootLayoutContent({
  navIcon: NavIcon,
  navLabel,
}: {
  navIcon: typeof navItems[number]["icon"]
  navLabel: string
}) {
  const { setOpen } = useAiChat()

  return (
    <SidebarInset className="overflow-hidden">
      <OfflineBanner />
      <header className="header-frosted flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" />
        <div className="flex items-center gap-2 min-w-0">
          <NavIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">{navLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <MessageSquareText data-icon="inline-start" />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col overflow-auto min-h-0">
        <Outlet />
      </div>
    </SidebarInset>
  )
}
