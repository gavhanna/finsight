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
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/comparison", label: "Comparison", icon: GitCompare },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/triage", label: "Triage", icon: Inbox },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/categories", label: "Categories", icon: Tag },
  { to: "/rules", label: "Rules", icon: Filter },
  { to: "/settings", label: "Settings", icon: Settings },
]

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
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold flex-shrink-0 ring-1 ring-sidebar-primary/30">
                F
              </div>
              <span className="truncate font-semibold text-sm tracking-tight group-data-[collapsible=icon]:hidden">
                FinSight
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="gap-0.5 px-2">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
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
      </SidebarContent>

      <SidebarFooter>
        <p className="px-2 text-xs text-sidebar-foreground/50 truncate group-data-[collapsible=icon]:hidden">
          Family Finance Insights
        </p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function RootLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 h-4" />
            <span className="font-semibold text-sm md:hidden">FinSight</span>
          </header>
          <div className="flex flex-1 flex-col overflow-auto min-h-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
