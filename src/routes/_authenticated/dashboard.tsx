import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
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
import { format, isBefore } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type TaskRow = {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  assigned_to: string | null;
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

function DashboardPage() {
  const { user, isAdmin, isManager, profile } = useAuth();

  const tasksQ = useQuery({
    queryKey: ["dashboard-tasks", user?.id, isAdmin, isManager],
    queryFn: async () => {
      let q = supabase.from("tasks").select("id,title,status,priority,due_date,assigned_to,created_at");
      if (!isAdmin && !isManager) q = q.eq("assigned_to", user!.id);
      const { data, error } = await q.order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
    enabled: !!user,
  });

  const teamQ = useQuery({
    queryKey: ["dashboard-team"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,is_active");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return { profiles: data ?? [], roles: roles ?? [] };
    },
    enabled: isAdmin || isManager,
  });

  const tasks = tasksQ.data ?? [];
  const now = new Date();
  const counts = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter(
      (t) => t.status !== "completed" && t.due_date && isBefore(new Date(t.due_date), now),
    ).length,
  };

  const employeeCount =
    teamQ.data?.roles.filter((r: any) => r.role === "employee").length ?? 0;
  const managerCount =
    teamQ.data?.roles.filter((r: any) => r.role === "manager").length ?? 0;

  const priorityChart = (["low", "medium", "high", "critical"] as const).map((p) => ({
    name: p,
    value: tasks.filter((t) => t.priority === p).length,
  }));
  const statusChart = [
    { name: "Pending", value: counts.pending, color: "hsl(var(--chart-3))" },
    { name: "In progress", value: counts.inProgress, color: "hsl(var(--chart-1))" },
    { name: "Completed", value: counts.completed, color: "hsl(var(--chart-2))" },
    { name: "Overdue", value: counts.overdue, color: "hsl(var(--chart-4))" },
  ];
  const PIE_COLORS = ["#F59E0B", "#2563EB", "#22C55E", "#EF4444"];

  const upcoming = tasks
    .filter((t) => t.status !== "completed" && t.due_date)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isAdmin ? "Admin overview" : isManager ? "Team overview" : "My dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(now, "EEEE, MMMM d")} · Signed in as {profile?.email}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(isAdmin || isManager) && (
          <>
            <StatCard label="Employees" value={employeeCount} icon={Users} hint="Active workforce" />
            <StatCard label="Managers" value={managerCount} icon={UserCog} hint="Leadership" />
          </>
        )}
        <StatCard label={isAdmin || isManager ? "All tasks" : "My tasks"} value={counts.total} icon={CheckSquare} />
        <StatCard label="In progress" value={counts.inProgress} icon={TrendingUp} accent="primary" />
        <StatCard label="Pending" value={counts.pending} icon={Clock} accent="warning" />
        <StatCard label="Completed" value={counts.completed} icon={CheckCircle2} accent="success" />
        <StatCard label="Overdue" value={counts.overdue} icon={AlertTriangle} accent="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
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
                <Pie data={statusChart} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming tasks. Enjoy the calm.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={priorityColor(t.priority)}>
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent ? tone[accent] : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
