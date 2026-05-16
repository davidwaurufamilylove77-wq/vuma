import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/dashboard/widgets";
import { Users, Crown, UserMinus, ArrowUpDown, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/dashboard/members")({ component: MembersPage });

function MembersPage() {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [selectedChama, setSelectedChama] = useState("");

  const { data: chamas = [] } = useQuery({
    queryKey: ["chamas-members-page"],
    queryFn: async () => (await supabase.from("chamas").select("id,name")).data ?? [],
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["chama-members-detail", selectedChama],
    enabled: !!selectedChama,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chama_members")
        .select("id, user_id, role, joined_at, profiles(full_name, phone)")
        .eq("chama_id", selectedChama)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const isTreasurer = hasRole("treasurer") || hasRole("admin");

  const changeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("chama_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["chama-members-detail", selectedChama] });
  };

  const removeMember = async (memberId: string, userId: string) => {
    if (userId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }
    const { error } = await supabase.from("chama_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["chama-members-detail", selectedChama] });
  };

  const treasurers = members.filter((m: any) => m.role === "treasurer" || m.role === "admin");
  const regularMembers = members.filter((m: any) => m.role === "member");

  return (
    <div>
      <PageHeader
        title="Members"
        description="View and manage chama membership and roles."
      />

      <div className="mb-6 max-w-sm">
        <Select value={selectedChama} onValueChange={setSelectedChama}>
          <SelectTrigger>
            <SelectValue placeholder="Select a chama to view members" />
          </SelectTrigger>
          <SelectContent>
            {chamas.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedChama && (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <StatCard label="Total members" value={`${members.length}`} icon={Users} tone="primary" />
            <StatCard label="Treasurers" value={`${treasurers.length}`} icon={Crown} tone="warning" />
            <StatCard label="Members" value={`${regularMembers.length}`} icon={Users} tone="info" />
          </div>

          {isLoading ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">Loading members…</Card>
          ) : members.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No members in this chama yet.</p>
            </Card>
          ) : (
            <Card className="divide-y">
              {members.map((m: any) => {
                const name = m.profiles?.full_name ?? "Unknown";
                const phone = m.profiles?.phone ?? "";
                const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                const isMe = m.user_id === user?.id;
                return (
                  <div key={m.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                        </p>
                        {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(m.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role badge */}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                        m.role === "treasurer" || m.role === "admin"
                          ? "bg-warning/10 text-warning"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {m.role === "treasurer" || m.role === "admin"
                          ? <Crown className="h-3 w-3" />
                          : <Shield className="h-3 w-3" />}
                        {m.role}
                      </span>

                      {/* Role change — only treasurer/admin, not on self */}
                      {isTreasurer && !isMe && (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole(m.id, v)}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="treasurer">Treasurer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* Remove member */}
                      {isTreasurer && !isMe && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0">
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove them from the chama. They can rejoin via an invite link.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeMember(m.id, m.user_id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      {!selectedChama && chamas.length === 0 && (
        <Card className="p-10 text-center border-dashed bg-muted/30">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Create a chama first from the Treasurer page.</p>
        </Card>
      )}
    </div>
  );
}
