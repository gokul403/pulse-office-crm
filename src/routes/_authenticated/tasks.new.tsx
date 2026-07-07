import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTaskPage,
});

function NewTaskPage() {
  const { user, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");

  const peopleQ = useQuery({
    queryKey: ["assignable-people"],
    queryFn: async () => {
      const data = await api.get<any[]>("/profiles");
      return (data ?? []).filter((p) => p.is_active);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      await api.post("/tasks", {
        title,
        description: description || null,
        priority,
        status: "pending",
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assignee_ids: assigneeIds,
      });
    },
    onSuccess: () => {
      toast.success("Task created");
      navigate({ to: "/tasks" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin && !isManager) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">You don't have permission to create tasks.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/tasks"><ArrowLeft className="mr-1 h-4 w-4" /> Back to tasks</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>New task</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="rounded-md border bg-background max-h-[160px] overflow-y-auto p-2.5 space-y-2">
                {(peopleQ.data ?? []).map((p: any) => {
                  const isChecked = assigneeIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2.5 text-sm font-normal cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={isChecked}
                        onChange={() => {
                          const newIds = isChecked
                            ? assigneeIds.filter((id) => id !== p.id)
                            : [...assigneeIds, p.id];
                          setAssigneeIds(newIds);
                        }}
                      />
                      <span>{p.full_name || p.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/tasks">Cancel</Link>
              </Button>
              <Button type="submit" disabled={create.isPending || !title}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
