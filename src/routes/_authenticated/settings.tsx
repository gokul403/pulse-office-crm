import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { KeyRound, Loader2 } from "lucide-react";

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
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const teamQ = useQuery({
    queryKey: ["team"],
    queryFn: () => api.get<{ profiles: Profile[] }>("/team"),
    enabled: isAdmin,
  });

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
    </div>
  );
}
