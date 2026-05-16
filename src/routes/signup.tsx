import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo, LogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import {
  Loader2, Wallet, User as UserIcon, Search, ShieldCheck,
  CheckCircle2, ArrowRight, Building2, AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (s: Record<string, unknown>) => ({
    role: (s.role as string) === "treasurer" ? "treasurer" : "member",
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
});

const baseSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().regex(/^(?:\+?254|0)\d{9}$/, "Use 0712345678 or +254712345678"),
  password: z.string().min(8, "At least 8 characters").max(100),
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const search = useSearch({ from: "/signup" });
  const [role, setRole] = useState<"treasurer" | "member">(search.role);
  const [step, setStep] = useState<1 | 2>(search.invite ? 1 : 1); // step 2 = chama context
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);

  // Account fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Member chama search
  const [chamaName, setChamaName] = useState("");
  const [chamaCheck, setChamaCheck] = useState<
    | { state: "idle" }
    | { state: "checking" }
    | { state: "found"; id: string; name: string; member_count: number }
    | { state: "not_found" }
  >({ state: "idle" });

  // Treasurer chama creation
  const [newChamaName, setNewChamaName] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("0");

  // Invite preview
  const [invitePreview, setInvitePreview] = useState<{ chama_name: string; valid: boolean } | null>(null);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  useEffect(() => {
    if (!search.invite) return;
    (async () => {
      const { data } = await supabase.rpc("preview_chama_invite", { _token: search.invite! });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setInvitePreview({ chama_name: row.chama_name, valid: row.valid });
    })();
  }, [search.invite]);

  const lookupChama = async () => {
    if (chamaName.trim().length < 2) {
      toast.error("Enter a chama name");
      return;
    }
    setChamaCheck({ state: "checking" });
    const { data, error } = await supabase.rpc("find_chama_by_name", { _name: chamaName });
    if (error) {
      setChamaCheck({ state: "idle" });
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row) setChamaCheck({ state: "not_found" });
    else setChamaCheck({ state: "found", id: row.id, name: row.name, member_count: Number(row.member_count) });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { toast.error("Please accept the Terms & Privacy Policy"); return; }
    const parsed = baseSchema.safeParse({ fullName, email, phone, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }

    // Member: must have either valid invite or a found chama
    if (role === "member" && !search.invite) {
      if (chamaCheck.state !== "found") {
        toast.error("Please search and confirm your chama first");
        return;
      }
    }
    if (role === "member" && search.invite && invitePreview && !invitePreview.valid) {
      toast.error("This invite link is no longer valid");
      return;
    }
    if (role === "treasurer" && newChamaName.trim().length < 2) {
      toast.error("Enter a name for your chama");
      return;
    }

    setLoading(true);
    const normalizedPhone = parsed.data.phone.startsWith("+")
      ? parsed.data.phone.slice(1)
      : parsed.data.phone.startsWith("0") ? "254" + parsed.data.phone.slice(1) : parsed.data.phone;

    const { data: signUp, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: parsed.data.fullName,
          phone: normalizedPhone,
          signup_role: role,
        },
      },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }

    // If session is active immediately, finalize chama linkage
    if (signUp.session) {
      try {
        if (role === "treasurer") {
          const { data: chama, error: cErr } = await supabase
            .from("chamas")
            .insert({
              name: newChamaName.trim(),
              monthly_target: Number(monthlyTarget) || 0,
              created_by: signUp.user!.id,
            })
            .select().single();
          if (cErr) throw cErr;
          await supabase.from("chama_members").insert({
            chama_id: chama.id, user_id: signUp.user!.id, role: "treasurer",
          });
        } else if (search.invite) {
          await supabase.rpc("accept_chama_invite", { _token: search.invite });
        } else if (chamaCheck.state === "found") {
          await supabase.rpc("join_chama_by_name", { _name: chamaCheck.name });
        }
      } catch (err: any) {
        toast.error("Account created but setup failed: " + err.message);
      }
    }

    setLoading(false);
    toast.success(signUp.session ? "Welcome to VUMA!" : "Check your email to verify your account");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <LogoLink />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-57px)] max-w-7xl gap-0 lg:grid-cols-2">
        {/* Marketing panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-hero p-10 lg:flex">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-info/15 blur-3xl" />
          <div className="relative">
            <Logo className="h-10 w-10" />
            <h2 className="mt-8 text-3xl font-bold tracking-tight">Smart. Simple. Transparent.</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Join thousands of chamas managing contributions, loans, and meetings on Kenya's most trusted financial platform.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "M-Pesa STK push & instant verification",
                "Real-time contribution tracking",
                "Treasurer-led member onboarding",
                "Audit-ready records, end-to-end",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative grid grid-cols-3 gap-3 text-sm">
            <Stat label="Chamas" value="2,500+" />
            <Stat label="Contributions" value="KES 128M" />
            <Stat label="Uptime" value="99.9%" />
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex items-start justify-center px-4 py-8 sm:px-8 lg:py-14">
          <div className="w-full max-w-md">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Create account</div>
            <h1 className="text-2xl font-bold tracking-tight">
              {search.invite ? "Join your chama" : "Get started with VUMA"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.invite
                ? invitePreview?.chama_name
                  ? <>You've been invited to join <span className="font-semibold text-foreground">{invitePreview.chama_name}</span></>
                  : "Validating your invite…"
                : "Choose how you'll use VUMA. You can switch chamas later."}
            </p>

            {/* Role tabs (hidden when joining via invite) */}
            {!search.invite && (
              <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-1.5">
                <RoleTab
                  active={role === "member"}
                  onClick={() => setRole("member")}
                  icon={UserIcon} title="Member"
                  desc="Join an existing chama"
                />
                <RoleTab
                  active={role === "treasurer"}
                  onClick={() => setRole("treasurer")}
                  icon={Wallet} title="Treasurer"
                  desc="Create & manage a chama"
                />
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* Step: account details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" required />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters</p>
              </Field>

              {/* Role-specific section */}
              {role === "treasurer" && (
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-primary" /> Your chama
                  </div>
                  <div className="space-y-3">
                    <Field label="Chama name">
                      <Input value={newChamaName} onChange={(e) => setNewChamaName(e.target.value)} placeholder="e.g. Umoja Savings" />
                    </Field>
                    <Field label="Monthly target (KES)">
                      <Input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} />
                    </Field>
                  </div>
                </div>
              )}

              {role === "member" && !search.invite && (
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Search className="h-4 w-4 text-primary" /> Find your chama
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={chamaName}
                      placeholder="Type chama name exactly…"
                      onChange={(e) => { setChamaName(e.target.value); setChamaCheck({ state: "idle" }); }}
                    />
                    <Button type="button" variant="outline" onClick={lookupChama} disabled={chamaCheck.state === "checking"}>
                      {chamaCheck.state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                  {chamaCheck.state === "found" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      <div>
                        <p className="font-semibold">{chamaCheck.name}</p>
                        <p className="text-xs text-muted-foreground">{chamaCheck.member_count} member(s) · You'll join as a member</p>
                      </div>
                    </div>
                  )}
                  {chamaCheck.state === "not_found" && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                      <div>
                        <p className="font-semibold text-destructive">Chama does not exist</p>
                        <p className="text-xs text-muted-foreground">Please contact your treasurer for the exact chama name or an invite link.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {search.invite && invitePreview && !invitePreview.valid && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Invite link expired</p>
                    <p className="text-xs text-muted-foreground">Ask your treasurer for a new link.</p>
                  </div>
                </div>
              )}

              {/* Terms */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/20 p-3 text-sm">
                <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
                <span className="text-muted-foreground">
                  I agree to VUMA's{" "}
                  <a href="#" className="font-semibold text-primary hover:underline">Terms of Service</a>{" "}
                  and{" "}
                  <a href="#" className="font-semibold text-primary hover:underline">Privacy Policy</a>.
                </span>
              </label>

              <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-elegant">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create my account
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Bank-grade encryption · ISO-aligned
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RoleTab({
  active, onClick, icon: Icon, title, desc,
}: { active: boolean; onClick: () => void; icon: any; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg p-3 text-left transition ${
        active ? "bg-card shadow-sm ring-1 ring-primary/30" : "hover:bg-card/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/70 p-3 backdrop-blur">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-bold">{value}</div>
    </div>
  );
}
