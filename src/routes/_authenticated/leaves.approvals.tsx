import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leaves/approvals")({
  component: LeaveApprovalsPage,
});

type Leave = {
  id: string;
  profile_id: string;
  employee_name: string | null;
  employee_email: string | null;
  start_date: string;
  end_date: string;
  leave_type: "annual" | "sick" | "unpaid" | "other";
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_name: string | null;
  actioned_at: string | null;
  created_at: string;
};

function LeaveApprovalsPage() {
  const { user, loading, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isManagerOrAdmin = isAdmin || isManager;

  // Redirect if not authorized
  useEffect(() => {
    if (!loading && user && !isManagerOrAdmin) {
      toast.error("Access Denied: Only managers and admins can access leave approvals.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, isManagerOrAdmin, navigate]);

  const leavesQ = useQuery<Leave[]>({
    queryKey: ["leaves-all"],
    queryFn: () => api.get("/leaves?filter=all"),
    enabled: isManagerOrAdmin,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) =>
      api.put(`/leaves/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      toast.success(`Leave request ${variables.status} successfully!`);
      qc.invalidateQueries({ queryKey: ["leaves-all"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update leave status");
    },
  });

  const getLeaveTypeBadge = (type: Leave["leave_type"]) => {
    const maps = {
      annual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      sick: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
      unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      other: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    };
    return <Badge className={`capitalize ${maps[type]}`}>{type}</Badge>;
  };

  const getStatusBadge = (status: Leave["status"]) => {
    const maps = {
      pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
      rejected: "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400",
    };
    return <Badge className={`capitalize ${maps[status]}`}>{status}</Badge>;
  };

  if (loading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-2" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">
          Only managers and admins can approve or reject leaves.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Approvals</h1>
        <p className="text-muted-foreground text-sm">
          Review, approve, and reject workspace leave applications.
        </p>
      </div>

      {leavesQ.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">Pending Requests</TabsTrigger>
            <TabsTrigger value="history">All Leave History</TabsTrigger>
          </TabsList>

          {/* Pending requests */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Review and action pending leave requests in the workspace.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {leavesQ.data?.filter((l) => l.status === "pending").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground/60 mb-2" />
                    <p className="text-sm text-muted-foreground italic">No pending leave requests!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Leave Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-[180px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leavesQ.data
                          ?.filter((l) => l.status === "pending")
                          .map((leave) => (
                            <TableRow key={leave.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{leave.employee_name || "Unknown User"}</span>
                                  <span className="text-xs text-muted-foreground">{leave.employee_email}</span>
                                </div>
                              </TableCell>
                              <TableCell>{getLeaveTypeBadge(leave.leave_type)}</TableCell>
                              <TableCell className="text-xs">
                                <div>
                                  {format(new Date(leave.start_date), "MMM d, yyyy")} –{" "}
                                  {format(new Date(leave.end_date), "MMM d, yyyy")}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                {leave.reason || "—"}
                              </TableCell>
                              <TableCell className="text-right flex items-center justify-end gap-2 pt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                  onClick={() => actionMutation.mutate({ id: leave.id, status: "approved" })}
                                  disabled={actionMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                  onClick={() => actionMutation.mutate({ id: leave.id, status: "rejected" })}
                                  disabled={actionMutation.isPending}
                                >
                                  Reject
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
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Leave History</CardTitle>
                <CardDescription>Historical archive of all leave applications in the workspace.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {leavesQ.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-6 text-center">No leave logs found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Leave Type</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actioned By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leavesQ.data?.map((leave) => (
                          <TableRow key={leave.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{leave.employee_name || "Unknown User"}</span>
                                <span className="text-xs text-muted-foreground">{leave.employee_email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getLeaveTypeBadge(leave.leave_type)}</TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(leave.start_date), "MMM d, yyyy")} –{" "}
                              {format(new Date(leave.end_date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {leave.reason || "—"}
                            </TableCell>
                            <TableCell>{getStatusBadge(leave.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {leave.reviewer_name || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
