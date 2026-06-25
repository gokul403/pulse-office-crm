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
import { Plus, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

type Expense = {
  id: string;
  amount: number;
  category: string;
  vendor: string | null;
  description: string | null;
  spent_on: string;
  paid_by: string | null;
  created_at: string;
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "INR" });

function ExpensesPage() {
  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const canCreate = isAdmin || isManager;

  const q = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      return api.get<Expense[]>("/finance/expenses");
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

  const del = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = useMemo(() => (q.data ?? []).reduce((a, b) => a + Number(b.amount), 0), [q.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track every outgoing cost.</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New expense</Button>
            </DialogTrigger>
            <ExpenseFormDialog
              profiles={profilesQ.data ?? []}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["expenses"] });
              }}
            />
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/15 text-destructive">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total expenses</p>
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
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Paid by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!q.isLoading && (q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No expenses recorded.</TableCell></TableRow>
              )}
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{format(new Date(r.spent_on), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{r.category}</TableCell>
                  <TableCell className="text-sm">{r.vendor ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.paid_by ? profilesMap.get(r.paid_by) ?? "—" : "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{fmt.format(Number(r.amount))}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (confirm("Delete this expense?")) del.mutate(r.id); }}
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

function ExpenseFormDialog({ profiles, onDone }: { profiles: any[]; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amount: "", category: "", vendor: "", description: "",
    spent_on: today, paid_by: "none",
  });
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/finance/expenses", {
        amount: Number(form.amount),
        category: form.category.trim(),
        vendor: form.vendor || null,
        description: form.description || null,
        spent_on: form.spent_on,
        paid_by: form.paid_by === "none" ? null : form.paid_by,
      });
      toast.success("Expense recorded");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Could not record expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record expense</DialogTitle>
        <DialogDescription>Add a new outgoing cost.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ea">Amount *</Label>
            <Input id="ea" type="number" step="0.01" min="0" required
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es">Spent on *</Label>
            <Input id="es" type="date" required
              value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec">Category *</Label>
            <Input id="ec" required placeholder="Software, Travel…"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev">Vendor</Label>
            <Input id="ev" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Paid by</Label>
            <Select value={form.paid_by} onValueChange={(v) => setForm({ ...form, paid_by: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {(Array.isArray(profiles) ? profiles : []).filter((p) => p.is_active).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ed">Description</Label>
            <Textarea id="ed" rows={2}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || !form.amount || !form.category.trim()}>
            {submitting ? "Saving…" : "Record expense"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
