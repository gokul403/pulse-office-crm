import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const [running, setRunning] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string; role: string }[] | null>(null);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Admin only.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your OfficeFlow workspace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Demo data
          </CardTitle>
          <CardDescription>
            Create one demo manager and three employees, then load a handful of sample tasks. Safe to run
            multiple times — it won't duplicate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={async () => {
              setRunning(true);
              try {
                const res = await api.post<any>("/team/seed");
                setCreds(res.credentials);
                toast.success("Demo data ready");
              } catch (e: any) {
                toast.error(e.message ?? "Could not seed");
              } finally {
                setRunning(false);
              }
            }}
            disabled={running}
          >
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Seed demo data
          </Button>

          {creds && (
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="mb-2 font-medium">Demo logins:</p>
              <ul className="space-y-1 font-mono text-xs">
                {creds.map((c) => (
                  <li key={c.email}>
                    {c.email} / {c.password} <span className="text-muted-foreground">({c.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
