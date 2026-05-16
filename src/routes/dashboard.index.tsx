import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, PageHeader } from "@/components/dashboard/widgets";
import {
  Wallet, Users, Megaphone, TrendingUp, Receipt,
  CreditCard, ArrowRight, Plus, Crown, UserCheck,
  Calendar, CheckCircle2, Clock,
} from "lucide-react";

export const Route = createFileRoute("/dashboard/")({ component: Overview });

function Overview() {
  const { user, hasRole } = useAuth();
  const isTreasurer = hasRole("treasurer") || hasRole("admin");
  return isTreasurer ? <TreasurerOverview userId={user!.id} /> : <MemberOverview userId={user!.id} />;
}

/* ─────────────────── TREASURER OVERVIEW ─────────────────── */
function TreasurerOverview({ userId }: { userId: string }) {
  // Fetch only chamas this treasurer manages
  const { data: myChamas = [] } = useQuery({
    queryKey: ["my-chamas-treasurer", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chama_members")
        .select("chama_id, chamas(id, name, monthly_target)")
        .eq("user_id", userId)
        .in("role", ["treasurer", "admin"]);
      return (data ?? []).map((m: any) => m.chamas).filter(Boolean);
    },
  });

  const myChamaIds = myChamas.map((c: any) => c.id);

  const { data: stats } = useQuery({
    queryKey: ["treasurer-overview-stats", myChamaIds.join()],
    enabled: myChamaIds.length > 0,
    queryFn: async () => {
      const [contribs, pending, campaigns, members] = await Promise.all([
        supabase.from("contributions").select("amount, contributed_at, contributor_name, chama_id, chamas(name)").in("chama_id", myChamaIds).order("contributed_at", { ascending: false }).limit(5),
        supabase.from("loans").select("id, principal, created_at, chama_id, chamas(name), profiles(full_name)").in("chama_id", myChamaIds).eq("status", "pending"),
        supabase.from("campaigns").select("id, title, status").in("chama_id", myChamaIds).eq("status", "active"),
        supabase.from("chama_members").select("id", { count: "exact", head: true }).in("chama_id", myChamaIds),
      ]);
      const totalCollected = (await supabase.from("contributions").select("amount").in("chama_id", myChamaIds)).data?.reduce((s, c) => s + Number(c.amount), 0) ?? 0;
      return {
        recentContribs: contribs.data ?? [],
        pendingLoans: pending.data ?? [],
        activeCampaigns: campaigns.data ?? [],
        memberCount: members.count ?? 0,
        totalCollected,
      };
    },
  });

  return (
    <div>
      <PageHeader title="Treasurer Dashboard" description="Your chama operations at a glance."
        action={<div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1"><Crown className="h-3.5 w-3.5 text-warning" /><span className="text-xs font-semibold text-warning">Treasurer</span></div>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={`KES ${(stats?.totalCollected ?? 0).toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Chamas managed" value={`${myChamas.length}`} icon={Users} tone="primary" />
        <StatCard label="Total members" value={`${stats?.memberCount ?? 0}`} icon={UserCheck} tone="info" />
        <StatCard label="Pending approvals" value={`${stats?.pendingLoans.length ?? 0}`} icon={CreditCard} tone="warning" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent contributions</h3>
            <Link to="/dashboard/treasurer"><Button variant="ghost" size="sm" className="text-xs gap-1">View all <ArrowRight className="h-3 w-3" /></Button></Link>
          </div>
          {(stats?.recentContribs.length ?? 0) === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">No contributions yet. <Link to="/dashboard/treasurer" className="text-primary hover:underline">Record one</Link></p>
            : <div className="divide-y">
                {stats!.recentContribs.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center">
                        <Receipt className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{c.contributor_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(c as any).chamas?.name ?? "—"} · {new Date(c.contributed_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-success">KES {Number(c.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
          }
        </Card>

        <div className="space-y-4">
          {(stats?.pendingLoans.length ?? 0) > 0 && (
            <Card className="p-4 border-warning/40 bg-warning/5">
              <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-warning" /><h4 className="text-sm font-semibold text-warning">{stats!.pendingLoans.length} loan{stats!.pendingLoans.length > 1 ? "s" : ""} awaiting approval</h4></div>
              <div className="mb-3 space-y-1">
                {stats!.pendingLoans.slice(0, 3).map((l: any) => (
                  <p key={l.id} className="text-xs text-muted-foreground">
                    {l.profiles?.full_name ?? "Member"} — KES {Number(l.principal).toLocaleString()} · {(l as any).chamas?.name}
                  </p>
                ))}
              </div>
              <Link to="/dashboard/loans"><Button size="sm" className="w-full bg-warning text-warning-foreground hover:bg-warning/90">Review loans</Button></Link>
            </Card>
          )}
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Quick actions</h4>
            <div className="space-y-2">
              <Link to="/dashboard/treasurer" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Plus className="h-3.5 w-3.5" /> Record contribution</Button></Link>
              <Link to="/dashboard/members" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Users className="h-3.5 w-3.5" /> Manage members</Button></Link>
              <Link to="/dashboard/campaigns" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Megaphone className="h-3.5 w-3.5" /> Start campaign</Button></Link>
              <Link to="/dashboard/import" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Receipt className="h-3.5 w-3.5" /> Bulk import M-Pesa</Button></Link>
            </div>
          </Card>
          {(stats?.activeCampaigns.length ?? 0) > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2"><Megaphone className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">{stats!.activeCampaigns.length} active campaign{stats!.activeCampaigns.length > 1 ? "s" : ""}</h4></div>
              {stats!.activeCampaigns.slice(0, 2).map((c: any) => <p key={c.id} className="text-xs text-muted-foreground truncate">{c.title}</p>)}
              <Link to="/dashboard/campaigns"><Button variant="ghost" size="sm" className="mt-2 w-full text-xs gap-1">View all <ArrowRight className="h-3 w-3" /></Button></Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── MEMBER OVERVIEW ─────────────────── */
function MemberOverview({ userId }: { userId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["member-overview", userId],
    queryFn: async () => {
      const [contribsAll, contribsRecent, loans, campaigns, chamas] = await Promise.all([
        supabase.from("contributions").select("amount").eq("contributor_id", userId),
        supabase.from("contributions").select("amount, contributed_at, source, reference, chama_id, chamas(name)").eq("contributor_id", userId).order("contributed_at", { ascending: false }).limit(5),
        supabase.from("loans").select("*, chamas(name)").eq("borrower_id", userId),
        supabase.from("campaigns").select("id, title, target_amount, status").eq("status", "active").limit(3),
        supabase.from("chama_members").select("chama_id, chamas(name, monthly_target)").eq("user_id", userId),
      ]);
      const totalContributed = (contribsAll.data ?? []).reduce((s, c) => s + Number(c.amount), 0);
      const contributionCount = contribsAll.data?.length ?? 0;
      const loanBalance = (loans.data ?? []).filter((l) => l.status === "approved").reduce((s, l) => s + Number(l.balance), 0);
      return {
        recentContribs: contribsRecent.data ?? [],
        totalContributed,
        contributionCount,
        loanBalance,
        pendingLoan: (loans.data ?? []).find((l) => l.status === "pending"),
        activeCampaigns: campaigns.data ?? [],
        chamas: chamas.data ?? [],
        allLoans: loans.data ?? [],
      };
    },
  });

  return (
    <div>
      <PageHeader title="My Dashboard" description="Your personal financial activity across all chamas."
        action={<div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1"><UserCheck className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-semibold text-primary">Member</span></div>}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total contributed" value={`KES ${(stats?.totalContributed ?? 0).toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Contributions" value={`${stats?.contributionCount ?? 0}`} icon={Receipt} tone="info" />
        <StatCard label="Loan balance" value={`KES ${(stats?.loanBalance ?? 0).toLocaleString()}`} icon={CreditCard} tone="warning" />
        <StatCard label="Chamas joined" value={`${stats?.chamas.length ?? 0}`} icon={Users} tone="primary" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent contributions</h3>
            <Link to="/dashboard/member"><Button variant="ghost" size="sm" className="text-xs gap-1">Full history <ArrowRight className="h-3 w-3" /></Button></Link>
          </div>
          {(stats?.recentContribs.length ?? 0) === 0
            ? <p className="py-6 text-center text-sm text-muted-foreground">No contributions recorded yet.</p>
            : <div className="divide-y">
                {stats!.recentContribs.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-success/10 flex items-center justify-center"><Calendar className="h-3.5 w-3.5 text-success" /></div>
                      <div>
                        <p className="font-medium">{c.chamas?.name ?? "General"}</p>
                        <p className="text-xs text-muted-foreground uppercase">{c.source}{c.reference ? ` · ${c.reference}` : ""} · {new Date(c.contributed_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-success">KES {Number(c.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
          }
        </Card>

        <div className="space-y-4">
          {stats?.pendingLoan && (
            <Card className="p-4 border-warning/40 bg-warning/5">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-warning" /><h4 className="text-sm font-semibold text-warning">Loan pending</h4></div>
              <p className="text-xs text-muted-foreground">KES {Number(stats.pendingLoan.principal).toLocaleString()} from {(stats.pendingLoan as any).chamas?.name ?? "your chama"} awaits approval.</p>
            </Card>
          )}
          {(stats?.chamas.length ?? 0) > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> My chamas</h4>
              <div className="space-y-2">
                {stats!.chamas.map((m: any) => (
                  <div key={m.chama_id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-sm font-medium truncate">{m.chamas?.name ?? "Unnamed"}</span>
                    {m.chamas?.monthly_target && <span className="text-xs text-muted-foreground shrink-0 ml-2">KES {Number(m.chamas.monthly_target).toLocaleString()}/mo</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {(stats?.activeCampaigns.length ?? 0) > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> Active campaigns</h4>
              {stats!.activeCampaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm mb-1">
                  <span className="truncate text-xs">{c.title}</span>
                  <span className="shrink-0 ml-2 text-xs text-muted-foreground">KES {Number(c.target_amount).toLocaleString()}</span>
                </div>
              ))}
              <Link to="/dashboard/campaigns"><Button variant="ghost" size="sm" className="mt-2 w-full text-xs gap-1">Contribute <ArrowRight className="h-3 w-3" /></Button></Link>
            </Card>
          )}
          {(stats?.chamas.length ?? 0) === 0 && (
            <Card className="p-5 border-dashed bg-muted/20 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Not in a chama yet</p>
              <p className="text-xs text-muted-foreground mt-1">Ask your treasurer for an invite link to join.</p>
            </Card>
          )}
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">Quick actions</h4>
            <div className="space-y-2">
              <Link to="/dashboard/member" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Receipt className="h-3.5 w-3.5" /> View my activity</Button></Link>
              <Link to="/dashboard/loans" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><CreditCard className="h-3.5 w-3.5" /> Request a loan</Button></Link>
              <Link to="/dashboard/campaigns" className="block"><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Megaphone className="h-3.5 w-3.5" /> Contribute to campaign</Button></Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
