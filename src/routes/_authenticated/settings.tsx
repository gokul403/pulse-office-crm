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
import { KeyRound, Loader2, FolderKanban } from "lucide-react";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage workspace settings and user credentials.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Password Management
          </CardTitle>
          <CardDescription>
            Update the password for any team member when credentials need to be reset or changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading team members…
            </div>
          ) : teamQ.isError ? (
            <p className="text-sm text-destructive">Could not load team members.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member">Team member</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger id="member">
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

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {showTooShort && (
                  <p className="text-sm text-destructive">Password must be at least 6 characters</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {showMismatch && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
              </div>

              <Button type="submit" disabled={!canSubmit}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" /> Project Management
          </CardTitle>
          <CardDescription>
            Create new projects and view existing ones. Each project gets an auto-generated unique ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                required
                placeholder="e.g. Website Redesign"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Input
                id="project-desc"
                placeholder="Optional brief description of the project"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!projectName.trim() || creatingProject}>
              {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </form>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Existing Projects</h3>
            {projectsQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects…
              </div>
            ) : projectsQ.isError ? (
              <p className="text-sm text-destructive">Could not load projects.</p>
            ) : (projectsQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects created yet.</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/4">Project ID</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/3">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-background">
                    {(projectsQ.data ?? []).map((proj: any) => (
                      <tr key={proj.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">{proj.project_code}</td>
                        <td className="px-4 py-2 font-medium">{proj.name}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{proj.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
