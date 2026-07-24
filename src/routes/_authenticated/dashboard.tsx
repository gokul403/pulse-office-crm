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
  Kanban,
  Quote,
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

type IssueRow = {
  id: string;
  title: string;
  status: "backlog" | "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assigned_to: string | null;
  assignee_name?: string | null;
  created_at: string;
};

function statColor(s: TaskRow["status"]) {
  return {
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    in_progress: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-success/15 text-success border-success/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
  }[s];
}

function issueStatusColor(s: IssueRow["status"]) {
  return {
    backlog: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    todo: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  }[s];
}

function priorityColor(p: TaskRow["priority"] | IssueRow["priority"]) {
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

const MOTIVATIONAL_QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Opportunities don't happen, you create them.", author: "Chris Grosser" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Be so good they can't ignore you.", author: "Cal Newport" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
];

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

  const getDayOfYear = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime() + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const dayOfYear = getDayOfYear(new Date());
  const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
  const dailyQuote = MOTIVATIONAL_QUOTES[quoteIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-800 p-6 md:p-8 shadow-xl shadow-indigo-500/10 dark:shadow-none border border-white/10">
      {/* Decorative glowing blobs */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pink-500/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-12 right-24 h-44 w-44 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />

      {/* Prominent Overdue Card */}
      {showOverdueBadge && (
        <div className="absolute top-4 right-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-6 md:p-8 backdrop-blur-lg shadow-xl min-w-[160px] animate-pulse">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Overdue</p>
            <p className="text-3xl font-black leading-none text-white tabular-nums mt-1">{overdueCount}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-200 shadow-inner">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      )}

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: text content */}
        <div className="flex flex-col gap-4 max-w-lg">
          <div>
            <p className="text-[10px] font-extrabold text-white/60 tracking-widest uppercase">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h2 className="mt-2 text-2xl md:text-3xl font-black text-white tracking-tight font-sans">
              {greeting}, {firstName}
            </h2>
            <p className="mt-2 text-sm text-white/80 leading-relaxed font-medium">
              {subtitle}
            </p>
          </div>

          {/* Job title pill at the bottom */}
          {profile?.job_title && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md transition-all hover:bg-white/15">
              <Briefcase className="h-3.5 w-3.5 text-white/80" />
              <span className="text-xs font-bold text-white tracking-wide">
                {profile.job_title}
              </span>
            </div>
          )}
        </div>

        {/* Right: Daily Motivational Quote */}
        {!showOverdueBadge && (
          <div className="relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg shadow-xl max-w-sm md:max-w-md w-full md:w-80 select-none overflow-hidden transition-all duration-300 hover:bg-white/10 shrink-0">
            <Quote className="absolute -right-2 -bottom-2 h-20 w-20 text-white/5 pointer-events-none transform rotate-180" />
            <div className="relative z-10">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-white/50 mb-2">Daily Inspiration</p>
              <p className="text-xs italic text-white/95 font-medium leading-relaxed">
                "{dailyQuote.text}"
              </p>
              <p className="text-[10px] font-bold text-white/60 mt-3 text-right">
                — {dailyQuote.author}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/90 p-3 shadow-xl backdrop-blur-md min-w-[120px]">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label || payload[0].name}</p>
        <p className="text-base font-extrabold text-foreground mt-1">
          {payload[0].value} <span className="text-xs font-semibold text-muted-foreground">tasks</span>
        </p>
      </div>
    );
  }
  return null;
};

function DashboardPage() {
  const { user, isAdmin, isManager, profile } = useAuth();

  const tasksQ = useQuery({
    queryKey: ["dashboard-tasks", user?.id, isAdmin, isManager],
    queryFn: async () => {
      return api.get<TaskRow[]>("/tasks");
    },
    enabled: !!user,
  });

  const issuesQ = useQuery({
    queryKey: ["dashboard-issues", user?.id],
    queryFn: async () => {
      return api.get<IssueRow[]>("/issues");
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

  const allIssues = issuesQ.data ?? [];
  const myIssues = allIssues.filter((i) => i.assigned_to === user?.id);
  const myActiveIssuesCount = myIssues.filter((i) => i.status !== "done").length;

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
    { name: "Pending", value: counts.pending },
    { name: "In progress", value: counts.inProgress },
    { name: "Completed", value: counts.completed },
    { name: "Overdue", value: counts.overdue },
  ];
  const PIE_COLORS = ["#f59e0b", "#6366f1", "#10b981", "#ef4444"];

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
          accent="primary"
        />
        <StatCard
          label="My Active Issues"
          value={myActiveIssuesCount}
          icon={Kanban}
          accent="primary"
        />
        <StatCard
          label="Pending tasks"
          value={counts.pending}
          icon={Clock}
          accent="warning"
        />
        <StatCard
          label="Completed tasks"
          value={counts.completed}
          icon={CheckCircle2}
          accent="success"
        />
        {/* Only show the full Overdue card here for Admin and Managers */}
        {(isAdmin || isManager) && (
          <StatCard
            label="Overdue tasks"
            value={counts.overdue}
            icon={AlertTriangle}
            accent="danger"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChart}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                  opacity={0.5}
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  className="text-[10px] text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99, 102, 241, 0.05)", radius: 6 }} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Task status distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={65}
                  paddingAngle={3}
                >
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lists Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming tasks */}
        <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
          <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-indigo-500" /> Upcoming Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No upcoming tasks. Enjoy the calm.
              </p>
            ) : (
              <ul className="divide-y divide-border/30">
                {upcoming.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/20 transition-colors rounded-xl px-2.5 -mx-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                        {t.project_name && (
                          <Badge variant="secondary" className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
                            {t.project_code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Due{" "}
                        {t.due_date
                          ? format(new Date(t.due_date), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${priorityColor(t.priority)} px-2 py-0.5 text-[10px] font-bold border-transparent`}
                      >
                        {t.priority}
                      </Badge>
                      <Badge variant="outline" className={`${statColor(t.status)} px-2 py-0.5 text-[10px] font-bold border-transparent`}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Assigned Issues */}
        <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
          <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Kanban className="h-4 w-4 text-violet-500" /> My Assigned Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {myIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No issues assigned to you.
              </p>
            ) : (
              <ul className="divide-y divide-border/30">
                {myIssues.slice(0, 6).map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-muted/20 transition-colors rounded-xl px-2.5 -mx-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{i.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Created {format(new Date(i.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${priorityColor(i.priority)} px-2 py-0.5 text-[10px] font-bold border-transparent`}
                      >
                        {i.priority}
                      </Badge>
                      <Badge variant="outline" className={`${issueStatusColor(i.status)} px-2 py-0.5 text-[10px] font-bold border-transparent`}>
                        {i.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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
    primary: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400 dark:bg-indigo-500/20 border-indigo-500/10",
    success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20 border-emerald-500/10",
    warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/20 border-amber-500/10",
    danger: "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20 border-rose-500/10",
  };
  const glow = {
    primary: "hover:shadow-indigo-500/5 hover:border-indigo-500/20",
    success: "hover:shadow-emerald-500/5 hover:border-emerald-500/20",
    warning: "hover:shadow-amber-500/5 hover:border-amber-500/20",
    danger: "hover:shadow-rose-500/5 hover:border-rose-500/20",
  };
  return (
    <Card className={`border border-border/40 bg-card/65 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${accent ? glow[accent] : "hover:shadow-muted/5 hover:border-muted/20"}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground tabular-nums">{value}</p>
            {hint && (
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{hint}</p>
            )}
          </div>
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
              accent ? tone[accent] : "bg-muted/40 text-muted-foreground border-transparent"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}