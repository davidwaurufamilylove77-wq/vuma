import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/widgets";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, User, Lock, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/profile")({ component: ProfilePage });

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().regex(/^(?:\+?254|0)\d{9}$/, "Use 0712345678 or +254712345678").or(z.literal("")),
});

const passwordSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function ProfilePage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ full_name: fullName, phone });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
      .eq("id", user!.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile", user?.id] });
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ password: newPassword, confirm: confirmPassword });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  };

  const initials = (fullName || user?.email || "?")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div>
      <PageHeader title="Profile & Settings" description="Manage your personal information and account security." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar + role summary */}
        <Card className="p-6 flex flex-col items-center text-center h-fit">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="mt-4 font-semibold text-lg">{fullName || "—"}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary capitalize">
                <Shield className="h-3 w-3" />
                {r.replace("_", " ")}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
          </p>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Personal info */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Personal information</h2>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712345678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>
              <Button type="submit" disabled={savingProfile} className="bg-gradient-primary text-primary-foreground">
                {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </form>
          </Card>

          {/* Password */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Change password</h2>
            </div>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={savingPassword} variant="outline">
                {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
