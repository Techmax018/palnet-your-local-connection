import { useState } from "react";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Tv, Router, TrendingUp, RefreshCw, Wifi, WifiOff,
  Loader2, Zap, Circle, Activity, ArrowUpRight, Plus, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { saveRouter, testRouterConnection, terminateSession } from "@/lib/palnet.functions";
import { formatKes, formatCountdown } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/")({
  head: () => ({ meta: [{ title: "PalNet Admin — Dashboard" }] }),
  component: AdminDashboard,
});

/* ───────────── KPI Data ───────────── */
function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayRevResult, hotspotResult, tvResult, routerResult, totalRoutersResult] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("amount_kes")
            .eq("status", "completed")
            .gte("created_at", todayStart.toISOString()),
          supabase
            .from("user_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .gt("end_time", now),
          supabase
            .from("user_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .gt("end_time", now)
            .in(
              "plan_id",
              (await supabase.from("internet_plans").select("id").eq("category", "tv")).data?.map(
                (p: { id: string }) => p.id,
              ) ?? [],
            ),
          supabase
            .from("routers")
            .select("id", { count: "exact", head: true })
            .eq("status", "online"),
          supabase.from("routers").select("id", { count: "exact", head: true }),
        ]);

      return {
        todayRevenue: (todayRevResult.data ?? []).reduce(
          (s: number, t: { amount_kes: number }) => s + Number(t.amount_kes),
          0,
        ),
        activeHotspot: hotspotResult.count ?? 0,
        activeTv: tvResult.count ?? 0,
        onlineRouters: routerResult.count ?? 0,
        totalRouters: totalRoutersResult.count ?? 0,
      };
    },
  });
}

/* ───────────── Routers ───────────── */
type RouterRow = {
  id: string; name: string; ip_address: string; api_port: number;
  location: string | null; status: string; last_ping: string | null;
};

function useRouters() {
  return useQuery({
    queryKey: ["admin-routers"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.from("routers").select("*").order("name");
      return (data ?? []) as RouterRow[];
    },
  });
}

/* ───────────── Sessions ───────────── */
type SessionRow = {
  id: string; mac_address: string | null; ip_address: string | null;
  phone_number: string | null; device_label: string | null;
  start_time: string; end_time: string; status: string;
  internet_plans: { name: string; category: string } | null;
  routers: { name: string } | null;
};

function useSessions() {
  return useQuery({
    queryKey: ["admin-sessions-dash"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id, mac_address, ip_address, phone_number, device_label, start_time, end_time, status, internet_plans(name, category), routers(name)")
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("end_time", { ascending: false })
        .limit(20);
      return (data ?? []) as unknown as SessionRow[];
    },
  });
}

/* ───────────── Transactions ───────────── */
type TxRow = {
  id: string; created_at: string; phone_number: string | null;
  amount_kes: number; payment_method: string;
  transaction_reference: string | null; status: string;
  internet_plans: { name: string } | null;
};

function useTransactions() {
  return useQuery({
    queryKey: ["admin-tx-dash"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, created_at, phone_number, amount_kes, payment_method, transaction_reference, status, internet_plans(name)")
        .order("created_at", { ascending: false })
        .limit(15);
      return (data ?? []) as unknown as TxRow[];
    },
  });
}

/* ───────────── Components ───────────── */
function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="admin-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      <div className="flex items-center gap-1 text-xs text-emerald-400">
        <ArrowUpRight className="size-3" />
        <span>Live</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "admin-badge-green",
    pending: "admin-badge-yellow",
    failed: "admin-badge-red",
    online: "admin-badge-green",
    offline: "admin-badge-red",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-800 text-slate-400"}`}>
      {status}
    </span>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ROUTER ADD/EDIT MODAL
═══════════════════════════════════════════ */
const EMPTY_ROUTER = { name: "", ip_address: "", api_port: 8728, location: "" };

function RouterModal({
  open, onClose, editing, onSaved,
}: {
  open: boolean; onClose: () => void;
  editing: RouterRow | null; onSaved: () => void;
}) {
  const save = useServerFn(saveRouter);
  const [form, setForm] = useState(editing
    ? { name: editing.name, ip_address: editing.ip_address, api_port: editing.api_port, location: editing.location ?? "" }
    : EMPTY_ROUTER);
  const [busy, setBusy] = useState(false);

  // sync when editing changes
  useState(() => {
    setForm(editing
      ? { name: editing.name, ip_address: editing.ip_address, api_port: editing.api_port, location: editing.location ?? "" }
      : EMPTY_ROUTER);
  });

  async function handleSave() {
    setBusy(true);
    try {
      const result = await save({
        data: { id: editing?.id ?? null, name: form.name, ip_address: form.ip_address, api_port: Number(form.api_port), location: form.location || null },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { onSaved(); onClose(); }
    } catch { toast.error("Failed to save router"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="admin-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm font-bold">{editing ? "Edit Router" : "Add Router Node"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="admin-label">Router Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="admin-input" placeholder="PalNet-Core-01" />
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">IP Address</Label>
            <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} className="admin-input" placeholder="192.168.88.1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="admin-label">API Port</Label>
              <Input type="number" value={form.api_port} onChange={(e) => setForm((f) => ({ ...f, api_port: Number(e.target.value) }))} className="admin-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="admin-input" placeholder="Rooftop Mast" />
            </div>
          </div>
          <Button className="admin-btn-primary w-full" disabled={busy || !form.name || !form.ip_address} onClick={handleSave}>
            {busy && <Loader2 className="animate-spin size-4" />}
            {editing ? "Save Changes" : "Add Router"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════ */
function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, refetch, isFetching } = useAdminStats();
  const { data: routers, isLoading: routersLoading } = useRouters();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: transactions, isLoading: txLoading } = useTransactions();
  const queryClient = useQueryClient();
  const pingFn = useServerFn(testRouterConnection);
  const kickFn = useServerFn(terminateSession);
  const [pingBusy, setPingBusy] = useState<string | null>(null);
  const [kickBusy, setKickBusy] = useState<string | null>(null);
  const [routerModal, setRouterModal] = useState<{ open: boolean; editing: RouterRow | null }>({ open: false, editing: null });
  const now = Date.now();

  // Search from layout context
  const ctx = Route.useRouteContext() as { globalSearch?: string };
  const search = (ctx?.globalSearch ?? "").toLowerCase();

  async function handlePing(routerId: string) {
    setPingBusy(routerId);
    try {
      const result = await pingFn({ data: { routerId } });
      toast[result.ok && result.online ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-routers"] });
    } catch { toast.error("Ping failed"); }
    finally { setPingBusy(null); }
  }

  async function handleKick(sessionId: string) {
    setKickBusy(sessionId);
    try {
      const result = await kickFn({ data: { subscriptionId: sessionId } });
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-sessions-dash"] });
    } catch { toast.error("Failed to terminate session"); }
    finally { setKickBusy(null); }
  }

  const filteredSessions = (sessions ?? []).filter((s) => {
    if (!search) return true;
    return s.mac_address?.toLowerCase().includes(search) || s.ip_address?.toLowerCase().includes(search) || s.phone_number?.includes(search);
  });

  const filteredTx = (transactions ?? []).filter((tx) => {
    if (!search) return true;
    return tx.phone_number?.includes(search) || tx.transaction_reference?.toLowerCase().includes(search) || tx.internet_plans?.name.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live network overview · auto-refreshes every 30s</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI Bar */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-xl admin-skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Today's Revenue"
            value={formatKes(stats?.todayRevenue ?? 0)}
            sub="Completed M-Pesa payments"
            icon={TrendingUp}
            color="bg-emerald-500/15 text-emerald-400"
          />
          <KpiCard
            label="Active Hotspot Users"
            value={String(stats?.activeHotspot ?? 0)}
            sub="Currently connected"
            icon={Users}
            color="bg-cyan-500/15 text-cyan-400"
          />
          <KpiCard
            label="Active TV Subscribers"
            value={String(stats?.activeTv ?? 0)}
            sub="Streaming now"
            icon={Tv}
            color="bg-violet-500/15 text-violet-400"
          />
          <KpiCard
            label="Routers Online"
            value={`${stats?.onlineRouters ?? 0} / ${stats?.totalRouters ?? 0}`}
            sub="Access points active"
            icon={Router}
            color="bg-blue-500/15 text-blue-400"
          />
        </div>
      )}

      {/* Router Status Table */}
      <div>
        <SectionHeader
          title="Router Status & Location Map"
          sub="MikroTik / OpenWrt access points"
          action={
            <Button size="sm" className="admin-btn-primary h-8 gap-1.5 text-xs" onClick={() => setRouterModal({ open: true, editing: null })}>
              <Plus className="size-3.5" /> Add Router
            </Button>
          }
        />
        <div className="admin-card overflow-hidden">
          {routersLoading ? (
            <div className="p-4 space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-12 admin-skeleton rounded-lg" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Router Name / IP</th>
                    <th className="px-4 py-3 text-left font-medium">Location</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Last Ping</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(routers ?? []).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{r.name}</p>
                        <p className="text-slate-500 font-mono">{r.ip_address}:{r.api_port}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{r.location ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${r.status === "online" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20" : "bg-red-500/15 text-red-400 ring-1 ring-red-500/20"}`}>
                          {r.status === "online"
                            ? <><Circle className="size-1.5 fill-emerald-400" /> Online</>
                            : <><Circle className="size-1.5 fill-red-400" /> Offline</>}
                          {r.status === "online" && r.last_ping && (
                            <span className="text-emerald-500/70 ml-0.5">
                              · {Math.round((Date.now() - new Date(r.last_ping).getTime()) / 60000)}m up
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">
                        {r.last_ping ? new Date(r.last_ping).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" }) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs" disabled={pingBusy === r.id} onClick={() => handlePing(r.id)}>
                            {pingBusy === r.id ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                            Ping
                          </Button>
                          <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs">
                            <Activity className="size-3" /> Logs
                          </Button>
                          <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs" onClick={() => setRouterModal({ open: true, editing: r })}>
                            <Pencil className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!routers?.length && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600">No routers added yet — click "Add Router" to begin</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom split panel */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* M-Pesa Transactions */}
        <div>
          <SectionHeader
            title="Recent M-Pesa Transactions"
            sub={`${filteredTx.length} records`}
          />
          <div className="admin-card overflow-hidden">
            {txLoading ? (
              <div className="p-4 space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-3 py-2.5 text-left font-medium">Time</th>
                      <th className="px-3 py-2.5 text-left font-medium">Plan</th>
                      <th className="px-3 py-2.5 text-left font-medium">Phone</th>
                      <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-3 py-2.5 text-left font-medium">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTx.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2.5 text-slate-500 font-mono tabular-nums whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 max-w-[100px] truncate">{tx.internet_plans?.name ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-white">{tx.phone_number ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-400">{formatKes(tx.amount_kes)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={tx.status} /></td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 truncate max-w-[80px]">{tx.transaction_reference ?? "—"}</td>
                      </tr>
                    ))}
                    {!filteredTx.length && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">No transactions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div>
          <SectionHeader
            title="Active Customer Sessions"
            sub={`${filteredSessions.length} connected devices`}
          />
          <div className="admin-card overflow-hidden">
            {sessionsLoading ? (
              <div className="p-4 space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-3 py-2.5 text-left font-medium">IP / MAC</th>
                      <th className="px-3 py-2.5 text-left font-medium">Plan</th>
                      <th className="px-3 py-2.5 text-left font-medium">Expires</th>
                      <th className="px-3 py-2.5 text-left font-medium">Router</th>
                      <th className="px-3 py-2.5 text-right font-medium">Terminate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSessions.map((s) => {
                      const remaining = new Date(s.end_time).getTime() - now;
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-mono text-white">{s.ip_address ?? "—"}</p>
                            <p className="text-slate-600 font-mono truncate max-w-[100px]">{s.mac_address ?? ""}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.internet_plans?.category === "tv" ? "bg-violet-500/15 text-violet-400" :
                              s.internet_plans?.category === "home" ? "bg-blue-500/15 text-blue-400" :
                              "bg-cyan-500/15 text-cyan-400"
                            }`}>
                              {s.internet_plans?.name ?? "—"}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 font-mono tabular-nums ${remaining < 300_000 ? "text-red-400" : "text-slate-400"}`}>
                            {formatCountdown(remaining)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{s.routers?.name ?? "Auto"}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                className="h-6 gap-1 px-2 text-xs bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:text-red-300"
                                disabled={kickBusy === s.id}
                                onClick={() => handleKick(s.id)}
                              >
                                {kickBusy === s.id ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                                Kick
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredSessions.length && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">No active sessions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Router modal */}
      <RouterModal
        open={routerModal.open}
        editing={routerModal.editing}
        onClose={() => setRouterModal({ open: false, editing: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-routers"] })}
      />
    </div>
  );
}
