import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoLink } from "@/components/logo";
import {
  Shield, Sparkles, Users, TrendingUp, FileSearch, Zap,
  CheckCircle2, ArrowRight, BarChart3, Wallet, Bell, Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <LogoLink />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
            <a href="#dashboards" className="text-muted-foreground hover:text-foreground">Dashboards</a>
            <a href="#how" className="text-muted-foreground hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/signup"><Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-elegant">Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-2 md:py-28 sm:px-6">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> One platform. Four dashboards.
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Total financial<br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">transparency</span> for chamas.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Manage chamas, track contributions, run campaigns, and empower members.
              Real-time sync, OCR-powered imports, and audit-ready records.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-elegant">
                  Start free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">See features</Button>
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <Trust icon={Shield} label="Audit-ready" />
              <Trust icon={Lock} label="Bank-grade security" />
              <Trust icon={Zap} label="Real-time sync" />
            </div>
          </div>

          {/* Hero card */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-primary opacity-20 blur-3xl" />
            <Card className="overflow-hidden p-0 shadow-elegant">
              <div className="border-b bg-card/50 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive/60" />
                  <div className="h-2 w-2 rounded-full bg-warning/60" />
                  <div className="h-2 w-2 rounded-full bg-success/60" />
                  <div className="ml-3 text-xs text-muted-foreground">vuma.app/dashboard</div>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Total chamas" value="2,543" trend="+13.5%" />
                  <Stat label="Members" value="73,682" trend="+18.7%" />
                  <Stat label="Contributions" value="KES 128M" trend="+14.5%" />
                </div>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-medium">Contribution growth</span>
                    <span className="text-xs text-muted-foreground">Last 12 months</span>
                  </div>
                  <SparkChart />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniRow label="Umoja Savings" value="KES 2.45M" tone="success" />
                  <MiniRow label="Pamoja Group" value="KES 1.85M" tone="info" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeader eyebrow="Platform features" title="Everything chamas need, in one place" />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* Dashboards */}
      <section id="dashboards" className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeader eyebrow="Built for every role" title="Four connected dashboards" />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {dashboards.map((d) => (
              <Card key={d.title} className="group relative overflow-hidden p-6 transition hover:shadow-elegant">
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${d.iconBg}`}>
                  <d.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {d.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeader eyebrow="How it works" title="From contribution to confirmation in seconds" />
        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border bg-card p-5">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </div>
              <h4 className="font-semibold">{s.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <Card className="overflow-hidden bg-gradient-primary p-10 text-center shadow-elegant">
          <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
            Build trust in every transaction.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/90">
            Join the chamas using VUMA to coordinate millions in contributions with full transparency.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" variant="secondary">Create free account</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                Sign in
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      <footer className="border-t bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <LogoLink />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} VUMA. Trust in every transaction.</p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: BarChart3, title: "Real-time dashboards", desc: "Live data across admin, treasurer, campaign, and member views." },
  { icon: FileSearch, title: "OCR & AI imports", desc: "Upload M-Pesa SMS, screenshots, PDFs, or Excel — VUMA extracts and matches automatically." },
  { icon: Shield, title: "Two-level verification", desc: "Every transaction verified by treasurer and audit log." },
  { icon: Wallet, title: "Multi-payment support", desc: "M-Pesa, bank, cash, and bulk import — one source of truth." },
  { icon: Bell, title: "Smart notifications", desc: "SMS, WhatsApp, and email alerts for contributions and milestones." },
  { icon: Lock, title: "Role-based access", desc: "Members see only what's theirs. Treasurers manage. Admins oversee." },
];

const dashboards = [
  { icon: Shield, iconBg: "bg-primary", title: "Admin", desc: "Platform governance & intelligence", bullets: ["Ecosystem analytics", "Risk monitoring", "Audit trails"] },
  { icon: Wallet, iconBg: "bg-primary-deep", title: "Treasurer", desc: "Chama operations & finance", bullets: ["Record contributions", "Bulk import & OCR", "Loan management"] },
  { icon: Sparkles, iconBg: "bg-info", title: "Campaign", desc: "Fundraising & community drives", bullets: ["Create campaigns", "Track contributors", "Real-time progress"] },
  { icon: Users, iconBg: "bg-warning", title: "Member", desc: "Personal participation", bullets: ["Contribution history", "Loan tracking", "Statements"] },
];

const steps = [
  { title: "Member contributes", desc: "Via M-Pesa, bank, or cash." },
  { title: "Treasurer verifies", desc: "Manual entry, bulk import, or OCR." },
  { title: "Database stores", desc: "Immutable record, audit log entry." },
  { title: "All dashboards sync", desc: "Member, campaign, and admin update instantly." },
];

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="group p-6 transition hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}

function Trust({ icon: Icon, label }: { icon: any; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-primary" />{label}</span>;
}

function Stat({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold">{value}</div>
      <div className="text-[10px] font-medium text-success">{trend}</div>
    </div>
  );
}

function MiniRow({ label, value, tone }: { label: string; value: string; tone: "success" | "info" }) {
  const dot = tone === "success" ? "bg-success" : "bg-info";
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function SparkChart() {
  const points = [20, 35, 28, 50, 45, 65, 60, 80, 72, 95, 88, 110];
  const max = Math.max(...points);
  const w = 100, h = 40;
  const path = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - (p / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.18 152)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.68 0.18 152)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${path} ${w},${h}`} fill="url(#g)" />
      <polyline points={path} fill="none" stroke="oklch(0.68 0.18 152)" strokeWidth="1.2" />
    </svg>
  );
}
