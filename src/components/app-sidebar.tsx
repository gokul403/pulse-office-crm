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

  const tasksQ = useQuery<any[]>({
    queryKey: ["sidebar-tasks", profile?.id],
    queryFn: () => api.get("/tasks"),
    enabled: !!profile,
    refetchInterval: 15000,
  });

  const issuesQ = useQuery<any[]>({
    queryKey: ["sidebar-issues", profile?.id],
    queryFn: () => api.get("/issues"),
    enabled: !!profile,
    refetchInterval: 15000,
  });

  const pendingLeavesCount = leavesQ.data?.filter((l) => l.status === "pending").length || 0;
  
  const userTasks = tasksQ.data?.filter((t) => t.assignees?.some((a: any) => a.id === profile?.id)) ?? [];
  const uncompletedTasksCount = userTasks.filter((t) => t.status !== "completed").length;

  const userIssues = issuesQ.data?.filter((i) => i.assigned_to === profile?.id) ?? [];
  const activeIssuesCount = userIssues.filter((i) => i.status !== "done").length;

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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/40 bg-sidebar/80 backdrop-blur-xl dark:bg-sidebar/55">
      <SidebarHeader className="border-b border-sidebar-border/40 py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[1.5px] shadow-lg shadow-indigo-500/10 transition-transform hover:scale-105 shrink-0">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-background">
              <img src="/Cybricodelogo.png" alt="Cybricode logo" className="h-6 w-6 object-contain" />
            </div>
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent tracking-tight">
              OfficeFlow
            </span>
            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mt-1">
              CRM &amp; Mgmt
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3 gap-4">
        {[
          { label: "Workspace", items: workspace },
          { label: "CRM", items: crm },
          ...(finance.length ? [{ label: "Finance", items: finance }] : []),
          ...(admin.length ? [{ label: "Admin", items: admin }] : []),
        ].map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1.5 group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={`relative transition-all duration-200 group/btn ${
                        isActive(item.url)
                          ? "bg-gradient-to-r from-primary/12 to-primary/3 text-primary dark:from-primary/20 dark:to-primary/5 dark:text-primary-foreground font-semibold shadow-sm border border-primary/10"
                          : "hover:bg-sidebar-accent/40 hover:translate-x-0.5"
                      }`}
                    >
                      <Link to={item.url} className="flex w-full items-center gap-3">
                        <item.icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover/btn:scale-110 shrink-0 ${
                          isActive(item.url) ? "text-primary dark:text-primary" : "text-muted-foreground group-hover/btn:text-foreground"
                        }`} />
                        <span className="flex-1 text-[13px] tracking-wide group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {item.url === "/leaves/approvals" && pendingLeavesCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-[10px] font-extrabold text-white px-1.5 leading-none shadow-sm shadow-red-500/25 group-data-[collapsible=icon]:hidden">
                            {pendingLeavesCount}
                          </span>
                        )}
                        {item.url === "/tasks" && uncompletedTasksCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-[10px] font-extrabold text-white px-1.5 leading-none shadow-sm shadow-orange-500/25 group-data-[collapsible=icon]:hidden animate-in fade-in zoom-in duration-200">
                            {uncompletedTasksCount}
                          </span>
                        )}
                        {item.url === "/issues" && activeIssuesCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-[10px] font-extrabold text-white px-1.5 leading-none shadow-sm shadow-indigo-500/25 group-data-[collapsible=icon]:hidden animate-in fade-in zoom-in duration-200">
                            {activeIssuesCount}
                          </span>
                        )}
                        {isActive(item.url) && (
                          <div className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r-full bg-primary" />
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
      <SidebarFooter className="border-t border-sidebar-border/40 p-2 bg-sidebar-accent/10">
        <div className="flex items-center gap-3 rounded-xl border border-transparent bg-muted/40 dark:bg-muted/10 p-2.5 text-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5 transition-all duration-200 hover:bg-muted/65 dark:hover:bg-muted/20">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-xs shadow-md shadow-indigo-500/10">
            {profile?.full_name?.charAt(0).toUpperCase() ?? profile?.email?.charAt(0).toUpperCase() ?? "U"}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold text-foreground leading-snug">{profile?.full_name ?? profile?.email}</p>
            <p className="truncate text-[9px] uppercase font-bold tracking-widest text-muted-foreground mt-0.5">
              {roles.join(", ") || "member"}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
