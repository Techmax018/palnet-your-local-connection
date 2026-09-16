import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeft, Cable, Home, LogOut, Menu, ShieldCheck,
  Tv, Wifi, X, Ticket, Circle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/usePalNet";

export const PORTAL_NAV = [
  { id: "hotspot", label: "Hotspot",    icon: Wifi,            sub: "Quick passes" },
  { id: "home",    label: "Home LAN",   icon: Home,            sub: "Cable plans" },
  { id: "tv",      label: "Smart TV",   icon: Tv,              sub: "Streaming" },
  { id: "reconnect", label: "Reconnect", icon: ArrowRightLeft, sub: "Switch device" },
] as const;

export type PortalTab = typeof PORTAL_NAV[number]["id"];

interface Props {
  online?: boolean;
  activeTab?: PortalTab;
  onTabChange?: (tab: PortalTab) => void;
}

export function PalNetHeader({ online = true, activeTab, onTabChange }: Props) {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function handleNav(id: PortalTab) {
    onTabChange?.(id);
    setDrawerOpen(false);
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex h-full flex-col" style={{ background: "#0d1117" }}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800/80 px-5">
        <Link to="/" className="flex items-center gap-3" onClick={onClose}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
            style={{ boxShadow: "0 0 14px rgba(0,243,255,0.3)" }}
          >
            <img src="/favicon.png" alt="PalNet" className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-sm font-bold tracking-wide text-white">PalNet Wi-Fi</p>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Circle
                className={`size-1.5 shrink-0 ${online ? "fill-emerald-400 text-emerald-400" : "fill-red-400 text-red-400"}`}
              />
              <span className="truncate text-[10px]">
                {online ? "Reliable Wifi Billing & Connectivity" : "Network unreachable"}
              </span>
            </span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto py-4">
        <p className="mb-2 px-5 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Packages
        </p>
        <nav className="space-y-0.5 px-2">
          {PORTAL_NAV.map(({ id, label, icon: Icon, sub }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
                style={isActive ? {
                  background: "linear-gradient(90deg,rgba(0,243,255,0.12),rgba(0,243,255,0.04))",
                  border: "1px solid rgba(0,243,255,0.2)",
                } : undefined}
              >
                {/* Active left accent */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full"
                    style={{ background: "#00f3ff", boxShadow: "0 0 8px #00f3ff" }}
                  />
                )}
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                  style={isActive ? { filter: "drop-shadow(0 0 5px #00f3ff)" } : undefined}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="text-xs text-slate-500 leading-tight">{sub}</p>
                </div>
                {isActive && (
                  <span
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "#00f3ff", boxShadow: "0 0 6px #00f3ff" }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Scratch card shortcut */}
        <div className="mt-4 px-2">
          <div className="rounded-xl border border-border/50 bg-accent/5 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Ticket className="size-3.5 text-accent" /> Scratch Card?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap the voucher bar on any tab to redeem.
            </p>
          </div>
        </div>
      </div>

      {/* Footer — user actions */}
      <div className="shrink-0 border-t border-slate-800/80 p-4 space-y-2">
        {isAdmin && (
          <Link
            to="/admin"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-cyan-400 hover:bg-slate-800 transition-colors"
          >
            <ShieldCheck className="size-3.5" /> Admin Control Center
          </Link>
        )}
        {user ? (
          <button
            onClick={() => { signOut(); onClose?.(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        ) : (
          <Link
            to="/auth"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 transition-colors"
          >
            <Wifi className="size-3.5" /> Sign in / Create account
          </Link>
        )}
        <p className="px-3 text-[10px] text-slate-700">
          M-Pesa payments secured by Safaricom Daraja
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Top bar (mobile only — hamburger + brand) ── */}
      <header
        className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/70 px-4 lg:hidden"
        style={{ background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.png" alt="PalNet" className="h-7 w-7 rounded-lg object-contain" />
          <span className="font-display text-sm font-bold text-gradient-brand">PalNet Wi-Fi</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link to="/admin"><ShieldCheck className="size-3" /></Link>
            </Button>
          )}
          {user ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={signOut}>
              <LogOut className="size-3.5" />
            </Button>
          ) : (
            <Button asChild size="sm" className="h-7 text-xs">
              <Link to="/auth"><Wifi className="size-3.5" /> Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute bottom-0 left-0 top-0 w-72 shadow-2xl">
            <SidebarContent onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
