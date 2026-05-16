import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "treasurer" | "member" | "campaign_owner";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  roles: Role[];
  profileName: string | null;   // real full_name from profiles table
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (r: Role) => boolean;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

async function fetchRolesAndProfile(userId: string) {
  const [rolesRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
  ]);
  return {
    roles: (rolesRes.data?.map((r) => r.role as Role)) ?? [],
    profileName: profileRes.data?.full_name ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [roles, setRoles]             = useState<Role[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  // Track the user id we last fetched so we don't double-fetch
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    // Initial session load — fetch roles BEFORE clearing loading
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const { roles, profileName } = await fetchRolesAndProfile(s.user.id);
        fetchedFor.current = s.user.id;
        setRoles(roles);
        setProfileName(profileName);
      }
      setLoading(false);
    });

    // Auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user && fetchedFor.current !== s.user.id) {
        // New user — fetch roles (don't block, but do it ASAP)
        const { roles, profileName } = await fetchRolesAndProfile(s.user.id);
        fetchedFor.current = s.user.id;
        setRoles(roles);
        setProfileName(profileName);
      } else if (!s?.user) {
        fetchedFor.current = null;
        setRoles([]);
        setProfileName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      session,
      roles,
      profileName,
      loading,
      signOut: async () => {
        fetchedFor.current = null;
        await supabase.auth.signOut();
      },
      hasRole: (r) => roles.includes(r),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
