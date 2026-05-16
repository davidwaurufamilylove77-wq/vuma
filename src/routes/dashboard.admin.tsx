import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/dashboard/widgets";
import { Users, Wallet, Megaphone, Activity, Shield as ShieldIcon, CheckCircle2, XCircle, ArrowDownLeft, ArrowUpRight, FileText, CreditCard } from "lucide-react";

export const Route = createFileRoute("/dashboard/admin")({ component: AdminPage });

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  loan_requested:          { label: "Loan requested",       icon: CreditCard,     color: "text-warning" },
  loan_approved:           { label: "Loan approved",        icon: CheckCircle2,   color: "text-success" },
  loan_rejected:           { label: "Loan rejected",        icon: XCircle,        color: "text-destructive" },
  repayment_recorded:      { label: "Repayment",            icon: ArrowUpRight,   color: "text-success" },
  deposit_initiated:       { label: "Deposit initiated",    icon: ArrowDownLeft,  color: "text-primary" },
  mpesa_deposit_confirmed: { label: "M-Pesa confirmed",     icon: CheckCircle2,   color: "text-success" },
};

function AdminPage() {
  const { hasRole, loading } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: hasRole("admin"),
    queryFn: async () => {
      const [chamas, members, campaigns, contribs] = await Promise.all([
        supabase.from("chamas").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("contributions").select("amount"),
      ]);
      const total = (contribs.data ?? []).reduce((s, c) => s + Number(c.amount), 0);
      return {
        chamas: chamas.count ?? 0,
        members: members.count ?? 0,
        campaigns: campaigns.count ?? 0,
        totalContributions: total,
      };
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs"],
    enabled: hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  if (loading) return null;
  if (!hasRole("admin")) {
    return (
      <Card className="p-10 text-center">
        <ShieldIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">Admin access required</h3>
        <p className="mt-1 text-sm text-muted-foreground">Your account doesn't have admin privileges.</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="Platform governance, ecosystem analytics, and risk monitoring." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total chamas" value={`${stats?.chamas ?? 0}`} icon={Users} tone="primary" />
        <StatCard label="Total members" value={`${stats?.members ?? 0}`} icon={Users} tone="info" />
        <StatCard label="Active campaigns" value={`${stats?.campaigns ?? 0}`} icon={Megaphone} tone="warning" />
        <StatCard label="Contributions" value={`KES ${(stats?.totalContributions ?? 0).toLocaleString()}`} icon={Wallet} tone="success" />
      </div>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Audit trail
          </h3>
          <span className="text-xs text-muted-foreground">Last 50 events · refreshes every 30s</span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No audit events yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {auditLogs.map((log: any) => {
              const meta = ACTION_META[log.action] ?? { label: log.action, icon: FileText, color: "text-muted-foreground" };
              const Icon = meta.icon;
              const ts = new Date(log.created_at);
              return (
                <div key={log.id} className="flex items-start gap-3 py-3">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.entity} · {log.entity_id?.slice(0, 8)}…
                      {log.actor_id && ` · by ${log.actor_id.slice(0, 8)}…`}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {Object.entries(log.metadata)
                          .filter(([, v]) => v !== null)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
