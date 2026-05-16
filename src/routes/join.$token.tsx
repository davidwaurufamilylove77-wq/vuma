import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo, LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Loader2, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$token")({ component: JoinPage });

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<
    | { state: "loading" }
    | { state: "valid"; chama_name: string }
    | { state: "invalid" | "expired" }
  >({ state: "loading" });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("preview_chama_invite", { _token: token });
      const row = Array.isArray(data) && data.length ? data[0] : null;
      if (error || !row) return setPreview({ state: "invalid" });
      setPreview(row.valid ? { state: "valid", chama_name: row.chama_name } : { state: "expired" });
    })();
  }, [token]);

  const accept = async () => {
    setJoining(true);
    const { data, error } = await supabase.rpc("accept_chama_invite", { _token: token });
    setJoining(false);
    if (error) return toast.error(error.message);
    const status = (data as any)?.status;
    if (status === "joined" || status === "already_member") {
      toast.success("Joined chama");
      navigate({ to: "/dashboard" });
    } else {
      toast.error("Invite is no longer valid");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <LogoLink />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 shadow-elegant">
          <div className="flex justify-center"><Logo className="h-10 w-10" /></div>

          {preview.state === "loading" && (
            <div className="mt-6 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">Validating invite…</p>
            </div>
          )}

          {(preview.state === "invalid" || preview.state === "expired") && (
            <div className="mt-6 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="mt-4 text-xl font-bold">
                {preview.state === "expired" ? "Invite expired" : "Invalid invite"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Please request a new invite link from your treasurer.
              </p>
              <Link to="/" className="mt-6 inline-block">
                <Button variant="outline">Go home</Button>
              </Link>
            </div>
          )}

          {preview.state === "valid" && (
            <div className="mt-6 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <Users className="h-6 w-6 text-success" />
              </div>
              <h1 className="mt-4 text-xl font-bold">You've been invited</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Join <span className="font-semibold text-foreground">{preview.chama_name}</span> on VUMA.
              </p>

              {!authLoading && user && (
                <Button onClick={accept} disabled={joining} className="mt-6 w-full bg-gradient-primary text-primary-foreground">
                  {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Accept & join chama
                </Button>
              )}
              {!authLoading && !user && (
                <div className="mt-6 space-y-2">
                  <Link to="/signup" search={{ role: "member", invite: token }}>
                    <Button className="w-full bg-gradient-primary text-primary-foreground">Sign up to join</Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" className="w-full">Already have an account? Sign in</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
