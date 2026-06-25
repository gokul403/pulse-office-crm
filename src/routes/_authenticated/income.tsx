import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/income")({
  component: IncomePage,
});

type IncomeRow = {
  id: string;
  amount: number;
  source: string;
  category: string | null;
  description: string | null;
  customer_id: string | null;
  received_on: string;
  created_at: string;
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "INR" });

function IncomePage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const canCreate = isAdmin || isManager;

  const q = useQuery({
    queryKey: ["income"],
    queryFn: async () => {
      return api.get<IncomeRow[]>("/finance/income");
    },
    enabled: !!user,
  });

  const custQ = useQuery({
    queryKey: ["customers-min"],
    queryFn: async () => {
      return api.get<any[]>("/customers");
    },
  });
  const custMap = useMemo(() => {
    const m = new Map<string, string>();
    (custQ.data ?? []).forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [custQ.data]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/finance/income/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["income"] });
      toast.success("Income entry deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = useMemo(() => (q.data ?? []).reduce((a, b) => a + Number(b.amount), 0), [q.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground">All revenue received, by date.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New income</Button>
            </DialogTrigger>
            <IncomeFormDialog
              customers={custQ.data ?? []}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["income"] });
              }}
            />
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/15 text-success">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total income</p>
            <p className="text-2xl font-semibold">{fmt.format(total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!q.isLoading && (q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No income recorded.</TableCell></TableRow>
              )}
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{format(new Date(r.received_on), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-sm">{r.customer_id ? custMap.get(r.customer_id) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-sm">{r.category ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{fmt.format(Number(r.amount))}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (confirm("Delete this entry?")) del.mutate(r.id); }}
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

function IncomeFormDialog({ customers, onDone }: { customers: any[]; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: "", source: "", category: "", description: "",
    customer_id: "none", received_on: today,
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/finance/income", {
        amount: Number(form.amount),
        source: form.source.trim(),
        category: form.category || null,
        description: form.description || null,
        customer_id: form.customer_id === "none" ? null : form.customer_id,
        received_on: form.received_on,
      });
      toast.success("Income recorded");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Could not record income");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record income</DialogTitle>
        <DialogDescription>Add a payment or revenue entry.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ia">Amount *</Label>
            <Input id="ia" type="number" step="0.01" min="0" required
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ir">Received on *</Label>
            <Input id="ir" type="date" required
              value={form.received_on} onChange={(e) => setForm({ ...form, received_on: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="is">Source *</Label>
            <Input id="is" required placeholder="Stripe, Bank transfer…"
              value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ic">Category</Label>
            <Input id="ic" placeholder="Services, License…"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="id">Description</Label>
            <Textarea id="id" rows={2}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !form.amount || !form.source.trim()}>
            {submitting ? "Saving…" : "Record income"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
