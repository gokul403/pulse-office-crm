import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserCog,
  TrendingUp,
  CalendarClock,
  Briefcase,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, isBefore, getHours } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type TaskRow = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  assignees?: { id: string; full_name: string | null; email: string }[];
  project_id?: string | null;
  project_name?: string | null;
  project_code?: string | null;
};

function statColor(s: TaskRow["status"]) {
  return {
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    in_progress: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-success/15 text-success border-success/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
  }[s];
}

function priorityColor(p: TaskRow["priority"]) {
  return {
    low: "bg-muted text-muted-foreground",
    medium: "bg-primary/10 text-primary",
    high: "bg-warning/15 text-warning-foreground",
    critical: "bg-destructive/15 text-destructive",
  }[p];
}

function getGreeting() {
  const hour = getHours(new Date());
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getFirstName(profile: any) {
  if (profile?.full_name) return profile.full_name.split(" ")[0];
  if (profile?.email) return profile.email.split("@")[0];
  return "there";
}

function WelcomeBanner({
  profile,
  isAdmin,
  isManager,
  pendingCount,
  overdueCount,
}: {
  profile: any;
  isAdmin: boolean;
  isManager: boolean;
  pendingCount: number;
  overdueCount: number;
}) {
  const greeting = getGreeting();
  const firstName = getFirstName(profile);

  const subtitle = isAdmin
    ? "You have full visibility across the organization. Here's today's snapshot."
    : overdueCount > 0
    ? `You have ${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}. Let's get them sorted.`
    : pendingCount > 0
    ? `You have ${pendingCount} pending task${pendingCount > 1 ? "s" : ""}. Let's make progress today.`
    : "All caught up! No pending tasks right now.";

  // We only show the micro overdue card in the banner if they are an employee and have overdue items
  const showOverdueBadge = !isAdmin && !isManager && overdueCount > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-blue-600 p-6 shadow-lg">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 right-24 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

      {/* Prominent Overdue Card - Increased size individually */}
      {showOverdueBadge && (
        <div className="absolute top-4 right-4 flex items-center gap-4 rounded-xl border border-white/20 bg-white/15 p-10 backdrop-blur-md shadow-md min-w-[180px] animate-pulse">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Overdue</p>
            <p className="text-4xl font-extrabold leading-none text-white tabular-nums mt-1">{overdueCount}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/25 text-red-200 shadow-inner">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-between gap-6">
        {/* Left: text content (added right padding on desktop to shield layout from enlarged card) */}
        <div className="flex flex-col gap-3 sm:pr-36">
          <div>
            <p className="text-sm font-medium text-white/70 tracking-wide uppercase">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h2 className="mt-1 text-3xl font-bold text-white tracking-tight">
              {greeting}, {firstName}
            </h2>
            <p className="mt-1.5 text-sm text-white/80 max-w-md leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Job title pill at the bottom */}
          {profile?.job_title && (
            <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 backdrop-blur-sm">
              <Briefcase className="h-3.5 w-3.5 text-white/80" />
              <span className="text-xs font-semibold text-white tracking-wide">
                {profile.job_title}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, isAdmin, isManager, profile } = useAuth();

  const tasksQ = useQuery({
    queryKey: ["dashboard-tasks", user?.id, isAdmin, isManager],
    queryFn: async () => {
      return api.get<TaskRow[]>("/tasks");
    },
    enabled: !!user,
  });

  const teamQ = useQuery({
    queryKey: ["dashboard-team"],
    queryFn: async () => {
      return api.get<{ profiles: any[]; roles: any[] }>("/team");
    },
    enabled: isAdmin || isManager,
  });

  const allTasks = tasksQ.data ?? [];
  const tasks = allTasks.filter((t) => t.assignees?.some((a) => a.id === user?.id));
  const now = new Date();
  const counts = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.due_date &&
        isBefore(new Date(t.due_date), now),
    ).length,
  };

  const employeeCount =
    teamQ.data?.roles.filter((r: any) => r.role === "employee").length ?? 0;
  const managerCount =
    teamQ.data?.roles.filter((r: any) => r.role === "manager").length ?? 0;

  const priorityChart = (["low", "medium", "high", "critical"] as const).map(
    (p) => ({
      name: p,
      value: tasks.filter((t) => t.priority === p).length,
    }),
  );
  const statusChart = [
    { name: "Pending", value: counts.pending, color: "hsl(var(--chart-3))" },
    {
      name: "In progress",
      value: counts.inProgress,
      color: "hsl(var(--chart-1))",
    },
    {
      name: "Completed",
      value: counts.completed,
      color: "hsl(var(--chart-2))",
    },
    { name: "Overdue", value: counts.overdue, color: "hsl(var(--chart-4))" },
  ];
  const PIE_COLORS = ["#F59E0B", "#2563EB", "#22C55E", "#EF4444"];

  const upcoming = tasks
    .filter((t) => t.status !== "completed" && t.due_date)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <WelcomeBanner
        profile={profile}
        isAdmin={isAdmin}
        isManager={isManager}
        pendingCount={counts.pending}
        overdueCount={counts.overdue}
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isAdmin || isManager) && (
          <>
            <StatCard
              label="Employees"
              value={employeeCount}
              icon={Users}
              hint="Active workforce"
            />
            <StatCard
              label="Managers"
              value={managerCount}
              icon={UserCog}
              hint="Leadership"
            />
          </>
        )}
        <StatCard
          label="My tasks"
          value={counts.total}
          icon={CheckSquare}
        />
        <StatCard
          label="In progress"
          value={counts.inProgress}
          icon={TrendingUp}
          accent="primary"
        />
        <StatCard
          label="Pending"
          value={counts.pending}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Completed"
          value={counts.completed}
          icon={CheckCircle2}
          accent="success"
        />
        {/* Only show the full Overdue card here for Admin and Managers */}
        {(isAdmin || isManager) && (
          <StatCard
            label="Overdue"
            value={counts.overdue}
            icon={AlertTriangle}
            accent="danger"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChart}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task status distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={50}
                >
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming tasks. Enjoy the calm.
            </p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.project_name && (
                        <Badge variant="secondary" className="px-1.5 py-0.2 text-[9px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                          {t.project_code}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due{" "}
                      {t.due_date
                        ? format(new Date(t.due_date), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={priorityColor(t.priority)}
                    >
                      {t.priority}
                    </Badge>
                    <Badge variant="outline" className={statColor(t.status)}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  icon: any;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
}) {
  const tone = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/15",
    danger: "text-destructive bg-destructive/10",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              accent ? tone[accent] : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}