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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit2, Loader2, UserCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/issues/")({
  component: IssuesListPage,
});

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  project_id: string | null;
  project_name?: string | null;
  project_code?: string | null;
  created_by: string | null;
  assigned_to: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  creator_name?: string | null;
  creator_email?: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["backlog", "todo", "in_progress", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function statusBadge(s: Issue["status"]) {
  const cls = {
    backlog: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
    todo: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
    in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  }[s];
  return <Badge variant="outline" className={cls}>{s.replace("_", " ")}</Badge>;
}

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

function IssuesListPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
  const [initialComment, setInitialComment] = useState("");

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
        initial_comment: initialComment,
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

  const inlineAssignMutation = useMutation({
    mutationFn: async ({ id, assignedToId }: { id: string; assignedToId: string | null }) => {
      const issue = (issuesQ.data ?? []).find((i) => i.id === id);
      if (!issue) return;
      await api.put(`/issues/${id}`, {
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        assigned_to: assignedToId,
        project_id: issue.project_id,
      });
    },
    onSuccess: () => {
      toast.success("Assignee updated");
      qc.invalidateQueries({ queryKey: ["issues"] });
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
    setInitialComment("");
  };

  const openCreateDialog = () => {
    resetForm();
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

  const filteredIssues = (issuesQ.data ?? []).filter((issue) => {
    const term = search.toLowerCase();
    const matchesSearch =
      issue.title.toLowerCase().includes(term) ||
      (issue.description || "").toLowerCase().includes(term);

    const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
    const matchesAssignee =
      assigneeFilter === "all" ||
      (assigneeFilter === "unassigned" && !issue.assigned_to) ||
      issue.assigned_to === assigneeFilter;

    const matchesProject = projectFilter === "all" || issue.project_id === projectFilter;

    return matchesSearch && matchesStatus && matchesAssignee && matchesProject;
  });

  const people = peopleQ.data ?? [];
  const projects = projectsQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">
            List view of all workspace issues. Create, assign, and update statuses.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> New Issue
        </Button>
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
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id} className="text-xs">
                  {proj.project_code} - {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="backlog" className="text-xs">Backlog</SelectItem>
              <SelectItem value="todo" className="text-xs">To Do</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="done" className="text-xs">Done</SelectItem>
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

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          {issuesQ.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No issues found. Match your filters or create a new issue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-medium max-w-xs md:max-w-md">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{issue.title}</span>
                          {issue.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5 font-normal">
                              {issue.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {issue.project_code ? (
                          <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                            {issue.project_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={issue.status}
                          onValueChange={(val: any) =>
                            updateMutation.mutate({
                              id: issue.id,
                              title: issue.title,
                              description: issue.description,
                              priority: issue.priority,
                              assigned_to: issue.assigned_to,
                              project_id: issue.project_id,
                              status: val,
                            })
                          }
                        >
                          <SelectTrigger className={`h-8 w-[120px] text-xs font-semibold ${
                            {
                              backlog: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200",
                              todo: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200",
                              in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200",
                              done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200",
                            }[issue.status]
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs capitalize">
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={issue.priority}
                          onValueChange={(val: any) =>
                            updateMutation.mutate({
                              id: issue.id,
                              title: issue.title,
                              description: issue.description,
                              status: issue.status,
                              assigned_to: issue.assigned_to,
                              project_id: issue.project_id,
                              priority: val,
                            })
                          }
                        >
                          <SelectTrigger className={`h-8 w-[100px] text-xs font-semibold capitalize ${
                            {
                              low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
                              medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200",
                              high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200",
                              critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200",
                            }[issue.priority]
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p} className="text-xs capitalize">
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={issue.assigned_to || "unassigned"}
                          onValueChange={(val) =>
                            inlineAssignMutation.mutate({
                              id: issue.id,
                              assignedToId: val === "unassigned" ? null : val,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[160px] text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <Avatar className="h-5 w-5 text-[9px]">
                                {issue.assigned_to ? (
                                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                    {initials(issue.assignee_name || null, issue.assignee_email || null)}
                                  </AvatarFallback>
                                ) : (
                                  <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                                    ?
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <SelectValue placeholder="Select Assignee" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {people.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">
                                {p.full_name || p.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {issue.creator_name || issue.creator_email || "System"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(issue.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(issue)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Issue</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="create-project">Project <span className="text-destructive">*</span></Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="create-project">
                  <SelectValue placeholder="Select Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.project_code} - {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-title">Title</Label>
              <Input
                id="create-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details about this issue..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-status">Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger id="create-status">
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
                <Label htmlFor="create-priority">Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger id="create-priority">
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
              <Label htmlFor="create-assignee">Assignee</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="create-assignee">
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
            
            {/* Initial Comment Box */}
            <div className="space-y-2">
              <Label htmlFor="create-initial-comment">Initial Comment</Label>
              <Textarea
                id="create-initial-comment"
                rows={2}
                value={initialComment}
                onChange={(e) => setInitialComment(e.target.value)}
                placeholder="Write an optional first comment or update..."
                className="text-xs"
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !projectId}>
                {createMutation.isPending ? "Creating..." : "Create Issue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                  {projects.map((proj) => (
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

            {/* Issue Comments Feed (Only if issue is created/selected) */}
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
