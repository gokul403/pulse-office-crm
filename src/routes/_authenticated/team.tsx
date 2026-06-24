import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";

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

function TeamPage() {
  const { isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const dataQ = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const res = await api.get<{ profiles: Profile[]; roles: { user_id: string; role: string }[] }>("/team");
      const roleMap = new Map<string, string>();
      (res.roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      return { profiles: res.profiles, roleMap };
    },
  });

  if (!isAdmin && !isManager) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Manage roles and access for everyone." : "View your team."}
        </p>
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
                const role = dataQ.data?.roleMap.get(p.id) ?? "employee";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-sm">{p.job_title ?? "—"}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={role}
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
                        <Badge variant="outline" className="capitalize">{role}</Badge>
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
    </div>
  );
}
