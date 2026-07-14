import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { KeyRound, Loader2, FolderKanban, Calendar, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
};

function memberLabel(profile: Profile) {
  const name = profile.full_name?.trim() || profile.email;
  return profile.full_name?.trim() ? `${name} (${profile.email})` : profile.email;
}

function SettingsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"security" | "projects">("security");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const teamQ = useQuery({
    queryKey: ["team", "settings"],
    queryFn: () => api.get<{ profiles: Profile[] }>("/team"),
    enabled: isAdmin,
  });

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<any[]>("/projects"),
    enabled: isAdmin,
  });

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || creatingProject) return;

    setCreatingProject(true);
    try {
      await api.post("/projects", { name: projectName.trim(), description: projectDesc.trim() });
      toast.success("Project created successfully");
      setProjectName("");
      setProjectDesc("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create project");
    } finally {
      setCreatingProject(false);
    }
  }

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 6;
  const canSubmit =
    !!selectedMemberId &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    passwordLongEnough &&
    !submitting;

  const showMismatch = confirmPassword.length > 0 && !passwordsMatch;
  const showTooShort = newPassword.length > 0 && !passwordLongEnough;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await api.post("/team/password", { userId: selectedMemberId, newPassword });
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not update password");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Admin only.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage workspace projects and user credentials.</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Navigation Tabs Panel */}
        <aside className="w-full md:w-52 shrink-0">
          <nav className="flex flex-row md:flex-col gap-1.5 p-1 rounded-xl bg-muted/40 border border-muted backdrop-blur-sm overflow-x-auto pb-1 md:pb-1">
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 select-none cursor-pointer w-full justify-start ${
                activeTab === "security"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Security & Access</span>
            </button>
            <button
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 select-none cursor-pointer w-full justify-start ${
                activeTab === "projects"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              <span>Projects</span>
            </button>
          </nav>
        </aside>

        {/* Contents Area */}
        <div className="flex-1 space-y-6">
          {activeTab === "security" && (
            <Card className="border border-muted/50 shadow-sm bg-gradient-to-b from-card/85 to-card">
              <CardHeader className="border-b border-muted/30 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-4 w-4 text-primary" /> Password Management
                </CardTitle>
                <CardDescription>
                  Update the password for any team member when credentials need to be reset.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {teamQ.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Loading team members…
                  </div>
                ) : teamQ.isError ? (
                  <p className="text-sm text-destructive py-4">Could not load team members.</p>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="member" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team member</Label>
                      <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                        <SelectTrigger id="member" className="h-10 border-muted focus:ring-2 focus:ring-primary/20">
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {(teamQ.data?.profiles ?? []).map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {memberLabel(profile)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            className="h-10 pl-9 border-muted focus:ring-2 focus:ring-primary/20"
                            placeholder="••••••••"
                          />
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                        {showTooShort && (
                          <p className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                            <span>Password must be at least 6 characters</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            className="h-10 pl-9 border-muted focus:ring-2 focus:ring-primary/20"
                            placeholder="••••••••"
                          />
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        </div>
                        {showMismatch && (
                          <p className="text-xs text-destructive flex items-center gap-1 font-medium mt-1">
                            <span>Passwords do not match</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <Button type="submit" disabled={!canSubmit} className="h-10 px-5 shadow-sm shadow-primary/10 transition-all duration-200">
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Password
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "projects" && (
            <div className="space-y-6">
              {/* Creation Form */}
              <Card className="border border-muted/50 shadow-sm bg-gradient-to-b from-card/85 to-card">
                <CardHeader className="border-b border-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FolderKanban className="h-4 w-4 text-primary" /> Create Project
                  </CardTitle>
                  <CardDescription>
                    Add a new project to the workspace. Each project gets a unique generated sequence code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleCreateProject} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="project-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Name</Label>
                        <Input
                          id="project-name"
                          required
                          placeholder="e.g. Q3 Marketing"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="h-10 border-muted focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-desc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
                        <Input
                          id="project-desc"
                          placeholder="Optional project purpose"
                          value={projectDesc}
                          onChange={(e) => setProjectDesc(e.target.value)}
                          className="h-10 border-muted focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={!projectName.trim() || creatingProject} className="h-10 px-5 shadow-sm shadow-primary/10 transition-all duration-200">
                      {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Project
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Grid of Projects */}
              <Card className="border border-muted/50 shadow-sm bg-gradient-to-b from-card/85 to-card">
                <CardHeader className="border-b border-muted/30 pb-4">
                  <CardTitle className="text-base font-semibold">Workspace Projects</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {projectsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Loading projects…
                    </div>
                  ) : projectsQ.isError ? (
                    <p className="text-sm text-destructive py-4">Could not load projects.</p>
                  ) : (projectsQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed border-muted rounded-xl">No projects created yet.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(projectsQ.data ?? []).map((proj: any) => (
                        <div
                          key={proj.id}
                          className="relative group overflow-hidden rounded-xl border border-muted bg-card p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
                        >
                          <div className="absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-primary/5 blur-xl group-hover:bg-primary/8 transition-all duration-300 pointer-events-none" />
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
                              {proj.project_code}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(proj.created_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <h4 className="font-semibold text-foreground text-sm leading-tight group-hover:text-primary transition-colors duration-200">
                            {proj.name}
                          </h4>
                          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {proj.description || "No description provided."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
