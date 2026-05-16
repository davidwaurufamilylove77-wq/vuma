import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatCard, PageHeader } from "@/components/dashboard/widgets";
import { Plus, Wallet, Receipt, Users, Link2, Copy, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/treasurer")({ component: TreasurerPage });

const chamaSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional(),
  monthly_target: z.coerce.number().min(0).max(100_000_000),
});

const contribSchema = z.object({
  chama_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(100_000_000),
  contributor_name: z.string().trim().min(1).max(100),
  contributor_id: z.string().uuid().optional(),
  reference: z.string().max(100).optional(),
  source: z.enum(["manual", "mpesa", "bulk", "ocr"]),
  notes: z.string().max(500).optional(),
});

function TreasurerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myChamaIds = [] } = useQuery({
    queryKey: ["my-chama-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("chama_members")
        .select("chama_id")
        .eq("user_id", user!.id)
        .in("role", ["treasurer", "admin"]);
      return (data ?? []).map((m: any) => m.chama_id);
    },
  });

  const { data: contribs = [] } = useQuery({
    queryKey: ["recent-contribs", myChamaIds.join()],
    enabled: myChamaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contributions")
        .select("*, chamas(name)")
        .in("chama_id", myChamaIds)
        .order("contributed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalCollected = contribs.reduce((s: number, c: any) => s + Number(c.amount), 0);

  return (
    <div>
      <PageHeader
        title="Treasurer Dashboard"
        description="Chama operations, contribution tracking, and loan management."
        action={
          <div className="flex gap-2">
            <CreateChamaDialog onCreated={() => qc.invalidateQueries({ queryKey: ["chamas"] })} userId={user!.id} />
            <RecordContribDialog
              chamas={chamas}
              userId={user!.id}
              onCreated={() => qc.invalidateQueries({ queryKey: ["recent-contribs"] })}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="My chamas" value={`${chamas.length}`} icon={Users} tone="primary" />
        <StatCard label="Recent collected" value={`KES ${totalCollected.toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Recent contributions" value={`${contribs.length}`} icon={Receipt} tone="info" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold">My chamas</h3>
          {chamas.length === 0 && <p className="text-sm text-muted-foreground">No chamas yet — create one to get started.</p>}
          <div className="space-y-2">
            {chamas.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card/50 p-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Target: KES {Number(c.monthly_target).toLocaleString()}/mo</p>
                </div>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Active</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 text-base font-semibold">Recent contributions</h3>
          {contribs.length === 0 && <p className="text-sm text-muted-foreground">No contributions recorded yet.</p>}
          <div className="space-y-2">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{c.contributor_name || "Member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {(c as any).chamas?.name ?? "—"} · {c.source.toUpperCase()} · {new Date(c.contributed_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-semibold text-success">KES {Number(c.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <InviteLinks chamas={chamas} userId={user!.id} />
    </div>
  );
}

function InviteLinks({ chamas, userId }: { chamas: Array<{ id: string; name: string }>; userId: string }) {
  const [chamaId, setChamaId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: invites = [] } = useQuery({
    queryKey: ["invites", chamaId],
    enabled: !!chamaId,
    queryFn: async () => {
      const { data } = await supabase.from("chama_invites").select("*")
        .eq("chama_id", chamaId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const generate = async () => {
    if (!chamaId) { toast.error("Pick a chama"); return; }
    setGenerating(true);
    const token = crypto.randomUUID().replace(/-/g, "");
    const expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("chama_invites").insert({
      chama_id: chamaId, token, created_by: userId, expires_at, max_uses: 50,
    });
    setGenerating(false);
    if (error) return toast.error(error.message);
    toast.success("Invite link generated");
    qc.invalidateQueries({ queryKey: ["invites", chamaId] });
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Link copied");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Link2 className="h-4 w-4 text-primary" /> Invite links
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Share a link so members can join your chama instantly.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Chama</Label>
          <Select value={chamaId} onValueChange={setChamaId}>
            <SelectTrigger><SelectValue placeholder="Select chama" /></SelectTrigger>
            <SelectContent>
              {chamas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={generate} disabled={!chamaId || generating} className="bg-gradient-primary text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Generate link
        </Button>
      </div>

      {chamaId && invites.length > 0 && (
        <div className="mt-4 space-y-2">
          {invites.map((i: any) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${i.token}`;
            const expired = i.expires_at && new Date(i.expires_at) < new Date();
            return (
              <div key={i.id} className="flex items-center gap-2 rounded-lg border bg-card/50 p-2.5">
                <div className="flex-1 truncate font-mono text-xs">{url}</div>
                <span className="text-xs text-muted-foreground">
                  {i.uses}/{i.max_uses ?? "∞"} uses
                </span>
                {expired && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Expired</span>}
                <Button size="sm" variant="ghost" onClick={() => copy(i.token)}>
                  {copied === i.token ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => {
                  const { error } = await supabase.from("chama_invites").delete().eq("id", i.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success("Invite revoked");
                  qc.invalidateQueries({ queryKey: ["invites", chamaId] });
                }}>
                  <span className="text-xs">Revoke</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function CreateChamaDialog({ onCreated, userId }: { onCreated: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", monthly_target: "0" });

  const submit = async () => {
    const parsed = chamaSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("chamas")
      .insert({ ...parsed.data, created_by: userId })
      .select()
      .single();
    if (!error && data) {
      // auto-add creator as treasurer
      await supabase.from("chama_members").insert({ chama_id: data.id, user_id: userId, role: "treasurer" });
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Chama created");
    setOpen(false);
    setForm({ name: "", description: "", monthly_target: "0" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> New chama</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create chama</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Monthly target (KES)</Label>
            <Input type="number" value={form.monthly_target} onChange={(e) => setForm({ ...form, monthly_target: e.target.value })} /></div>
          <Button onClick={submit} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordContribDialog({
  chamas, userId, onCreated,
}: {
  chamas: Array<{ id: string; name: string }>;
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    chama_id: "", amount: "", contributor_name: "", contributor_id: "", reference: "", source: "manual" as const, notes: "",
  });

  const { data: members = [] } = useQuery({
    queryKey: ["chama-members-for-contrib", form.chama_id],
    enabled: !!form.chama_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("chama_members")
        .select("user_id, profiles(full_name, phone)")
        .eq("chama_id", form.chama_id);
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name ?? m.user_id,
      }));
    },
  });

  const submit = async () => {
    const parsed = contribSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("contributions").insert({
      ...parsed.data,
      contributor_id: parsed.data.contributor_id || null,
      recorded_by: userId,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contribution recorded");
    setOpen(false);
    setForm({ chama_id: "", amount: "", contributor_name: "", contributor_id: "", reference: "", source: "manual", notes: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground" disabled={chamas.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Record contribution
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record contribution</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Chama</Label>
            <Select value={form.chama_id} onValueChange={(v) => setForm({ ...form, chama_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select chama" /></SelectTrigger>
              <SelectContent>
                {chamas.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Contributor</Label>
              <Input value={form.contributor_name} onChange={(e) => setForm({ ...form, contributor_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Amount (KES)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Link to member (optional)</Label>
            <Select
              value={form.contributor_id}
              onValueChange={(v) => {
                const m = members.find((m) => m.user_id === v);
                setForm({ ...form, contributor_id: v, contributor_name: form.contributor_name || m?.full_name || "" });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select a chama member" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Linking a member lets them see this contribution in their activity.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Source</Label>
              <Select value={form.source} onValueChange={(v: any) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bulk">Bulk import</SelectItem>
                  <SelectItem value="ocr">OCR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Reference</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="MPESA code" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button onClick={submit} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">Record</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
