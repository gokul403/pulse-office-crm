import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leaves/")({
  component: LeavesPage,
});

type Leave = {
  id: string;
  profile_id: string;
  employee_name: string | null;
  employee_email: string | null;
  start_date: string;
  end_date: string;
  leave_type: "annual" | "sick" | "unpaid" | "wfh" | "other";
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_name: string | null;
  actioned_at: string | null;
  created_at: string;
};

function LeavesPage() {
  const qc = useQueryClient();

  // Dialog & Form states
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<Leave["leave_type"]>("annual");
  const [reason, setReason] = useState("");

  const leavesQ = useQuery<Leave[]>({
    queryKey: ["leaves"],
    queryFn: () => api.get("/leaves"), // Returns only current user's leaves on backend without filter=all
  });

  const applyMutation = useMutation({
    mutationFn: (body: any) => api.post("/leaves", body),
    onSuccess: () => {
      toast.success("Leave application submitted successfully!");
      qc.invalidateQueries({ queryKey: ["leaves"] });
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to apply for leave");
    },
  });

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setLeaveType("annual");
    setReason("");
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !leaveType) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date cannot be before start date.");
      return;
    }
    applyMutation.mutate({
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
      reason: reason || null,
    });
  };

  const getLeaveTypeBadge = (type: Leave["leave_type"]) => {
    const maps = {
      annual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      sick: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
      unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      wfh: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Leaves</h1>
          <p className="text-muted-foreground text-sm">
            Apply for leaves and track your approval status.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="flex items-center gap-1.5 shadow-md">
          <Plus className="h-4 w-4" /> Apply Leave
        </Button>
      </div>

      {leavesQ.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>My Leave History</CardTitle>
            <CardDescription>Track all of your leave applications and their current status.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {leavesQ.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground italic">You haven't applied for any leaves yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leavesQ.data?.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-semibold">{getLeaveTypeBadge(leave.leave_type)}</TableCell>
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
      )}

      {/* Apply Leave Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a new leave request for review and approval.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApply} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type</Label>
              <Select value={leaveType} onValueChange={(val: any) => setLeaveType(val)}>
                <SelectTrigger id="leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="wfh">Work From Home</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Comments</Label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you taking leave? (Optional)"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={applyMutation.isPending}>
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
