import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { IssueComments } from "@/components/issue-comments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/issues/board")({
  component: IssueBoardPage,
});

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  created_by: string | null;
  assigned_to: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  creator_name?: string | null;
  creator_email?: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS: { id: Issue["status"]; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200" },
  { id: "todo", label: "To Do", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200" },
  { id: "done", label: "Done", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200" },
];

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function priorityBadge(p: Issue["priority"]) {
  const cls = {
    low: "bg-muted text-muted-foreground border-transparent",
    medium: "bg-primary/10 text-primary border-primary/20",
    high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
  }[p];
  return <Badge variant="outline" className={cls}>{p}</Badge>;
}

function initials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return "?";
}

function IssueBoardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  
  // Dialog controls
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Issue["status"]>("backlog");
  const [priority, setPriority] = useState<Issue["priority"]>("medium");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [projectId, setProjectId] = useState<string>("");

  // Load Issues
  const issuesQ = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      return api.get<Issue[]>("/issues");
    },
  });

  // Load Projects
  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const data = await api.get<any[]>("/projects");
      return data ?? [];
    },
  });

  // Load People for assignment
  const peopleQ = useQuery({
    queryKey: ["assignable-people"],
    queryFn: async () => {
      const data = await api.get<any[]>("/profiles");
      return (data ?? []).filter((p) => p.is_active);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error("Project is required");
      }
      await api.post("/issues", {
        title,
        description: description || null,
        status,
        priority,
        assigned_to: assignedTo === "unassigned" ? null : assignedTo,
        project_id: projectId,
      });
    },
    onSuccess: () => {
      toast.success("Issue created");
      qc.invalidateQueries({ queryKey: ["issues"] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (updated: Partial<Issue> & { id: string }) => {
      await api.put(`/issues/${updated.id}`, updated);
    },
    onSuccess: () => {
      toast.success("Issue updated");
      qc.invalidateQueries({ queryKey: ["issues"] });
      setEditOpen(false);
      setSelectedIssue(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/issues/${id}`);
    },
    onSuccess: () => {
      toast.success("Issue deleted");
      qc.invalidateQueries({ queryKey: ["issues"] });
      setEditOpen(false);
      setSelectedIssue(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("backlog");
    setPriority("medium");
    setAssignedTo("unassigned");
    setProjectId("");
  };

  const openCreateDialog = (colStatus?: Issue["status"]) => {
    resetForm();
    if (colStatus) setStatus(colStatus);
    setCreateOpen(true);
  };

  const openEditDialog = (issue: Issue) => {
    setSelectedIssue(issue);
    setTitle(issue.title);
    setDescription(issue.description || "");
    setStatus(issue.status);
    setPriority(issue.priority);
    setAssignedTo(issue.assigned_to || "unassigned");
    setProjectId(issue.project_id || "");
    setEditOpen(true);
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: Issue["status"]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const issueToUpdate = issuesQ.data?.find((i) => i.id === id);
    if (issueToUpdate && issueToUpdate.status !== targetStatus) {
      // Optimistic Update
      qc.setQueryData(["issues"], (prev: Issue[] | undefined) => {
        if (!prev) return [];
        return prev.map((i) => (i.id === id ? { ...i, status: targetStatus } : i));
      });

      try {
        await api.put(`/issues/${id}`, {
          title: issueToUpdate.title,
          description: issueToUpdate.description,
          priority: issueToUpdate.priority,
          assigned_to: issueToUpdate.assigned_to,
          project_id: issueToUpdate.project_id,
          status: targetStatus,
        });
        toast.success(`Moved to ${targetStatus.replace("_", " ")}`);
        qc.invalidateQueries({ queryKey: ["issues"] });
      } catch (err: any) {
        toast.error("Failed to move issue: " + err.message);
        qc.invalidateQueries({ queryKey: ["issues"] });
      }
    }
  };

  const filteredIssues = (issuesQ.data ?? []).filter((issue) => {
    const term = search.toLowerCase();
    const matchesSearch =
      issue.title.toLowerCase().includes(term) ||
      (issue.description || "").toLowerCase().includes(term);

    const matchesAssignee =
      assigneeFilter === "all" ||
      (assigneeFilter === "unassigned" && !issue.assigned_to) ||
      issue.assigned_to === assigneeFilter;

    const matchesProject = projectFilter === "all" || issue.project_id === projectFilter;

    return matchesSearch && matchesAssignee && matchesProject;
  });

  const people = peopleQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issue Board</h1>
          <p className="text-sm text-muted-foreground">
            Collaboratively manage issues. Drag cards to update their status.
          </p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Project:</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Projects</SelectItem>
              {projectsQ.data?.map((proj) => (
                <SelectItem key={proj.id} value={proj.id} className="text-xs">
                  {proj.project_code} - {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Assignee:</span>
          <Select value={assigneeFilter} onValueChange={(val) => setAssigneeFilter(val)}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Assignees</SelectItem>
              <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Board */}
      {issuesQ.isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
          {COLUMNS.map((col) => {
            const colIssues = filteredIssues.filter((i) => i.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between border-b p-3 rounded-t-xl ${col.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{col.label}</span>
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs font-normal">
                      {colIssues.length}
                    </Badge>
                  </div>
                </div>

                {/* Column Body / Drag Target */}
                <div className="flex-1 p-3 space-y-3">
                  {colIssues.map((issue) => (
                    <Card
                      key={issue.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, issue.id)}
                      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative"
                    >
                      <CardContent className="p-3.5 space-y-2">
                        {/* Title and Action Button */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1 min-w-0">
                            {issue.project_code && (
                              <Badge variant="secondary" className="w-fit px-1.5 py-0.2 text-[9px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                                {issue.project_code}
                              </Badge>
                            )}
                            <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
                              {issue.title}
                            </h4>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 shrink-0"
                            onClick={() => openEditDialog(issue)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Description (Truncated) */}
                        {issue.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {issue.description}
                          </p>
                        )}

                        {/* Badges and Assignee Footer */}
                        <div className="flex items-center justify-between pt-1">
                          {priorityBadge(issue.priority)}

                          <Avatar className="h-6 w-6 text-[10px]">
                            {issue.assigned_to ? (
                              <>
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {initials(issue.assignee_name || null, issue.assignee_email || null)}
                                </AvatarFallback>
                              </>
                            ) : (
                              <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                                ?
                              </AvatarFallback>
                            )}
                          </Avatar>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {colIssues.length === 0 && (
                    <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-muted p-4 text-center">
                      <p className="text-xs text-muted-foreground">Drag issues here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Detail Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[450px] md:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Issue</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedIssue) {
                updateMutation.mutate({
                  id: selectedIssue.id,
                  title,
                  description: description || null,
                  status,
                  priority,
                  assigned_to: assignedTo === "unassigned" ? null : assignedTo,
                  project_id: projectId,
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-project">Project <span className="text-destructive">*</span></Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="edit-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectsQ.data?.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.project_code} - {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger id="edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignee">Assignee</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="edit-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Comments Feed */}
            {selectedIssue && (
              <IssueComments issueId={selectedIssue.id} />
            )}

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between pt-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (selectedIssue && confirm("Are you sure you want to delete this issue?")) {
                    deleteMutation.mutate(selectedIssue.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending || !projectId}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
