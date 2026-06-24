import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Briefcase, Copy } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@demo.com", password: "Admin1234!" },
  { role: "Manager", email: "manager@demo.com", password: "Manager1234!" },
  { role: "Employee 1", email: "employee1@demo.com", password: "Employee1234!" },
  { role: "Employee 2", email: "employee2@demo.com", password: "Employee1234!" },
  { role: "Employee 3", email: "employee3@demo.com", password: "Employee1234!" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  function fill(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-primary to-primary/70 p-12 text-primary-foreground md:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className="h-6 w-6" />
          OfficeFlow
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Run your entire office<br />from one workspace.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Tasks, CRM, finance and team performance — with role-based access for admins, managers, and
            employees.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">© OfficeFlow CRM</div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle className="text-3xl">Sign in</CardTitle>
            <CardDescription>
              improving productivity and collaboration across the organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-border/60 bg-muted/30 p-3">
              {/* <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Demo accounts
              </p> */}
              {/* <ul className="space-y-1">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.email}>
                    <button
                      type="button"
                      onClick={() => fill(a)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent"
                    >
                      <span className="font-medium">{a.role}</span>
                      <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                        {a.email}
                        <Copy className="h-3 w-3" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul> */}
              {/* <p className="mt-2 text-[11px] text-muted-foreground">
                Admin: <span className="font-mono">Admin1234!</span> · Manager:{" "}
                <span className="font-mono">Manager1234!</span> · Employees:{" "}
                <span className="font-mono">Employee1234!</span>
              </p> */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
