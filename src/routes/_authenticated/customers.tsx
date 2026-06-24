import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Search, Trash2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

const STATUSES = ["active", "inactive", "prospect"] as const;
type CStatus = (typeof STATUSES)[number];
const INTERACTION_TYPES = ["call", "email", "meeting", "note"] as const;
type ITypeT = (typeof INTERACTION_TYPES)[number];

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  status: CStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
};

function CustomersPage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [interactFor, setInteractFor] = useState<Customer | null>(null);
  const canCreate = isAdmin || isManager;

  const custQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,email,phone,company,address,status,notes,assigned_to,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
    enabled: !!user,
  });

  const profilesQ = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, is_active");
      return data ?? [];
    },
  });
  const profilesMap = useMemo(() => {
    const m = new Map<string, string>();
    (profilesQ.data ?? []).forEach((p: any) => m.set(p.id, p.full_name || p.email));
    return m;
  }, [profilesQ.data]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = custQ.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [custQ.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage active accounts and log every interaction.
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New customer</Button>
            </DialogTrigger>
            <CustomerFormDialog
              profiles={profilesQ.data ?? []}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["customers"] });
              }}
            />
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="pl-8"
            />
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
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custQ.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!custQ.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No customers yet.</TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm">{c.company ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email ?? "—"}
                    {c.phone && <div className="text-xs">{c.phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.assigned_to ? profilesMap.get(c.assigned_to) ?? "—" : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" title="Log interaction" onClick={() => setInteractFor(c)}>
                        <MessageSquarePlus className="h-4 w-4" />
                      </Button>
                      {canCreate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete customer "${c.name}"?`)) del.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!interactFor} onOpenChange={(o) => !o && setInteractFor(null)}>
        {interactFor && (
          <InteractionsDialog customer={interactFor} onClose={() => setInteractFor(null)} />
        )}
      </Dialog>
    </div>
  );
}

function CustomerFormDialog({ profiles, onDone }: { profiles: any[]; onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", address: "",
    status: "active" as CStatus, assigned_to: "unassigned", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      address: form.address || null,
      status: form.status,
      notes: form.notes || null,
      assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
      created_by: u.user?.id ?? null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New customer</DialogTitle>
        <DialogDescription>Add a new account to the workspace.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cn">Name *</Label>
            <Input id="cn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ce">Email</Label>
            <Input id="ce" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp">Phone</Label>
            <Input id="cp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cco">Company</Label>
            <Input id="cco" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ca">Address</Label>
            <Input id="ca" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Assign to</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles.filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cnotes">Notes</Label>
            <Textarea id="cnotes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !form.name.trim()}>
            {submitting ? "Saving…" : "Add customer"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function InteractionsDialog({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<ITypeT>("note");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const q = useQuery({
    queryKey: ["interactions", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_interactions")
        .select("id,type,summary,created_at,created_by")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_interactions").insert({
      customer_id: customer.id,
      type,
      summary: summary.trim(),
      created_by: u.user?.id ?? null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setSummary("");
    qc.invalidateQueries({ queryKey: ["interactions", customer.id] });
    toast.success("Interaction logged");
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{customer.name}</DialogTitle>
        <DialogDescription>Interaction history</DialogDescription>
      </DialogHeader>
      <form onSubmit={add} className="space-y-2 border-b pb-4">
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as ITypeT)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What happened?"
            className="flex-1"
          />
          <Button type="submit" disabled={submitting || !summary.trim()}>Log</Button>
        </div>
      </form>
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && (q.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
        )}
        {(q.data ?? []).map((i: any) => (
          <div key={i.id} className="rounded-md border p-3">
            <div className="mb-1 flex items-center justify-between">
              <Badge variant="outline" className="capitalize">{i.type}</Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(i.created_at), "MMM d, yyyy HH:mm")}
              </span>
            </div>
            <p className="text-sm">{i.summary}</p>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
}
