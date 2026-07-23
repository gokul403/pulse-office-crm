import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Settings,
  UserCircle,
  Target,
  UserSquare2,
  TrendingUp,
  TrendingDown,
  Kanban,
  ClipboardList,
  CalendarDays,
  CalendarCheck,
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
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function AppSidebar() {
  const { profile, roles, isAdmin } = useAuth();
  const isManagerOrAdmin = roles.includes("admin") || roles.includes("manager");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (p: string) => {
    if (p === "/issues") return pathname === "/issues";
    if (p === "/leaves") return pathname === "/leaves";
    return pathname === p || pathname.startsWith(p + "/");
  };

  const leavesQ = useQuery<any[]>({
    queryKey: ["leaves-all"],
    queryFn: () => api.get("/leaves?filter=all"),
    enabled: isManagerOrAdmin,
    refetchInterval: 15000,
  });

  const pendingLeavesCount = leavesQ.data?.filter((l) => l.status === "pending").length || 0;

  const workspace = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Tasks", url: "/tasks", icon: CheckSquare },
    { title: "Issues", url: "/issues", icon: ClipboardList },
    { title: "Issue Board", url: "/issues/board", icon: Kanban },
    { title: "My Leaves", url: "/leaves", icon: CalendarDays },
    ...(isManagerOrAdmin ? [{ title: "Leave Approvals", url: "/leaves/approvals", icon: CalendarCheck }] : []),
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
          <div className="flex h-8 w-8 items-center justify-center rounded-md overflow-hidden">
            <img src="/Cybricodelogo.png" alt="Cybricode logo" className="h-7 w-7 object-contain" />
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
                      <Link to={item.url} className="flex w-full items-center">
                        <item.icon />
                        <span className="flex-1">{item.title}</span>
                        {item.url === "/leaves/approvals" && pendingLeavesCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5 leading-none">
                            {pendingLeavesCount}
                          </span>
                        )}
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
