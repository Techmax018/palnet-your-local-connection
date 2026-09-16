import { useEffect, useRef, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ChevronDown,
  Circle,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Router,
  Search,
  ShieldBan,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/usePalNet";

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});

/* ── Only this email is allowed into the admin panel ── */
const ADMIN_EMAIL = "maxnjuguna18@gmail.com";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/routers", label: "Routers", icon: Router },
  { to: "/admin/plans", label: "Internet Plans", icon: Package },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/sessions", label: "Active Sessions", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: CreditCard },
  { to: "/admin/anti-tethering", label: "Anti-Tethering", icon: ShieldBan },
] as const;

/* ─── Sidebar (lifted out so it never remounts) ──────────────────────────── */
function Sidebar({
  mobile,
  onClose,
  displayName,
  email,
  onSignOut,
  pathname,
}: {
  mobile?: boolean;
  onClose?: () => void;
  displayName: string;
  email: string;
  onSignOut: () => void;
  pathname: string;
}) {
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: "#0d1117" }}
    >
      {/* ── Brand ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
        <div className="relative shrink-0">
          <img
            src="/favicon.png"
            alt="PalNet"
            className="h-9 w-9 rounded-xl object-cover ring-1 ring-cyan-500/40"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1117] bg-emerald-400" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold tracking-wide text-white">
            PalNet
          </p>
          <p className="text-xs uppercase tracking-widest text-cyan-400/80">
            Control Panel
          </p>
        </div>
        {mobile && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-500 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <div className="flex-1 overflow-y-auto py-4">
        <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Navigation
        </p>
        <nav className="space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact
              ? pathname === to
              : pathname.startsWith(to) && to !== "/admin";
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "admin-nav-active"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    isActive
                      ? "text-cyan-400"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                <span className="truncate">{label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── System status + user ── */}
      <div className="shrink-0 space-y-2 border-t border-slate-800 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-600">
          System Status
        </p>
        <div className="flex items-center gap-2">
          <Circle className="size-2 fill-emerald-400 text-emerald-400" />
          <span className="text-xs text-slate-400">
            API:{" "}
            <span className="font-medium text-emerald-400">Online</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Circle className="size-2 fill-emerald-400 text-emerald-400" />
          <span className="text-xs text-slate-400">
            RouterOS:{" "}
            <span className="font-medium text-emerald-400">Connected</span>
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-slate-800/60 pt-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/30">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:text-red-400"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main layout ─────────────────────────────────────────────────────────── */
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

  /* ── Auth gate ── */
  useEffect(() => {
    if (loading || adminLoading) return;
    if (!user) {
      navigate({ to: "/admin/login", replace: true });
      return;
    }
    // Hard-lock to the single authorised email
    if (user.email !== ADMIN_EMAIL) {
      supabase.auth.signOut();
      navigate({ to: "/admin/login", replace: true });
      return;
    }
    if (isAdmin === false) {
      navigate({ to: "/admin/login", replace: true });
    }
  }, [user, isAdmin, loading, adminLoading, navigate]);

  /* "/" key shortcut */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
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

  /* ── Loading state ── */
  if (loading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center admin-bg">
        <div className="flex flex-col items-center gap-3">
          <Activity className="size-8 animate-pulse text-cyan-400" />
          <p className="text-sm uppercase tracking-widest text-slate-400">
            Authenticating…
          </p>
        </div>
      </div>
    );
  }

  /* Render nothing while redirect is in flight */
  if (!user || user.email !== ADMIN_EMAIL || !isAdmin) return null;

  const displayName =
    (user.email?.split("@")[0] ?? "Admin")
      .replace(/[^a-z0-9]/gi, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const sidebarProps = {
    displayName,
    email: user.email ?? "",
    onSignOut: signOut,
    pathname,
  };

  return (
    <div className="flex h-screen overflow-hidden admin-bg">
      {/* ── Desktop sidebar (always visible ≥ lg) ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 lg:flex">
        <Sidebar {...sidebarProps} />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 w-72 border-r border-slate-800">
            <Sidebar
              {...sidebarProps}
              mobile
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header
          className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-4 lg:px-6"
          style={{
            background: "rgba(13,17,23,0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Title */}
          <p className="hidden text-sm font-semibold tracking-wide text-white sm:block">
            PalNet{" "}
            <span className="text-slate-500">|</span>{" "}
            <span className="text-cyan-400">Admin Control Panel</span>
          </p>

          {/* Global search */}
          <div className="mx-auto w-full max-w-xs lg:mx-0 lg:ml-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                ref={searchRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search… (press /)"
                className="admin-input h-8 w-full pl-9 text-xs"
              />
              <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-slate-700 bg-slate-800 px-1.5 text-xs text-slate-500 sm:flex">
                /
              </kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <button className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/30">
                  {displayName.charAt(0)}
                </div>
                <span className="hidden text-xs font-medium text-white sm:block">
                  {displayName}
                </span>
                <ChevronDown
                  className={`size-3.5 transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl">
                  <p className="truncate px-3 py-1.5 text-xs text-slate-500">
                    {user.email}
                  </p>
                  <div className="my-1 border-t border-slate-800" />
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet context={{ globalSearch: searchValue }} />
        </main>
      </div>
    </div>
  );
}
