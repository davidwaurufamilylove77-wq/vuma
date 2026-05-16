import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { StatCard, PageHeader } from "@/components/dashboard/widgets";
import { Wallet, Receipt, CreditCard, Calendar, ArrowDownLeft } from "lucide-react";
import { DepositDialog } from "@/components/deposit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { initiateWithdrawal } from "@/lib/payhero.functions";

export const Route = createFileRoute("/dashboard/member")({ component: MemberPage });

const withdrawSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  phone: z.string().trim().regex(/^(?:254|0)\d{9}$/, "Use format 0712345678 or 254712345678"),
  chama_id: z.string().uuid().optional(),
});

function WithdrawDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [chamaId, setChamaId] = useState("");
  const [loading, setLoading] = useState(false);
  const withdrawFn = useServerFn(initiateWithdrawal);

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-withdraw"],
    queryFn: async () => (await supabase.from("chamas").select("id,name")).data ?? [],
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowDownLeft className="mr-1 h-4 w-4" /> Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Withdraw via M-Pesa</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = withdrawSchema.safeParse({ amount, phone, chama_id: chamaId || undefined });
            if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
            const normalizedPhone = parsed.data.phone.startsWith("0")
              ? "254" + parsed.data.phone.slice(1) : parsed.data.phone;
            setLoading(true);
            try {
              await withdrawFn({ data: { ...parsed.data, phone: normalizedPhone } });
              toast.success("Withdrawal request submitted — you will receive funds shortly");
              setOpen(false);
              setAmount(""); setPhone(""); setChamaId("");
            } catch (err: any) { toast.error(err.message); }
            finally { setLoading(false); }
          }}
        >
          <div>
            <Label>Amount (KES)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Phone (Safaricom)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" required />
          </div>
          <div>
            <Label>Chama (optional)</Label>
            <Select value={chamaId} onValueChange={setChamaId}>
              <SelectTrigger><SelectValue placeholder="Personal withdrawal" /></SelectTrigger>
              <SelectContent>
                {chamas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Withdrawals are processed within 24 hours pending treasurer approval.</p>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Withdrawal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberPage() {
  const { user } = useAuth();

  const { data: contribs = [] } = useQuery({
    queryKey: ["my-contribs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*, chamas(name)")
        .eq("contributor_id", user!.id)
        .order("contributed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["my-loans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .eq("borrower_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const total = contribs.reduce((s, c) => s + Number(c.amount), 0);
  const loanBal = loans.reduce((s, l) => s + Number(l.balance), 0);

  return (
    <div>
      <PageHeader title="My Activity" description="Your contributions, loans, and personal financial summary." action={
        <div className="flex gap-2">
          <DepositDialog />
          <WithdrawDialog />
        </div>
      } />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total contributed" value={`KES ${total.toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Contributions" value={`${contribs.length}`} icon={Receipt} tone="info" />
        <StatCard label="Loan balance" value={`KES ${loanBal.toLocaleString()}`} icon={CreditCard} tone="warning" />
      </div>

      <Card className="mt-8 p-6">
        <h3 className="mb-4 text-base font-semibold">Contribution history</h3>
        {contribs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contributions yet.</p>
        ) : (
          <div className="divide-y">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{(c as any).chamas?.name ?? new Date(c.contributed_at).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.contributed_at).toLocaleDateString()} · {c.source.toUpperCase()} {c.reference ? `· ${c.reference}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">KES {Number(c.amount).toLocaleString()}</p>
                  <p className="text-xs capitalize text-muted-foreground">{c.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
