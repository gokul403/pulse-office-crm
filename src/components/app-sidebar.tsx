import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Settings,
  Briefcase,
  UserCircle,
  Target,
  UserSquare2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

export function AppSidebar() {
  const { profile, roles, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  const workspace = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Tasks", url: "/tasks", icon: CheckSquare },
    { title: "Team", url: "/team", icon: Users },
  ];
  const crm = [
    { title: "Leads / Enquiries", url: "/leads", icon: Target },
    { title: "Customers", url: "/customers", icon: UserSquare2 },
  ];
  const finance = [
    { title: "Income", url: "/income", icon: TrendingUp },
    { title: "Expenses", url: "/expenses", icon: TrendingDown },
  ];
  const admin: { title: string; url: string; icon: typeof Settings }[] = [];
  if (isAdmin) admin.push({ title: "Settings", url: "/settings", icon: Settings });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">OfficeFlow</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              CRM &amp; Mgmt
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {[
          { label: "Workspace", items: workspace },
          { label: "CRM", items: crm },
          ...(finance.length ? [{ label: "Finance", items: finance }] : []),
          ...(admin.length ? [{ label: "Admin", items: admin }] : []),
        ].map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-sm group-data-[collapsible=icon]:justify-center">
          <UserCircle className="h-6 w-6 text-muted-foreground" />
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email}</p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">
              {roles.join(", ") || "member"}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
