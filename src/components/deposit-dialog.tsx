import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Smartphone } from "lucide-react";
import { initiateDeposit } from "@/lib/payhero.functions";

const schema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  phone: z.string().trim().regex(/^(?:254|0)\d{9}$/, "Use format 0712345678 or 254712345678"),
  chama_id: z.string().uuid().optional(),
});

export function DepositDialog() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [chamaId, setChamaId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const depositFn = useServerFn(initiateDeposit);

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-deposit"],
    queryFn: async () => (await supabase.from("chamas").select("id,name")).data ?? [],
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-primary text-primary-foreground">
          <Smartphone className="mr-1 h-4 w-4" /> Deposit via M-Pesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Deposit via M-Pesa</DialogTitle></DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = schema.safeParse({
              amount, phone,
              chama_id: chamaId || undefined,
            });
            if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
            const normalizedPhone = parsed.data.phone.startsWith("0")
              ? "254" + parsed.data.phone.slice(1) : parsed.data.phone;
            setLoading(true);
            try {
              const res = await depositFn({ data: { ...parsed.data, phone: normalizedPhone } });
              if (res.mode === "placeholder") {
                toast.success("Deposit recorded (demo mode — connect PayHero secrets to enable STK push)");
              } else {
                toast.success("STK push sent — check your phone");
              }
              qc.invalidateQueries({ queryKey: ["my-contribs"] });
              setOpen(false);
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
              <SelectTrigger><SelectValue placeholder="Personal contribution" /></SelectTrigger>
              <SelectContent>
                {chamas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send STK Push
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
