import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Wallet, Megaphone, User as UserIcon,
  LogOut, Shield, CreditCard, FileSearch, Users, Menu, X,
  Settings, ChevronDown, Building2,
} from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

const nav = [
  { to: "/dashboard", label: "Overview",    icon: LayoutDashboard, exact: true },
  { to: "/dashboard/treasurer", label: "Treasurer",  icon: Wallet,         treasurerOnly: true },
  { to: "/dashboard/campaigns", label: "Campaigns",  icon: Megaphone },
  { to: "/dashboard/loans",     label: "Loans",      icon: CreditCard },
  { to: "/dashboard/members",   label: "Members",    icon: Users },
  { to: "/dashboard/import",    label: "Bulk Import",icon: FileSearch,     treasurerOnly: true },
  { to: "/dashboard/member",    label: "My Activity",icon: UserIcon },
  { to: "/dashboard/profile",   label: "Profile",    icon: Settings },
  { to: "/dashboard/admin",     label: "Admin",      icon: Shield,         adminOnly: true },
];

function NavLink({ item, active, onClick }: { item: typeof nav[0]; active: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function ChamaIdentityBlock({ userId, isTreasurer }: { userId: string; isTreasurer: boolean }) {
  const { data: chamas = [] } = useQuery({
    queryKey: ["sidebar-chamas", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chama_members")
        .select("chama_id, role, chamas(id, name, monthly_target)")
        .eq("user_id", userId);
      return (data ?? []).map((m: any) => ({ ...m.chamas, memberRole: m.role }));
    },
  });

  if (chamas.length === 0) return (
    <div className="mx-3 mb-2 rounded-lg border border-dashed border-sidebar-border p-3">
      <p className="text-xs text-muted-foreground">
        {isTreasurer ? "No chama yet — create one" : "Not in a chama yet"}
      </p>
    </div>
  );

  return (
    <div className="mx-3 mb-2 space-y-1">
      {chamas.map((c: any) => {
        const initials = c.name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "CH";
        return (
          <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold leading-tight">{c.name}</p>
              <p className="text-[10px] capitalize text-muted-foreground">{c.memberRole} · KES {Number(c.monthly_target ?? 0).toLocaleString()}/mo</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SidebarContent({ visibleNav, isActive, userId, isTreasurer, onLinkClick, onSignOut }: any) {
  return (
    <>
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Logo className="h-8 w-8" />
        <div>
          <div className="text-base font-bold tracking-tight text-primary">VUMA</div>
          <div className="text-[10px] text-muted-foreground">Financial transparency</div>
        </div>
      </div>

      {/* Chama identity */}
      <div className="pt-3 pb-1">
        <p className="mb-1.5 px-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isTreasurer ? "My chamas" : "My chama"}
        </p>
        <ChamaIdentityBlock userId={userId} isTreasurer={isTreasurer} />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
        <p className="mb-1.5 px-0 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {visibleNav.map((item: any) => (
          <NavLink key={item.to} item={item} active={isActive(item)} onClick={onLinkClick} />
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-sidebar-border p-3">
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground" onClick={onSignOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );
}

function DashboardLayout() {
  const { user, loading, signOut, hasRole, profileName } = useAuth();
  const router = useRouter();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (!loading && !user) router.navigate({ to: "/login" }); }, [loading, user, router]);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  if (loading || !user) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-10 w-10 animate-pulse" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[slide_1s_ease-in-out_infinite] bg-primary rounded-full" />
        </div>
      </div>
    </div>
  );

  const isTreasurer = hasRole("treasurer") || hasRole("admin");
  const visibleNav = nav.filter((item) => {
    if (item.adminOnly && !hasRole("admin")) return false;
    if (item.treasurerOnly && !isTreasurer) return false;
    return true;
  });

  const isActive = (item: typeof nav[0]) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const displayName = profileName ?? user.email?.split("@")[0] ?? "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  // Current page label for header breadcrumb
  const currentPage = nav.find((item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  const handleSignOut = async () => { await signOut(); router.navigate({ to: "/" }); };

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent
          visibleNav={visibleNav}
          isActive={isActive}
          userId={user.id}
          isTreasurer={isTreasurer}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Mobile drawer ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 md:hidden ${sidebarOpen ? "flex translate-x-0" : "flex -translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <div>
              <div className="text-base font-bold tracking-tight text-primary">VUMA</div>
              <div className="text-[10px] text-muted-foreground">Financial transparency</div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="pt-3 pb-1">
            <p className="mb-1.5 px-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isTreasurer ? "My chamas" : "My chama"}
            </p>
            <ChamaIdentityBlock userId={user.id} isTreasurer={isTreasurer} />
          </div>
          <nav className="flex-1 space-y-0.5 px-3 pb-3">
            <p className="mb-1.5 px-0 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Navigation</p>
            {visibleNav.map((item) => (
              <NavLink key={item.to} item={item} active={isActive(item)} onClick={() => setSidebarOpen(false)} />
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-3 pb-6">
            <p className="mb-2 px-3 text-xs text-muted-foreground truncate">{user.email}</p>
            <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 glass px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            {/* Logo on mobile (sidebar hidden) */}
            <div className="flex items-center gap-2 md:hidden">
              <Logo className="h-7 w-7" />
              <span className="font-bold text-primary text-sm">VUMA</span>
            </div>
            {/* Breadcrumb on desktop */}
            {currentPage && (
              <div className="hidden md:flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Dashboard</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold">{currentPage.label}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NotificationsBell />

            {/* User dropdown (replaces theme toggle in header) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">{displayName}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" /> Profile & settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2">
                  <ThemeToggle asMenuItem />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-md md:hidden">
        {[
          { to: "/dashboard",           label: "Home",     icon: LayoutDashboard, exact: true },
          ...(isTreasurer ? [{ to: "/dashboard/treasurer", label: "Chama", icon: Wallet, exact: false }] : []),
          { to: "/dashboard/campaigns", label: "Campaigns",icon: Megaphone,        exact: false },
          { to: "/dashboard/loans",     label: "Loans",    icon: CreditCard,       exact: false },
          { to: "/dashboard/member",    label: "Activity", icon: UserIcon,         exact: false },
        ].map((item) => {
          const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition ${active ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
