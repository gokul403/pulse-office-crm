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
import { Copy, Loader2, UserPlus, Mail, Phone, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  phone: string | null;
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
  const [email, setEmail] = useState(profile.email ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [role, setRole] = useState(currentRole);
  const [isActive, setIsActive] = useState(profile.is_active);
  const [saving, setSaving] = useState(false);

  const roleChanged = role !== currentRole;
  const activeChanged = isActive !== profile.is_active;
  const profileChanged =
    email.trim().toLowerCase() !== (profile.email ?? "").toLowerCase() ||
    fullName !== (profile.full_name ?? "") ||
    jobTitle !== (profile.job_title ?? "") ||
    phone !== (profile.phone ?? "");

  const isDirty = roleChanged || activeChanged || profileChanged;

  async function handleSave() {
    setSaving(true);
    try {
      const requests: Promise<unknown>[] = [];

      if (profileChanged) {
        requests.push(
          api.post(`/team/update-member/${profile.id}`, {
            email: email.trim() || undefined,
            fullName: fullName || undefined,
            jobTitle: jobTitle || undefined,
            phone: phone || undefined,
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
          <DialogDescription>Update team member profile and permissions</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

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
            <Label htmlFor="edit-phone">Phone (WhatsApp)</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91XXXXXXXXXX"
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
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [managerId, setManagerId] = useState("");
  
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

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

  const filteredProfiles = useMemo(() => {
    const profiles = dataQ.data?.profiles ?? [];
    const roleMap = dataQ.data?.roleMap ?? new Map<string, string>();
    return profiles.filter((p) => {
      const memberRole = roleMap.get(p.id) ?? "employee";
      const matchesSearch =
        (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        (p.job_title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || memberRole === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [dataQ.data, search, roleFilter]);

  function resetForm() {
    setEmail("");
    setFullName("");
    setJobTitle("");
    setPhone("");
    setRole("employee");
    setManagerId("");
  }

  function openEdit(profile: Profile) {
    if (!isAdmin) return;
    setEditProfile(profile);
    setEditRole(dataQ.data?.roleMap?.get(profile.id) ?? "employee");
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
        phone: phone || undefined,
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

  const roleGradients: Record<string, string> = {
    admin: "from-rose-500 via-pink-500 to-red-500",
    manager: "from-amber-500 via-orange-500 to-yellow-500",
    employee: "from-indigo-500 via-violet-500 to-purple-500",
  };

  const roleClasses: Record<string, string> = {
    admin: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    manager: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    employee: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Manage team member accounts and roles."
              : isManager
                ? "View your team."
                : "View all team members."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        )}
      </div>

      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/40 focus-visible:ring-indigo-500/20"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="bg-card/50 border-border/40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredProfiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/60 rounded-2xl bg-card/20 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground font-semibold">No team members found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProfiles.map((p) => {
            const memberRole = dataQ.data?.roleMap?.get(p.id) ?? "employee";
            const initials = p.full_name
              ? p.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              : p.email.charAt(0).toUpperCase();

            return (
              <Card
                key={p.id}
                className="group relative flex flex-col justify-between overflow-hidden border border-border/40 bg-card/65 p-6 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-500/20"
              >
                <div className="space-y-4">
                  {/* Top: Avatar & Meta */}
                  <div className="flex items-start gap-4">
                    <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${roleGradients[memberRole] ?? "from-gray-500 to-slate-600"} text-white font-black text-lg shadow-md`}>
                      {initials}
                      <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background ${p.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className="truncate font-bold text-foreground text-sm tracking-tight leading-snug group-hover:text-primary transition-colors">
                          {p.full_name ?? "—"}
                        </h3>
                      </div>
                      <p className="truncate text-xs font-semibold text-muted-foreground mt-0.5">{p.job_title ?? "Team Member"}</p>
                      
                      <Badge variant="outline" className={`capitalize px-2 py-0.5 text-[9px] font-bold border mt-1.5 ${roleClasses[memberRole]}`}>
                        {memberRole}
                      </Badge>
                    </div>
                  </div>

                  {/* Middle: Contact details */}
                  <div className="space-y-2 pt-4 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="truncate select-all">{p.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="truncate select-all">{p.phone ?? "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom: Actions */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40/30 mt-4">
                  <div className="flex items-center gap-1">
                    {p.phone && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 shrink-0" asChild>
                        <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-500 shrink-0" asChild>
                      <a href={`mailto:${p.email}`}>
                        <Mail className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-500 rounded-lg px-2.5" onClick={() => openEdit(p)}>
                      Manage
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
              <Label htmlFor="member-phone">Phone (WhatsApp)</Label>
              <Input
                id="member-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
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
