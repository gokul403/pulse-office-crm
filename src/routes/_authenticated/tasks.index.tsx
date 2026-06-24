import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TaskListPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
};

const STATUSES = ["pending", "in_progress", "completed", "overdue"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function priorityBadge(p: Task["priority"]) {
  const cls = {
    low: "bg-muted text-muted-foreground border-transparent",
    medium: "bg-primary/10 text-primary border-primary/20",
    high: "bg-warning/15 text-warning-foreground border-warning/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
  }[p];
  return <Badge variant="outline" className={cls}>{p}</Badge>;
}

function statusBadge(s: Task["status"]) {
  const cls = {
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    in_progress: "bg-primary/15 text-primary border-primary/30",
    completed: "bg-success/15 text-success border-success/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
  }[s];
  return <Badge variant="outline" className={cls}>{s.replace("_", " ")}</Badge>;
}

function TaskListPage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const tasksQ = useQuery({
    queryKey: ["tasks", user?.id, isAdmin, isManager],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,due_date,assigned_to,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!user,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.id, p.full_name || p.email));
      return map;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      const patch: any = { status };
      if (status === "completed") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      toast.success("Task updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = tasksQ.data ?? [];
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [tasksQ.data, statusFilter, priorityFilter, search]);

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {(isAdmin || isManager) ? "Track every task across the team." : "Everything assigned to you."}
          </p>
        </div>
        {(isAdmin || isManager) && (
          <Button asChild>
            <Link to="/tasks/new">
              <Plus className="mr-1 h-4 w-4" /> New task
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-[160px]">Quick update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksQ.isLoading && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!tasksQ.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No tasks match.</TableCell></TableRow>
              )}
              {filtered.map((t) => {
                const overdue = t.status !== "completed" && t.due_date && isBefore(new Date(t.due_date), now);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link to="/tasks/$taskId" params={{ taskId: t.id }} className="font-medium hover:underline">
                        {t.title}
                      </Link>
                      {t.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.assigned_to ? profilesQ.data?.get(t.assigned_to) ?? "—" : "Unassigned"}
                    </TableCell>
                    <TableCell>{priorityBadge(t.priority)}</TableCell>
                    <TableCell>
                      {overdue ? statusBadge("overdue") : statusBadge(t.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.status}
                        onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as Task["status"] })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.filter((s) => s !== "overdue").map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
