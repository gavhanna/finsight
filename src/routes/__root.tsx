import { HeadContent, Outlet, Scripts, createRootRoute, Link, useRouterState } from "@tanstack/react-router"
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
} from "lucide-react"
import { useTheme, type Theme } from "@/hooks/use-theme"
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

import appCss from "../styles.css?url"

export const Route = createRootRoute({
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
})

const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`

const swScript = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
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
    label: "Transactions",
    items: [
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/triage", label: "Triage", icon: Inbox },
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
      { to: "/logs", label: "Logs", icon: ScrollText },
      { to: "/settings", label: "Settings", icon: Settings },
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

function AppSidebar() {
  const { location } = useRouterState()
  const { isMobile, setOpenMobile } = useSidebar()

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
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="px-2 py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map(({ to, label, icon: Icon, exact }) => {
                  const isActive = exact
                    ? location.pathname === to
                    : location.pathname.startsWith(to)
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        render={<Link to={to} onClick={handleNavClick} />}
                        isActive={isActive}
                        tooltip={label}
                      >
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
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
        <SidebarInset className="overflow-hidden">
          <header className="header-frosted flex h-12 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" />
            <div className="flex items-center gap-2 min-w-0">
              <NavIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm truncate">{currentNav.label}</span>
            </div>
          </header>
          <div className="flex flex-1 flex-col overflow-auto min-h-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
