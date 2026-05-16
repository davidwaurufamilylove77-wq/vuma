import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatCard } from "@/components/dashboard/widgets";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, CheckCircle2, XCircle, Clock, Plus, History } from "lucide-react";
import { requestLoan, decideLoan, recordRepayment } from "@/lib/loans.functions";

export const Route = createFileRoute("/dashboard/loans")({ component: LoansPage });

const reqSchema = z.object({
  chama_id: z.string().uuid(),
  principal: z.coerce.number().positive().max(100_000_000),
  interest_rate: z.coerce.number().min(0).max(100),
  due_date: z.string().optional(),
});

function LoansPage() {
  const { user, hasRole } = useAuth();
  const isTreasurer = hasRole("treasurer") || hasRole("admin");
  const qc = useQueryClient();
  const requestFn = useServerFn(requestLoan);
  const decideFn = useServerFn(decideLoan);
  const repayFn = useServerFn(recordRepayment);

  const { data: loans = [] } = useQuery({
    queryKey: ["loans-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loans")
        .select("*, chamas(name), profiles(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-loans", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chama_members")
        .select("chama_id, chamas(id, name)")
        .eq("user_id", user!.id);
      return (data ?? []).map((m: any) => m.chamas).filter(Boolean);
    },
  });

  const my = loans.filter((l: any) => l.borrower_id === user?.id);
  const pending = loans.filter((l: any) => l.status === "pending");
  const totalBalance = my.reduce((s: number, l: any) => s + Number(l.balance), 0);

  return (
    <div>
      <PageHeader
        title="Loans"
        description="Request loans from your chama and track repayments."
        action={<RequestLoanDialog
          chamas={chamas}
          onSubmit={async (vals) => {
            await requestFn({ data: vals });
            qc.invalidateQueries({ queryKey: ["loans-all"] });
            toast.success("Loan request submitted");
          }}
        />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="My loans" value={`${my.length}`} icon={CreditCard} tone="info" />
        <StatCard label="My balance" value={`KES ${totalBalance.toLocaleString()}`} icon={CreditCard} tone="warning" />
        <StatCard label="Pending approval" value={`${pending.length}`} icon={Clock} tone="primary" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold">My loans</h3>
          {my.length === 0 && <p className="text-sm text-muted-foreground">You have no loans.</p>}
          <div className="divide-y">
            {my.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">KES {Number(l.principal).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {(l as any).chamas?.name ?? "—"} · Balance: KES {Number(l.balance).toLocaleString()} · {l.interest_rate}%
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold">Approval queue</h3>
          {!isTreasurer ? (
            <p className="text-sm text-muted-foreground">Only treasurers can approve or reject loans.</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="divide-y">
              {pending.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">KES {Number(l.principal).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {(l as any).profiles?.full_name ?? "Member"} · {(l as any).chamas?.name ?? "—"} · {new Date(l.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        await decideFn({ data: { loan_id: l.id, decision: "approved" } });
                        qc.invalidateQueries({ queryKey: ["loans-all"] });
                        toast.success("Approved");
                      } catch (e: any) { toast.error(e.message); }
                    }}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      try {
                        await decideFn({ data: { loan_id: l.id, decision: "rejected" } });
                        qc.invalidateQueries({ queryKey: ["loans-all"] });
                        toast.success("Rejected");
                      } catch (e: any) { toast.error(e.message); }
                    }}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="mb-4 text-base font-semibold">Record repayment</h3>
        <RepaymentForm loans={my.filter((l: any) => l.status === "approved")} onSubmit={async (id, amount) => {
          try {
            await repayFn({ data: { loan_id: id, amount } });
            qc.invalidateQueries({ queryKey: ["loans-all"] });
            qc.invalidateQueries({ queryKey: ["loan-repayments"] });
            toast.success("Repayment recorded");
          } catch (e: any) { toast.error(e.message); }
        }} />
      </Card>

      <Card className="mt-6 p-6">
        <h3 className="mb-4 text-base font-semibold">Repayment history</h3>
        <RepaymentHistory userId={user?.id ?? ""} loans={my} />
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    rejected: "bg-destructive/10 text-destructive",
    repaid: "bg-primary/10 text-primary",
  };
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium capitalize ${map[status] ?? "bg-muted"}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}

function RequestLoanDialog({ chamas, onSubmit }: { chamas: any[]; onSubmit: (v: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [chamaId, setChamaId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("0");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-primary text-primary-foreground">
          <Plus className="mr-1 h-4 w-4" /> Request loan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request a loan</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = reqSchema.safeParse({ chama_id: chamaId, principal, interest_rate: rate, due_date: due || undefined });
            if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
            setLoading(true);
            try { await onSubmit(parsed.data); setOpen(false); }
            catch (e: any) { toast.error(e.message); }
            finally { setLoading(false); }
          }}
          className="space-y-3"
        >
          <div>
            <Label>Chama</Label>
            <Select value={chamaId} onValueChange={setChamaId}>
              <SelectTrigger><SelectValue placeholder="Select chama" /></SelectTrigger>
              <SelectContent>
                {chamas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Principal (KES)</Label>
            <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Interest %</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RepaymentForm({ loans, onSubmit }: { loans: any[]; onSubmit: (id: string, amount: number) => Promise<void> }) {
  const [loanId, setLoanId] = useState("");
  const [amount, setAmount] = useState("");
  if (loans.length === 0) return <p className="text-sm text-muted-foreground">No active loans.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const amt = Number(amount);
        if (!loanId || !amt) { toast.error("Select a loan and amount"); return; }
        await onSubmit(loanId, amt);
        setAmount("");
      }}
      className="grid gap-3 md:grid-cols-3"
    >
      <Select value={loanId} onValueChange={setLoanId}>
        <SelectTrigger><SelectValue placeholder="Select loan" /></SelectTrigger>
        <SelectContent>
          {loans.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              KES {Number(l.principal).toLocaleString()} · bal {Number(l.balance).toLocaleString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button type="submit">Record</Button>
    </form>
  );
}

function RepaymentHistory({ userId, loans }: { userId: string; loans: any[] }) {
  const loanIds = loans.map((l) => l.id);

  const { data: repayments = [] } = useQuery({
    queryKey: ["loan-repayments", userId],
    enabled: loanIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_repayments")
        .select("*")
        .in("loan_id", loanIds)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loans.length === 0) return <p className="text-sm text-muted-foreground">No loans to show history for.</p>;
  if (repayments.length === 0) return <p className="text-sm text-muted-foreground">No repayments recorded yet.</p>;

  const loanMap = Object.fromEntries(loans.map((l) => [l.id, l]));

  return (
    <div className="divide-y">
      {repayments.map((r: any) => {
        const loan = loanMap[r.loan_id];
        return (
          <div key={r.id} className="flex items-center justify-between py-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                <History className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium">KES {Number(r.amount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Loan of KES {loan ? Number(loan.principal).toLocaleString() : "—"} · {new Date(r.paid_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Paid</span>
          </div>
        );
      })}
    </div>
  );
}
