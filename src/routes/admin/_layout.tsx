import { useEffect, useState, useRef } from "react";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Router,
  Package,
  Ticket,
  Users,
  CreditCard,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Circle,
  Activity,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/usePalNet";

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/routers", label: "Routers", icon: Router },
  { to: "/admin/plans", label: "Internet Plans", icon: Package },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/sessions", label: "Active Sessions", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: CreditCard },
];

function AdminLayout() {
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !adminLoading) {
      if (!user) navigate({ to: "/admin/login", replace: true });
      else if (isAdmin === false) navigate({ to: "/admin/login", replace: true });
    }
  }, [user, isAdmin, loading, adminLoading, navigate]);

  // "/" key shortcut focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (loading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center admin-bg">
        <div className="flex flex-col items-center gap-3">
          <Activity className="size-8 text-cyan-400 animate-pulse" />
          <p className="text-sm text-slate-400 tracking-widest uppercase">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const adminName = user.email?.split("@")[0] ?? "Admin";
  const displayName = adminName.charAt(0).toUpperCase() + adminName.slice(1);

  function NavItems({ onClick }: { onClick?: () => void }) {
    return (
      <nav className="space-y-0.5 px-2">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === to : pathname.startsWith(to) && to !== "/admin";
          return (
            <Link
              key={to}
              to={to}
              onClick={onClick}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "admin-nav-active"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon className={`size-4 shrink-0 transition-colors ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              {label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}
            </Link>
          );
        })}
      </nav>
    );
  }

  const Sidebar = ({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) => (
    <div className={`flex h-full flex-col ${mobile ? "" : "w-64"}`} style={{ background: "#0d1117" }}>
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <div className="relative">
          <img src="/favicon.png" alt="PalNet" className="h-9 w-9 rounded-xl object-cover ring-1 ring-cyan-500/40" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1117] bg-emerald-400" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white tracking-wide">PalNet</p>
          <p className="text-xs text-cyan-400/80 tracking-widest uppercase">Control Panel</p>
        </div>
        {mobile && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-slate-500 hover:text-white transition-colors">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-auto py-4">
        <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-widest text-slate-600">Navigation</p>
        <NavItems onClick={onClose} />
      </div>

      {/* System Status */}
      <div className="border-t border-slate-800 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-3">System Status</p>
        <div className="flex items-center gap-2">
          <Circle className="size-2 fill-emerald-400 text-emerald-400" />
          <span className="text-xs text-slate-400">API: <span className="text-emerald-400 font-medium">Online</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="size-2 fill-emerald-400 text-emerald-400" />
          <span className="text-xs text-slate-400">RouterOS: <span className="text-emerald-400 font-medium">Connected</span></span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/30">
            {displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button onClick={signOut} className="rounded-lg p-1 text-slate-500 hover:text-red-400 transition-colors" title="Sign out">
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen admin-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-800 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 border-r border-slate-800">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-800 px-4 lg:px-6" style={{ background: "rgba(13,17,23,0.92)", backdropFilter: "blur(12px)" }}>
          <button className="lg:hidden rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-5" />
          </button>

          {/* Title */}
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white tracking-wide">PalNet <span className="text-slate-500">|</span> <span className="text-cyan-400">Admin Control Panel</span></p>
          </div>

          {/* Global search */}
          <div className="flex-1 max-w-xs mx-auto lg:mx-0 lg:ml-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
              <Input
                ref={searchRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search… (press /)"
                className="admin-input pl-9 h-8 text-xs w-full"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 text-xs text-slate-500">/</kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/30">
                  {displayName.charAt(0)}
                </div>
                <span className="hidden sm:block text-xs font-medium text-white">Admin {displayName}</span>
                <ChevronDown className={`size-3.5 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl z-50">
                  <p className="px-3 py-1.5 text-xs text-slate-500 truncate">{user.email}</p>
                  <div className="my-1 border-t border-slate-800" />
                  <button
                    onClick={() => { setProfileOpen(false); signOut(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet context={{ globalSearch: searchValue }} />
        </main>
      </div>
    </div>
  );
}
