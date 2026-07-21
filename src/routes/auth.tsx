import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2, Briefcase, ArrowLeft, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type AuthView = "sign-in" | "reset-verify" | "reset-new";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, login, resetPassword, verifyCredentials } = useAuth();

  const [view, setView] = useState<AuthView>("sign-in");
  const [submitting, setSubmitting] = useState(false);

  // Sign-in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Reset step 1
  const [resetEmail, setResetEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  // Reset step 2
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  function goToSignIn() {
    setView("sign-in");
    setResetEmail("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

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

  async function verifyIdentity(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const valid = await verifyCredentials(resetEmail, currentPassword);
      if (!valid) {
        toast.error("Invalid email or password");
        return;
      }
      setView("reset-new");
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(resetEmail, currentPassword, newPassword);
      toast.success("Password updated — please sign in with your new password");
      goToSignIn();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  }

  const cardMeta = {
    "sign-in":      { title: "Sign in",            description: "Improving productivity and collaboration across the organization." },
    "reset-verify": { title: "Reset password",      description: "Enter your email and current password to verify your identity." },
    "reset-new":    { title: "Choose new password", description: "Pick a strong password you haven't used before." },
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-primary/95 to-slate-950 p-12 text-primary-foreground md:flex">
        {/* Background Image / Overlay */}
        <div className="absolute inset-0 z-0 opacity-25 mix-blend-overlay">
          <img
            src="/auth-hero.png"
            alt="OfficeFlow Workspace backdrop"
            className="h-full w-full object-cover object-center scale-105"
          />
        </div>
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

        <div className="relative z-10 flex items-center gap-2 text-lg font-semibold tracking-wide">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">OfficeFlow</span>
        </div>

        <div className="relative z-10 my-auto py-6">
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-2 backdrop-blur-md shadow-2xl transition-all duration-300 hover:border-white/30 hover:bg-white/15">
            <img
              src="/auth-hero.png"
              alt="OfficeFlow AI Workspace"
              className="h-60 w-full rounded-xl object-cover object-center shadow-md"
            />
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-sm">
            Run your entire office<br />from one workspace.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-200/90">
            Tasks, CRM, finance and team performance — with role-based access for admins, managers, and employees.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-400">© Techxcore OfficeFlow CRM</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle className="text-3xl">{cardMeta[view].title}</CardTitle>
            <CardDescription>{cardMeta[view].description}</CardDescription>
          </CardHeader>

          <CardContent>

            {/* ── Sign in ── */}
            {view === "sign-in" && (
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" required placeholder="you@company.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password" type={showPassword ? "text" : "password"} required minLength={6}
                      className="pr-10"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button" onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <div className="text-center">
                  <button
                    type="button" onClick={() => setView("reset-verify")}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
                  >
                    Reset your password?
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 1: verify identity ── */}
            {view === "reset-verify" && (
              <form onSubmit={verifyIdentity} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email" type="email" required placeholder="you@company.com"
                    value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <div className="relative">
                    <Input
                      id="current-password" type={showCurrent ? "text" : "password"} required
                      className="pr-10"
                      value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <button
                      type="button" onClick={() => setShowCurrent((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify identity
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={goToSignIn}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Button>
              </form>
            )}

            {/* ── Step 2: new password ── */}
            {view === "reset-new" && (
              <form onSubmit={submitNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password" type={showNew ? "text" : "password"} required minLength={6}
                      className="pr-10"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button" onClick={() => setShowNew((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password" type={showConfirm ? "text" : "password"} required minLength={6}
                      className="pr-10"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button" onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update password
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={goToSignIn}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Button>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}