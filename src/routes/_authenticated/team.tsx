import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  is_active: boolean;
};

type CreatedCredentials = {
  email: string;
  temporaryPassword: string;
};

// ── Edit modal ────────────────────────────────────────────────────────────────

type EditMemberModalProps = {
  profile: Profile;
  currentRole: string;
  managers: Profile[];
  onClose: () => void;
  onSaved: () => void;
};

function EditMemberModal({ profile, currentRole, managers, onClose, onSaved }: EditMemberModalProps) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [role, setRole] = useState(currentRole);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [saving, setSaving] = useState(false);

  const roleChanged = role !== currentRole;
  const activeChanged = isActive !== profile.is_active;
  const profileChanged =
    fullName !== (profile.full_name ?? "") ||
    jobTitle !== (profile.job_title ?? "");

  const isDirty = roleChanged || activeChanged || profileChanged;

  async function handleSave() {
    setSaving(true);
    try {
      const requests: Promise<unknown>[] = [];

      if (profileChanged) {
        requests.push(
          api.post(`/team/update-member/${profile.id}`, {
            fullName: fullName || undefined,
            jobTitle: jobTitle || undefined,
          })
        );
      }

      if (roleChanged) {
        requests.push(api.post("/team/role", { userId: profile.id, role }));
      }

      if (activeChanged) {
        requests.push(api.post("/team/active", { userId: profile.id, active: isActive }));
      }

      await Promise.all(requests);
      toast.success("Member updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>{profile.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-title">Job title</Label>
            <Input
              id="edit-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Account Executive"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Account status</Label>
              <p className="text-xs text-muted-foreground">
                {isActive ? "User can sign in." : "User is blocked from signing in."}
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function TeamPage() {
  const { isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [managerId, setManagerId] = useState("");

  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("");

  const dataQ = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const res = await api.get<{ profiles: Profile[]; roles: { user_id: string; role: string }[] }>("/team");
      const roleMap = new Map<string, string>();
      (res.roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      return { profiles: res.profiles, roleMap };
    },
  });

  const managers = useMemo(() => {
    const profiles = dataQ.data?.profiles ?? [];
    const roleMap = dataQ.data?.roleMap ?? new Map<string, string>();
    return profiles.filter((p) => roleMap.get(p.id) === "manager" && p.is_active);
  }, [dataQ.data]);

  function resetForm() {
    setEmail("");
    setFullName("");
    setJobTitle("");
    setRole("employee");
    setManagerId("");
  }

  function openEdit(profile: Profile) {
    if (!isAdmin) return;
    setEditProfile(profile);
    setEditRole(dataQ.data?.roleMap.get(profile.id) ?? "employee");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (role === "employee" && !managerId) {
      toast.error("Select a manager for the employee");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{
        member: { email: string };
        temporaryPassword: string;
      }>("/team/members", {
        email,
        fullName,
        jobTitle: jobTitle || undefined,
        role,
        managerId: role === "employee" ? managerId : undefined,
      });

      setAddOpen(false);
      resetForm();
      setCreatedCreds({
        email: res.member.email,
        temporaryPassword: res.temporaryPassword,
      });
      setCredsOpen(true);
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["assignable-people"] });
      toast.success("Team member created");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create member");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCredentials() {
    if (!createdCreds) return;
    const text = `Email: ${createdCreds.email}\nPassword: ${createdCreds.temporaryPassword}`;
    await navigator.clipboard.writeText(text);
    toast.success("Credentials copied");
  }

  if (!isAdmin && !isManager) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Click a row to edit a member's details." : "View your team."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dataQ.data?.profiles ?? []).map((p) => {
                const memberRole = dataQ.data?.roleMap.get(p.id) ?? "employee";
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => openEdit(p)}
                    className={isAdmin ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                  >
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-sm">{p.job_title ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{memberRole}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          p.is_active
                            ? "bg-success/10 text-success border-success/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {p.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editProfile && (
        <EditMemberModal
          profile={editProfile}
          currentRole={editRole}
          managers={managers}
          onClose={() => setEditProfile(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["team"] });
            qc.invalidateQueries({ queryKey: ["profiles"] });
            qc.invalidateQueries({ queryKey: ["assignable-people"] });
          }}
        />
      )}

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Create a manager or employee account. A temporary password will be generated once.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-name">Full name</Label>
              <Input
                id="member-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-title">Job title</Label>
              <Input
                id="member-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Account Executive"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as "manager" | "employee");
                  if (v === "manager") setManagerId("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "employee" && (
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={managerId} onValueChange={setManagerId} required>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={credsOpen}
        onOpenChange={(open) => {
          setCredsOpen(open);
          if (!open) setCreatedCreds(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Member created</DialogTitle>
            <DialogDescription>
              Share these credentials with the new member. The password is shown only once.
            </DialogDescription>
          </DialogHeader>
          {createdCreds && (
            <div className="rounded-md border bg-muted/40 p-4 font-mono text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">Email: </span>
                {createdCreds.email}
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                {createdCreds.temporaryPassword}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyCredentials}>
              <Copy className="mr-2 h-4 w-4" />
              Copy credentials
            </Button>
            <Button onClick={() => setCredsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
