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
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/dashboard/widgets";
import { Plus, Megaphone, Calendar, XCircle, Pencil, Heart, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/campaigns")({ component: CampaignsPage });

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional(),
  target_amount: z.coerce.number().positive().max(100_000_000),
  deadline: z.string().optional(),
});

function CampaignsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contribsByCampaign = {} } = useQuery({
    queryKey: ["campaigns-contribs", campaigns.map((c) => c.id).join()],
    enabled: campaigns.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("contributions")
        .select("campaign_id, amount")
        .in("campaign_id", campaigns.map((c) => c.id));
      const map: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        if (!row.campaign_id) return;
        map[row.campaign_id] = (map[row.campaign_id] ?? 0) + Number(row.amount);
      });
      return map;
    },
  });

  const closeCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "closed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campaign closed");
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  };

  const reopenCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "active" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campaign reopened");
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Run fundraising campaigns — funerals, weddings, medical, emergencies."
        action={<CreateCampaignDialog userId={user!.id} onCreated={() => qc.invalidateQueries({ queryKey: ["campaigns"] })} />}
      />

      {campaigns.length === 0 && (
        <Card className="border-dashed bg-muted/30 p-10 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">No campaigns yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first campaign to start fundraising.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => {
          const raised = contribsByCampaign[c.id] ?? 0;
          const pct = Math.min(100, (raised / Math.max(1, Number(c.target_amount))) * 100);
          const isOwner = c.owner_id === user?.id;
          return (
            <Card key={c.id} className="p-5 transition hover:shadow-elegant">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{c.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${c.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {c.status}
                </span>
              </div>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">KES {raised.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">of KES {Number(c.target_amount).toLocaleString()}</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(1)}% reached</span>
                  {c.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(c.deadline).toLocaleDateString()}</span>}
                </div>
              </div>
              {isOwner && (
                <div className="mt-4 flex gap-2 border-t pt-3">
                  <EditCampaignDialog campaign={c} onUpdated={() => qc.invalidateQueries({ queryKey: ["campaigns"] })} />
                  {c.status === "active" ? (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => closeCampaign(c.id)}>
                      <XCircle className="mr-1 h-3 w-3" /> Close
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => reopenCampaign(c.id)}>
                      Reopen
                    </Button>
                  )}
                </div>
              )}
              {c.status === "active" && (
                <div className={`${isOwner ? "" : "mt-4 border-t pt-3"}`}>
                  <ContributeToCampaignDialog
                    campaignId={c.id}
                    campaignTitle={c.title}
                    chamaId={c.chama_id ?? null}
                    onContributed={() => {
                      qc.invalidateQueries({ queryKey: ["campaigns-contribs"] });
                      qc.invalidateQueries({ queryKey: ["campaigns"] });
                    }}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditCampaignDialog({ campaign, onUpdated }: { campaign: any; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: campaign.title,
    description: campaign.description ?? "",
    target_amount: String(campaign.target_amount),
    deadline: campaign.deadline ?? "",
  });

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.from("campaigns").update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      target_amount: parsed.data.target_amount,
      deadline: parsed.data.deadline || null,
    }).eq("id", campaign.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Campaign updated");
    setOpen(false);
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit campaign</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Target (KES)</Label>
              <Input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <Button onClick={submit} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">Save changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContributeToCampaignDialog({
  campaignId, campaignTitle, chamaId, onContributed,
}: { campaignId: string; campaignTitle: string; chamaId: string | null; onContributed: () => void }) {
  const { user, profileName } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    const { error } = await supabase.from("contributions").insert({
      campaign_id: campaignId,
      chama_id: chamaId || null,
      contributor_id: user!.id,
      contributor_name: profileName ?? user!.email?.split("@")[0] ?? "Member",
      amount: amt,
      source: "manual",
      status: "verified",
      recorded_by: user!.id,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`KES ${amt.toLocaleString()} contributed!`);
    setAmount("");
    setOpen(false);
    onContributed();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full mt-2">
          <Heart className="mr-1 h-3 w-3 text-destructive" /> Contribute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contribute to "{campaignTitle}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Contribution
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateCampaignDialog({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", target_amount: "", deadline: "", chama_id: "" });

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-campaign-create", userId],
    queryFn: async () => {
      const { data } = await supabase.from("chama_members").select("chama_id, chamas(id, name)").eq("user_id", userId);
      return (data ?? []).map((m: any) => m.chamas).filter(Boolean);
    },
  });

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: campaign, error } = await supabase.from("campaigns").insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      target_amount: parsed.data.target_amount,
      deadline: parsed.data.deadline || null,
      owner_id: userId,
      chama_id: form.chama_id || null,
    }).select().single();
    if (!error && campaign) {
      // Assign campaign_owner role to this user
      await supabase.from("user_roles").insert({ user_id: userId, role: "campaign_owner" }).select().single();
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Campaign launched");
    setOpen(false);
    setForm({ title: "", description: "", target_amount: "", deadline: "", chama_id: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> New campaign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create campaign</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Target (KES)</Label>
              <Input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <Button onClick={submit} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">Launch</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
