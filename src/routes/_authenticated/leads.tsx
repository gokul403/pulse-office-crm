import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Plus, Search, Trash2, ChevronLeft, Calendar as CalendarIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
type LeadStatus = (typeof STATUSES)[number];

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
};

function statusBadge(s: LeadStatus) {
  const cls: Record<LeadStatus, string> = {
    new: "bg-primary/15 text-primary border-primary/30",
    contacted: "bg-warning/15 text-warning-foreground border-warning/30",
    qualified: "bg-primary/15 text-primary border-primary/30",
    proposal: "bg-warning/15 text-warning-foreground border-warning/30",
    won: "bg-success/15 text-success border-success/30",
    lost: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cls[s]}>{s}</Badge>;
}

function LeadsPage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const canCreate = !!user;
  const canDelete = isAdmin || isManager;

  const leadsQ = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      return api.get<Lead[]>("/leads");
    },
    enabled: !!user,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      return api.get<any[]>("/profiles");
    },
  });

  const profilesMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p: any) => m.set(p.id, p.full_name || p.email));
    return m;
  }, [profilesQ.data]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      await api.put(`/leads/${id}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leads/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = leadsQ.data ?? [];
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company ?? "").toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [leadsQ.data, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads & Enquiries</h1>
          <p className="text-sm text-muted-foreground">
            Track every incoming opportunity from first contact to close.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button onClick={() => { setEditingLead(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> New lead
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingLead(null); }}>
              <LeadFormDialog
                key={editingLead?.id || "new"}
                lead={editingLead}
                profiles={profilesQ.data ?? []}
                onDone={() => {
                  setOpen(false);
                  setEditingLead(null);
                  qc.invalidateQueries({ queryKey: ["leads"] });
                }}
              />
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, company, email…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsQ.isLoading && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!leadsQ.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No leads yet.</TableCell></TableRow>
              )}
              {filtered.map((l) => (
                <TableRow key={l.id}
                  onClick={() => {
                    setEditingLead(l);
                    setOpen(true);
                  }}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-sm">{l.company ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.email ?? "—"}
                    {l.phone && <div className="text-xs">{l.phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{l.source ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {l.assigned_to ? profilesMap.get(l.assigned_to) ?? "—" : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={l.status}
                      onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as LeadStatus })}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue>{statusBadge(l.status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(l.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete lead "${l.name}"?`)) del.mutate(l.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatLocalDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function LeadFormDialog({
  lead,
  profiles,
  onDone,
}: {
  lead?: Lead | null;
  profiles: any[];
  onDone: () => void;
}) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    company: lead?.company || "",
    source: lead?.source || "",
    notes: lead?.notes || "",
    assigned_to: lead ? (lead.assigned_to || "unassigned") : (user?.id || "unassigned"),
    status: lead?.status || ("new" as LeadStatus),
    interested_product: lead?.interested_product || "",
    possibility: lead?.possibility || "",
    followup_date: lead?.followup_date ? formatLocalDatetime(lead.followup_date) : "",
    expected_revenue: lead?.expected_revenue != null ? String(lead.expected_revenue) : "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState<Date | undefined>(undefined);
  const [tempHour, setTempHour] = useState("09");
  const [tempMinute, setTempMinute] = useState("00");
  const [tempAmPm, setTempAmPm] = useState("AM");

  const initPicker = () => {
    setPickerStep("date");
    if (form.followup_date) {
      const d = new Date(form.followup_date);
      if (!isNaN(d.getTime())) {
        setTempDate(d);
        let h = d.getHours();
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12;
        if (h === 0) h = 12;
        setTempHour(String(h).padStart(2, "0"));
        setTempMinute(String(d.getMinutes()).padStart(2, "0"));
        setTempAmPm(ampm);
        return;
      }
    }
    setTempDate(undefined);
    setTempHour("09");
    setTempMinute("00");
    setTempAmPm("AM");
  };

  function combineDateTime(date: Date | undefined, hour: string, minute: string, ampm: string): string {
    if (!date) return "";
    const d = new Date(date);
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    d.setHours(h, parseInt(minute, 10), 0, 0);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        source: form.source || null,
        notes: form.notes || null,
        status: form.status,
        assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
        interested_product: form.interested_product || null,
        possibility: form.possibility || null,
        followup_date: form.followup_date ? new Date(form.followup_date).toISOString() : null,
        expected_revenue: form.expected_revenue ? parseFloat(form.expected_revenue) : null,
      };

      if (lead) {
        await api.put(`/leads/${lead.id}`, payload);
        toast.success("Lead updated");
      } else {
        await api.post("/leads", payload);
        toast.success("Lead created");
      }
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? (lead ? "Could not update lead" : "Could not create lead"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
        <DialogDescription>
          {lead ? "Modify lead details and preferences." : "Capture a new enquiry or opportunity."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ln">Name *</Label>
            <Input id="ln" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="le">Email</Label>
            <Input id="le" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lp">Phone</Label>
            <Input id="lp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc">Company</Label>
            <Input id="lc" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ls">Source</Label>
            <Input id="ls" placeholder="Website, Referral…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(Array.isArray(profiles) ? profiles : []).filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Interested Product</Label>
            <Select
              value={form.interested_product || undefined}
              onValueChange={(v) => setForm({ ...form, interested_product: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Product" />
              </SelectTrigger>
              <SelectContent>
                {["LMS", "HRMS", "Therapy", "Custom Product"].map((prod) => (
                  <SelectItem key={prod} value={prod}>{prod}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Possibility</Label>
            <Select
              value={form.possibility || undefined}
              onValueChange={(v) => setForm({ ...form, possibility: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Possibility" />
              </SelectTrigger>
              <SelectContent>
                {["High", "Medium", "Low"].map((poss) => (
                  <SelectItem key={poss} value={poss}>{poss}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="lnotes">Notes</Label>
            <Textarea id="lnotes" placeholder="Add details or logs about the initial call/enquiry…" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <Label>Follow-up Date & Time</Label>
            <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (open) initPicker(); }}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal h-9 bg-background border-input hover:bg-accent/50 text-foreground">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {form.followup_date ? (
                    format(new Date(form.followup_date), "MMM d, yyyy h:mm a")
                  ) : (
                    <span className="text-muted-foreground text-xs">Select date & time</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {pickerStep === "date" ? (
                  <Calendar
                    mode="single"
                    selected={tempDate}
                    onSelect={(date) => {
                      if (date) {
                        setTempDate(date);
                      }
                      setPickerStep("time");
                    }}
                    initialFocus
                  />) : (
                  <div className="p-3 w-[260px] bg-background">
                    <style>{`
                      .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                      }
                    `}</style>
                    <div className="flex items-center gap-2 border-b pb-2 mb-2">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerStep("date")}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-semibold text-sm">Select Time</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Hour column */}
                      <div
                        className="flex flex-col gap-1 border rounded-md p-1 h-40 overflow-y-auto scroll-smooth hide-scrollbar"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                      >
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground text-center font-bold pb-1 border-b bg-background sticky top-0">Hour</div>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                          <button
                            key={h}
                            type="button"
                            className={cn(
                              "text-xs py-1 rounded transition-colors text-center font-medium shrink-0",
                              tempHour === h ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"
                            )}
                            onClick={() => setTempHour(h)}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                      {/* Minute column */}
                      <div
                        className="flex flex-col gap-1 border rounded-md p-1 h-40 overflow-y-auto scroll-smooth hide-scrollbar"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                      >
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground text-center font-bold pb-1 border-b bg-background sticky top-0">Min</div>
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={cn(
                              "text-xs py-1 rounded transition-colors text-center font-medium shrink-0",
                              tempMinute === m ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"
                            )}
                            onClick={() => setTempMinute(m)}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      {/* AM/PM column */}
                      <div className="flex flex-col gap-1 border rounded-md p-1 h-40">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground text-center font-bold pb-1 border-b bg-background sticky top-0">Period</div>
                        {["AM", "PM"].map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={cn(
                              "text-xs py-2 rounded transition-colors text-center font-medium shrink-0",
                              tempAmPm === p ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"
                            )}
                            onClick={() => setTempAmPm(p)}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full mt-3 h-8 text-xs font-semibold"
                      onClick={() => {
                        const final = combineDateTime(tempDate, tempHour, tempMinute, tempAmPm);
                        setForm({ ...form, followup_date: final });
                        setPickerOpen(false);
                      }}
                    >
                      Confirm Time
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ler">Expected Revenue (INR)</Label>
            <Input id="ler" type="number" min="0" placeholder="e.g. 50000" value={form.expected_revenue} onChange={(e) => setForm({ ...form, expected_revenue: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !form.name.trim()}>
            {submitting ? "Saving…" : lead ? "Update lead" : "Create lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
