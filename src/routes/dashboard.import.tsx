import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/widgets";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, FileSearch, ImageIcon, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { parseContributions } from "@/lib/ocr.functions";

export const Route = createFileRoute("/dashboard/import")({ component: ImportPage });

type Row = {
  contributor_name: string;
  amount: number;
  reference: string | null;
  contributed_at: string | null;
  notes: string | null;
  selected: boolean;
};

function ImportPage() {
  const { user } = useAuth();
  const parseFn = useServerFn(parseContributions);
  const [text, setText] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [chamaId, setChamaId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-import"],
    queryFn: async () => (await supabase.from("chamas").select("id,name")).data ?? [],
  });

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const runParse = async () => {
    if (!text.trim() && !imageDataUrl) { toast.error("Provide text or an image"); return; }
    setLoading(true);
    try {
      const res = await parseFn({ data: { text: text || undefined, imageDataUrl: imageDataUrl || undefined } });
      setRows(res.contributions.map((r: Omit<Row, "selected">) => ({ ...r, selected: true })));
      toast.success(`Parsed ${res.contributions.length} contributions`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const importSelected = async () => {
    if (!chamaId) { toast.error("Select a chama"); return; }
    const picks = rows.filter((r) => r.selected);
    if (picks.length === 0) { toast.error("No rows selected"); return; }
    setSaving(true);
    try {
      // Try to match contributor names to chama members for contributor_id linking
      const { data: members } = await supabase
        .from("chama_members")
        .select("user_id, profiles(full_name)")
        .eq("chama_id", chamaId);
      const memberMap: Record<string, string> = {};
      (members ?? []).forEach((m: any) => {
        const name = m.profiles?.full_name?.toLowerCase().trim();
        if (name) memberMap[name] = m.user_id;
      });

      const inserts = picks.map((r) => {
        const nameKey = r.contributor_name.toLowerCase().trim();
        const matched_id = memberMap[nameKey] ?? null;
        return {
          chama_id: chamaId,
          contributor_name: r.contributor_name,
          contributor_id: matched_id,
          amount: r.amount,
          reference: r.reference,
          notes: r.notes,
          source: "ocr" as const,
          status: "verified",
          recorded_by: user!.id,
          contributed_at: r.contributed_at ?? new Date().toISOString(),
        };
      });
      const { error } = await supabase.from("contributions").insert(inserts);
      if (error) throw error;
      toast.success(`Imported ${picks.length} contributions`);
      setRows([]);
      setText("");
      setImageDataUrl(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Bulk Import"
        description="Paste M-Pesa SMS, statement text, or upload a receipt image. AI extracts and prepares rows for review."
      />

      <Card className="p-6">
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text"><FileSearch className="mr-2 h-4 w-4" /> Text / SMS</TabsTrigger>
            <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" /> Image</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-4">
            <Label>Paste SMS messages or statement text</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="QHX23ABC Confirmed. Ksh1,000 received from JOHN DOE 0712345678 on 14/5/26..."
            />
          </TabsContent>
          <TabsContent value="image" className="mt-4">
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {imageDataUrl && <img src={imageDataUrl} alt="" className="mt-3 max-h-60 rounded border" />}
          </TabsContent>
        </Tabs>
        <Button onClick={runParse} disabled={loading} className="mt-4 bg-gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Parse with AI
        </Button>
      </Card>

      {rows.length > 0 && (
        <Card className="mt-6 p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">Review extracted rows</h3>
              <p className="text-xs text-muted-foreground">Uncheck any row you don't want to import.</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-56">
                <Label>Chama</Label>
                <Select value={chamaId} onValueChange={setChamaId}>
                  <SelectTrigger><SelectValue placeholder="Select chama" /></SelectTrigger>
                  <SelectContent>
                    {chamas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={importSelected} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Import selected
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2"></th>
                  <th className="py-2 pr-2">Contributor</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2 pr-2">Reference</th>
                  <th className="py-2 pr-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-2">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={(checked) => setRows((rs) => rs.map((x, idx) => idx === i ? { ...x, selected: !!checked } : x))}
                      />
                    </td>
                    <td className="py-2 pr-2">{r.contributor_name}</td>
                    <td className="py-2 pr-2 font-semibold">KES {r.amount.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{r.reference ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{r.contributed_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
