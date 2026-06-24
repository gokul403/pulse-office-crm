import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Send, Loader2 } from "lucide-react";
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
  created_by: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  author_email: string | null;
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

function initials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return "?";
}

// ── Task Modal ───────────────────────────────────────────────────
function TaskModal({
  task,
  onClose,
  profilesMap,
}: {
  task: Task;
  onClose: () => void;
  profilesMap: Map<string, string>;
}) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ? task.due_date.slice(0, 10) : "",
    assigned_to: task.assigned_to ?? "unassigned",
  });

  const commentsQ = useQuery({
    queryKey: ["task-comments", task.id],
    queryFn: () => api.get<Comment[]>(`/tasks/${task.id}/comments`),
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-list"],
    queryFn: () => api.get<{ id: string; full_name: string | null; email: string }[]>("/profiles"),
    enabled: isAdmin,
  });

  const updateTask = useMutation({
    mutationFn: (body: any) => api.put(`/tasks/${task.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
      toast.success("Task updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update task"),
  });

  const postComment = useMutation({
    mutationFn: (content: string) =>
      api.post(`/tasks/${task.id}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-comments", task.id] });
      setComment("");
      toast.success("Comment added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to add comment"),
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateTask.mutateAsync({
        ...form,
        description: form.description || null,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      await postComment.mutateAsync(comment.trim());
    } finally {
      setSending(false);
    }
  }

  const isOverdue =
    task.status !== "completed" && task.due_date && isBefore(new Date(task.due_date), new Date());

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isAdmin ? "Edit Task" : task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Admin: editable fields ── */}
          {isAdmin ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Add a description…"
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as Task["status"] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.filter((s) => s !== "overdue").map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Task["priority"] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Assignee</Label>
                  <Select
                    value={form.assigned_to}
                    onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(profilesQ.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          ) : (
            /* ── Non-admin: read-only details ── */
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
              {task.description && (
                <p className="text-muted-foreground leading-relaxed">{task.description}</p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status</span>
                  {isOverdue ? statusBadge("overdue") : statusBadge(task.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Priority</span>
                  {priorityBadge(task.priority)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Due</span>
                  <span>{task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Assignee</span>
                  <span>{task.assigned_to ? profilesMap.get(task.assigned_to) ?? "—" : "Unassigned"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Comments (all roles) ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Comments
            </h3>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {commentsQ.isLoading && (
                <p className="text-sm text-muted-foreground">Loading comments…</p>
              )}
              {!commentsQ.isLoading && (commentsQ.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
              )}
              {(commentsQ.data ?? []).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-xs">
                      {initials(c.author_name, c.author_email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {c.author_name || c.author_email || "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleComment} className="flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="resize-none flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleComment(e as any);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="self-end h-9 w-9"
                disabled={sending || !comment.trim()}
              >
                {sending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line.
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────
function TaskListPage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksQ = useQuery({
    queryKey: ["tasks", user?.id, isAdmin, isManager],
    queryFn: () => api.get<Task[]>("/tasks"),
    enabled: !!user,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const data = await api.get<any[]>("/profiles");
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.id, p.full_name || p.email));
      return map;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      await api.put(`/tasks/${id}`, { status });
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
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              )}
              {!tasksQ.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No tasks match.</TableCell>
                </TableRow>
              )}
              {filtered.map((t) => {
                const overdue = t.status !== "completed" && t.due_date && isBefore(new Date(t.due_date), now);
                return (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell onClick={() => setSelectedTask(t)}>
                      <span className="font-medium hover:underline">{t.title}</span>
                      {t.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{t.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => setSelectedTask(t)}>
                      {t.assigned_to ? profilesQ.data?.get(t.assigned_to) ?? "—" : "Unassigned"}
                    </TableCell>
                    <TableCell onClick={() => setSelectedTask(t)}>{priorityBadge(t.priority)}</TableCell>
                    <TableCell onClick={() => setSelectedTask(t)}>
                      {overdue ? statusBadge("overdue") : statusBadge(t.status)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" onClick={() => setSelectedTask(t)}>
                      {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={t.status}
                          onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as Task["status"] })}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.filter((s) => s !== "overdue").map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          profilesMap={profilesQ.data ?? new Map()}
        />
      )}
    </div>
  );
}