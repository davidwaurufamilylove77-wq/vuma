import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

const schema = z.object({
  password: z.string().min(8, "At least 8 characters").max(100),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  const sessionReadyRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionReadyRef.current = true;
        setSessionReady(true);
      }
    });
    const t = setTimeout(() => {
      if (!sessionReadyRef.current) setSessionError(true);
    }, 5000);
    return () => { clearTimeout(t); subscription.unsubscribe(); };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — please sign in");
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <LogoLink />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          {sessionError && !sessionReady ? (
            <div className="text-center">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <h1 className="mt-4 text-xl font-bold">Link expired</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This reset link has expired or already been used. Request a new one.
              </p>
              <Link to="/forgot-password" className="mt-6 inline-block">
                <Button className="bg-gradient-primary text-primary-foreground">Request new link</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Security</span>
              </div>
              <h1 className="text-2xl font-bold">Set new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !sessionReady}
                  className="w-full bg-gradient-primary text-primary-foreground"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {!sessionReady ? "Verifying link…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
