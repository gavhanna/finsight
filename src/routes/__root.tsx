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
  TrendingUp,
  Repeat,
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
      { rel: "apple-touch-icon", href: "/icon-192.png" },
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
              <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex-shrink-0 shadow-md ring-1 ring-sidebar-primary/25">
                <TrendingUp className="size-3.5" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-sm tracking-tight text-sidebar-foreground leading-none">
                  FinSight
                </span>
                <span className="text-[10px] text-sidebar-foreground/40 font-medium tracking-wide leading-none mt-0.5">
                  FAMILY FINANCE
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
            <Separator orientation="vertical" className="mx-1 h-4" />
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
