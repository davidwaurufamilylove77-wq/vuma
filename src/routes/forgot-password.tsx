import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <LogoLink />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <MailCheck className="h-7 w-7 text-success" />
              </div>
              <h1 className="mt-4 text-xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a password reset link to <span className="font-semibold text-foreground">{email}</span>.
                Check your inbox and follow the link.
              </p>
              <Link to="/login" className="mt-6 inline-block">
                <Button variant="outline">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Forgot password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
              </p>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
