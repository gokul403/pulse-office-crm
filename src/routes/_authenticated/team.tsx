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

function TeamPage() {
  const { isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<"manager" | "employee">("employee");
  const [managerId, setManagerId] = useState("");

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
            {isAdmin ? "Manage roles and access for everyone." : "View your team."}
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
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(dataQ.data?.profiles ?? []).map((p) => {
                const memberRole = dataQ.data?.roleMap.get(p.id) ?? "employee";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-sm">{p.job_title ?? "—"}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={memberRole}
                          onValueChange={async (v) => {
                            setBusyId(p.id);
                            try {
                              await api.post("/team/role", { userId: p.id, role: v });
                              qc.invalidateQueries({ queryKey: ["team"] });
                              toast.success("Role updated");
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === p.id}
                        >
                          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="capitalize">{memberRole}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.is_active ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                        {p.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setBusyId(p.id);
                            try {
                              await api.post("/team/active", { userId: p.id, active: !p.is_active });
                              qc.invalidateQueries({ queryKey: ["team"] });
                              toast.success(p.is_active ? "User disabled" : "User activated");
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === p.id}
                        >
                          {p.is_active ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
