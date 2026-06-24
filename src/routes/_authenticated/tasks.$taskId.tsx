import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const taskQ = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const peopleQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });

  const commentsQ = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("id, content, user_id, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateField = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: user.id,
        content: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      window.location.href = "/tasks";
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (taskQ.isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!taskQ.data) return <p>Task not found.</p>;
  const t = taskQ.data;
  const peopleMap = new Map((peopleQ.data ?? []).map((p: any) => [p.id, p.full_name || p.email]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => deleteTask.mutate()}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t.title}</CardTitle>
          {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Status</p>
            <Select value={t.status} onValueChange={(v) => updateField.mutate({ status: v, completed_at: v === "completed" ? new Date().toISOString() : null })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pending", "in_progress", "completed"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Priority</p>
            <Select value={t.priority} onValueChange={(v) => updateField.mutate({ priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "critical"].map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Due date</p>
            <p className="text-sm">{t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}</p>
          </div>
          <div className="sm:col-span-3 grid sm:grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Assignee</p>
              <p className="text-sm">{t.assigned_to ? peopleMap.get(t.assigned_to) ?? "—" : "Unassigned"}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Created</p>
              <p className="text-sm">{format(new Date(t.created_at), "MMM d, yyyy")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" /> Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {(commentsQ.data ?? []).map((c) => (
              <li key={c.id} className="rounded-md border bg-muted/40 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{peopleMap.get(c.user_id) ?? "Someone"}</span>
                  <span>· {format(new Date(c.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </li>
            ))}
            {(commentsQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </ul>
          <div className="space-y-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!comment.trim() || addComment.isPending}
                onClick={() => addComment.mutate()}
              >
                Post
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
