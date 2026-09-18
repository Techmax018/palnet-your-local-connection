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
  ChevronLeft,
  Circle,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Router,
  Search,
  Settings,
  ShieldBan,
  Ticket,
  Users,
  X,
  Wifi,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminAlerts } from "@/hooks/useAdminAlerts";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/usePalNet";

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});

const NAV = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    emoji: "📊",
  },
  {
    to: "/admin/routers",
    label: "Routers & APs",
    icon: Router,
    exact: false,
    emoji: "📶",
  },
  {
    to: "/admin/transactions",
    label: "M-Pesa Transactions",
    icon: CreditCard,
    exact: false,
    emoji: "💳",
  },
  {
    to: "/admin/sessions",
    label: "Active Sessions",
    icon: Users,
    exact: false,
    emoji: "👥",
  },
  {
    to: "/admin/vouchers",
    label: "Voucher Generator",
    icon: Ticket,
    exact: false,
    emoji: "🎟️",
  },
  {
    to: "/admin/plans",
    label: "Internet Plans",
    icon: Package,
    exact: false,
    emoji: "📦",
  },
  {
    to: "/admin/anti-tethering",
    label: "Anti-Tethering",
    icon: ShieldBan,
    exact: false,
    emoji: "🛡️",
  },
  {
    to: "/admin/settings",
    label: "Settings & Config",
    icon: Settings,
    exact: false,
    emoji: "⚙️",
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   SIDEBAR COMPONENT
   Accepts `collapsed` prop so the parent controls width, but the internal
   layout adapts: hide labels, show only icons when collapsed.
───────────────────────────────────────────────────────────────────────────── */
function Sidebar({
  collapsed,
  mobile,
  onClose,
  onToggleCollapse,
  displayName,
  email,
  onSignOut,
  pathname,
}: {
  collapsed: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  displayName: string;
  email: string;
  onSignOut: () => void;
  pathname: string;
}) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: "#0d1117" }}
    >
      {/* ── Brand + collapse toggle ───────────────────────────────────────── */}
      <div
        className={`flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 ${
          collapsed ? "justify-center px-3" : "px-5"
        }`}
      >
        {/* Logo */}
        <div className="relative shrink-0">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden"
            style={{ boxShadow: "0 0 18px rgba(0,243,255,0.35)" }}
          >
            <img src="/favicon.png" alt="PalNet" className="h-9 w-9 object-contain" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1117] bg-emerald-400" />
        </div>

        {/* Brand text — hidden when collapsed */}
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold tracking-wide text-white">
              PalNet
            </p>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "rgba(0,243,255,0.7)" }}
            >
              Control Panel
            </p>
          </div>
        )}

        {/* Close button (mobile) or collapse toggle (desktop) */}
        {mobile ? (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className={`rounded-lg p-1.5 text-slate-500 transition-all duration-200 hover:bg-slate-800 hover:text-cyan-400 ${
              collapsed ? "mx-auto" : "ml-auto"
            }`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={`size-4 transition-transform duration-300 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        {!collapsed && (
          <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Navigation
          </p>
        )}

        <nav className={`space-y-0.5 ${collapsed ? "px-1.5" : "px-2"}`}>
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const isActive =
              exact
                ? pathname === to
                : pathname.startsWith(to) && (to as string) !== "/admin";

            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                title={collapsed ? label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg transition-all duration-150 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "admin-nav-active"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {/* Cyan left-border accent on active */}
                {isActive && !collapsed && (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full"
                    style={{ background: "#00f3ff", boxShadow: "0 0 8px #00f3ff" }}
                  />
                )}

                <Icon
                  className={`shrink-0 transition-colors ${
                    collapsed ? "size-5" : "size-4"
                  } ${
                    isActive
                      ? "text-cyan-400"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                  style={isActive ? { filter: "drop-shadow(0 0 6px #00f3ff)" } : undefined}
                />

                {!collapsed && (
                  <>
                    <span className="truncate text-sm font-medium">{label}</span>
                    {isActive && (
                      <span
                        className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "#00f3ff", boxShadow: "0 0 6px #00f3ff" }}
                      />
                    )}
                  </>
                )}

                {/* Tooltip on collapsed mode */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-2 z-50 hidden whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl group-hover:block">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── System status + user footer ──────────────────────────────────── */}
      <div
        className={`shrink-0 border-t border-slate-800/80 ${
          collapsed ? "px-2 py-3 space-y-3" : "p-4 space-y-2"
        }`}
      >
        {!collapsed && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              System Status
            </p>
            <div className="flex items-center gap-2">
              <Circle className="size-2 fill-emerald-400 text-emerald-400" />
              <span className="text-xs text-slate-400">
                API:{" "}
                <span className="font-semibold text-emerald-400">Online</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="size-2 fill-emerald-400 text-emerald-400" />
              <span className="text-xs text-slate-400">
                RouterOS:{" "}
                <span className="font-semibold text-emerald-400">Connected</span>
              </span>
            </div>
          </>
        )}

        {/* Collapsed: just the status dot */}
        {collapsed && (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              title="System Online"
            >
              <Circle className="size-2.5 fill-emerald-400 text-emerald-400" />
            </div>
          </div>
        )}

        {/* User row */}
        <div
          className={`border-t border-slate-800/60 pt-3 ${
            collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2"
          }`}
        >
          {/* Avatar */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
              boxShadow: "0 0 12px rgba(0,243,255,0.3)",
            }}
            title={email}
          >
            {initial}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
          )}

          <button
            onClick={onSignOut}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LAYOUT
───────────────────────────────────────────────────────────────────────────── */
function AdminLayout() {
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /* ── Auth gate — role-only, no hardcoded email ── */
  useEffect(() => {
    if (loading || adminLoading) return;
    if (!user) { navigate({ to: "/admin/login", replace: true }); return; }
    if (isAdmin === false) { navigate({ to: "/admin/login", replace: true }); }
  }, [user, isAdmin, loading, adminLoading, navigate]);

  /* "/" shortcut */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  /* ── Loading ── */
  if (loading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center admin-bg">
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #0891b2, #06b6d4)",
              boxShadow: "0 0 30px rgba(0,243,255,0.4)",
            }}
          >
            <Wifi className="size-7 animate-pulse text-white" />
          </div>
          <p className="text-sm uppercase tracking-widest text-slate-400">
            Authenticating…
          </p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const displayName = (user.email?.split("@")[0] ?? "Admin")
    .replace(/[^a-z0-9]/gi, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const sidebarProps = {
    displayName,
    email: user.email ?? "",
    onSignOut: signOut,
    pathname,
    collapsed,
  };

  const alertsHook = useAdminAlerts();
  const { alerts, unread, unreadCount, isLoading: alertsLoading, markAllRead, dismiss } = alertsHook;

  /* Sidebar width: 256px expanded, 64px collapsed */
  const sidebarWidth = collapsed ? "w-16" : "w-64";

  return (
    <div className="flex h-screen overflow-hidden admin-bg">

      {/* ── Desktop sidebar — visible from md (768px) upward ── */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r border-slate-800/80 transition-all duration-300 ease-in-out ${sidebarWidth}`}
      >
        <Sidebar
          {...sidebarProps}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* ── Mobile drawer overlay — only below md ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer — slides in from the left */}
          <aside className="absolute bottom-0 left-0 top-0 w-72 border-r border-slate-800/80 shadow-2xl">
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              mobile
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ── Main content column ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* ── Top header bar ── */}
        <header
          className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 px-4 lg:px-5"
          style={{
            background: "rgba(13,17,23,0.96)",
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Mobile hamburger — below md only */}
          <button
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Desktop collapse toggle — md and above */}
          <button
            className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-cyan-400 md:flex"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </button>

          {/* Page title */}
          <p className="hidden text-sm font-semibold tracking-wide text-white sm:block">
            PalNet{" "}
            <span className="text-slate-600">|</span>{" "}
            <span style={{ color: "#00f3ff" }}>Admin Control Panel</span>
          </p>

          {/* Global search */}
          <div className="mx-auto w-full max-w-xs lg:mx-0 lg:ml-4 lg:max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                ref={searchRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search… (press /)"
                className="admin-input h-8 w-full pl-9 text-xs"
              />
              <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center rounded border border-slate-700 bg-slate-800 px-1.5 text-xs text-slate-500 sm:flex">
                /
              </kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* System online badge */}
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-live" />
              <span className="text-xs font-medium text-emerald-400">
                System Online
              </span>
            </div>

            {/* Notifications */}
            <button onClick={() => setNotifOpen(true)} className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] h-5 w-5"
                  title={`${unreadCount} unread`}
                >{unreadCount}</span>
              )}
            </button>

            <Dialog open={notifOpen} onOpenChange={(o) => !o && setNotifOpen(false)}>
              <DialogContent className="admin-dialog sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-white">Notifications</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400">Recent alerts</div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-slate-500 hover:text-white" onClick={() => { markAllRead(); }}>
                        Mark all read
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-auto space-y-2">
                    {alertsLoading ? (
                      <div className="text-xs text-slate-500">Loading…</div>
                    ) : alerts.length === 0 ? (
                      <div className="text-xs text-slate-500">No notifications</div>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.id} className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">{a.title}</p>
                              <p className="text-xs text-slate-400 mt-1">{a.detail}</p>
                              <p className="text-xs text-slate-500 mt-1">{new Date(a.at).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <button className="text-xs text-slate-400 hover:text-white" onClick={() => { if (a.to) navigate({ to: a.to }); }}>
                                Open
                              </button>
                              <button className="text-xs text-red-400 hover:text-red-300" onClick={() => { dismiss(a.id); }}>
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-slate-800"
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{
                    background: "linear-gradient(135deg,#0891b2,#06b6d4)",
                    boxShadow: "0 0 10px rgba(0,243,255,0.3)",
                  }}
                >
                  {displayName.charAt(0)}
                </div>
                <span className="hidden text-xs font-semibold text-white sm:block">
                  {displayName}
                </span>
                <ChevronDown
                  className={`size-3.5 text-slate-500 transition-transform duration-200 ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {profileOpen && (
                <>
                  {/* Click-away */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-700/80 bg-[#111827] shadow-2xl">
                    {/* User info */}
                    <div className="border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)" }}
                        >
                          {displayName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {displayName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            Administrator
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-1">
                      <p className="px-3 pb-1 pt-2 text-xs text-slate-600 truncate">
                        {user.email}
                      </p>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <LogOut className="size-3.5" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
