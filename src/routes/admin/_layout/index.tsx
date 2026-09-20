import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, ArrowUpRight, ArrowRightLeft, Check, Circle, ClipboardCopy,
  CreditCard, Loader2, Pencil, Plus, Printer, RefreshCw, Router,
  Search, Ticket, TrendingUp, Tv, Users, Wifi, WifiOff, Zap,
} from "lucide-react";import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  saveRouter, testRouterConnection, terminateSession,
  generateVouchers, transferSession,
} from "@/lib/palnet.functions";
import { formatKes, formatCountdown, type Plan } from "@/lib/palnet";
import { getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";

export const Route = createFileRoute("/admin/_layout/")({
  head: () => ({ meta: [{ title: "PalNet Admin — Dashboard" }] }),
  component: AdminDashboard,
});

/* ─── Types ─────────────────────────────────────────────────────────────── */
type RouterRow = {
  id: string; name: string; ip_address: string; api_port: number;
  location: string | null; status: string; last_ping: string | null;
};
type SessionRow = {
  id: string; mac_address: string | null; ip_address: string | null;
  phone_number: string | null; device_label: string | null;
  start_time: string; end_time: string; status: string;
  internet_plans: { name: string; category: string } | null;
  routers: { name: string } | null;
};
type TxRow = {
  id: string; created_at: string; phone_number: string | null;
  amount_kes: number; payment_method: string;
  transaction_reference: string | null; status: string;
  internet_plans: { name: string } | null;
};

/* ─── Data hooks ─────────────────────────────────────────────────────────── */
function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
      const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);

      const tvPlanIds =
        (await supabase.from("internet_plans").select("id").eq("category", "tv")).data?.map(
          (p: { id: string }) => p.id,
        ) ?? [];

      const [weekTx, activeSubs, online, total, unusedVouchers, failed24h, pending] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("amount_kes, created_at, status, payment_method")
            .gte("created_at", weekStart.toISOString()),
          supabase
            .from("user_subscriptions")
            .select("id, plan_id, end_time, start_time")
            .eq("status", "active")
            .gt("end_time", now),
          supabase.from("routers").select("id", { count: "exact", head: true }).eq("status", "online"),
          supabase.from("routers").select("id", { count: "exact", head: true }),
          supabase.from("vouchers").select("id", { count: "exact", head: true }).eq("status", "unused"),
          supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("status", "failed")
            .gte("created_at", new Date(nowMs - 86_400_000).toISOString()),
          supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ]);

      const completed = (weekTx.data ?? []).filter((t) => t.status === "completed");
      const sumFrom = (fromIso: string, toIso?: string) =>
        completed
          .filter((t) => t.created_at >= fromIso && (!toIso || t.created_at < toIso))
          .reduce((s, t) => s + Number(t.amount_kes), 0);

      const todayRevenue = sumFrom(todayStart.toISOString());
      const yesterdayRevenue = sumFrom(yesterdayStart.toISOString(), todayStart.toISOString());
      const weekRevenue = sumFrom(weekStart.toISOString());

      /* 7-day trend, oldest → newest */
      const trend = Array.from({ length: 7 }, (_, i) => {
        const dayStart = new Date(todayStart.getTime() - (6 - i) * 86_400_000);
        const dayEnd = new Date(dayStart.getTime() + 86_400_000);
        return {
          day: dayStart.toLocaleDateString("en-KE", { weekday: "short" }),
          date: dayStart.toISOString().slice(0, 10),
          revenue: sumFrom(dayStart.toISOString(), dayEnd.toISOString()),
          sales: completed.filter(
            (t) => t.created_at >= dayStart.toISOString() && t.created_at < dayEnd.toISOString(),
          ).length,
        };
      });

      const subs = activeSubs.data ?? [];
      const activeTv = subs.filter((s) => tvPlanIds.includes(s.plan_id)).length;
      const expiringSoon = subs.filter(
        (s) => new Date(s.end_time).getTime() - nowMs < 15 * 60_000,
      ).length;

      const revenueChangePct =
        yesterdayRevenue > 0
          ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
          : todayRevenue > 0
            ? 100
            : 0;

      return {
        todayRevenue,
        yesterdayRevenue,
        weekRevenue,
        revenueChangePct,
        salesToday: completed.filter((t) => t.created_at >= todayStart.toISOString()).length,
        avgSaleToday: (() => {
          const n = completed.filter((t) => t.created_at >= todayStart.toISOString()).length;
          return n ? Math.round(todayRevenue / n) : 0;
        })(),
        trend,
        activeAll: subs.length,
        activeTv,
        activeHotspot: subs.length - activeTv,
        expiringSoon,
        onlineRouters: online.count ?? 0,
        totalRouters: total.count ?? 0,
        unusedVouchers: unusedVouchers.count ?? 0,
        failed24h: failed24h.count ?? 0,
        pendingPayments: pending.count ?? 0,
      };
    },
  });
}

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

function useSessions(search: string) {
  return useQuery({
    queryKey: ["admin-sessions-dash", search],
    refetchInterval: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("user_subscriptions")
        .select("id,mac_address,ip_address,phone_number,device_label,start_time,end_time,status,internet_plans(name,category),routers(name)")
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("end_time", { ascending: false })
        .limit(25);
      if (search) q = q.or(`mac_address.ilike.%${search}%,ip_address.ilike.%${search}%,phone_number.ilike.%${search}%`) as typeof q;
      const { data } = await q;
      return (data ?? []) as unknown as SessionRow[];
    },
  });
}

function useTransactions(search: string) {
  return useQuery({
    queryKey: ["admin-tx-dash", search],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("id,created_at,phone_number,amount_kes,payment_method,transaction_reference,status,internet_plans(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (search) q = q.or(`phone_number.ilike.%${search}%,transaction_reference.ilike.%${search}%`) as typeof q;
      const { data } = await q;
      return (data ?? []) as unknown as TxRow[];
    },
  });
}

function usePlansSimple() {
  return useQuery({
    queryKey: ["admin-plans-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("internet_plans").select("id,name,price_kes").eq("is_active", true).order("price_kes");
      return (data ?? []) as Pick<Plan, "id" | "name" | "price_kes">[];
    },
  });
}

/* ─── Small reusable pieces ──────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="admin-card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}>
          <Icon className="size-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      <div className="flex items-center gap-1 text-xs text-emerald-400">
        <ArrowUpRight className="size-3" /> Live
      </div>
    </div>
  );
}

function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-bold tracking-wide text-white">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function TxStatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
    status === "pending"   ? "bg-amber-500/15 text-amber-400" :
                             "bg-red-500/15 text-red-400";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

/* ─── Router Add / Edit Modal ────────────────────────────────────────────── */
const EMPTY_R = { name: "", ip_address: "", api_port: 8728, location: "" };

function RouterModal({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void;
  editing: RouterRow | null; onSaved: () => void;
}) {
  const save = useServerFn(saveRouter);
  const [form, setForm] = useState(() =>
    editing ? { name: editing.name, ip_address: editing.ip_address, api_port: editing.api_port, location: editing.location ?? "" } : EMPTY_R
  );
  const [busy, setBusy] = useState(false);

  // reset when modal opens with new editing target
  const [lastId, setLastId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== lastId) {
    setLastId(editing?.id ?? null);
    setForm(editing ? { name: editing.name, ip_address: editing.ip_address, api_port: editing.api_port, location: editing.location ?? "" } : EMPTY_R);
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: k === "api_port" ? Number(e.target.value) : e.target.value }));

  async function handleSave() {
    if (!form.name.trim() || !form.ip_address.trim()) { toast.error("Name and IP are required."); return; }
    setBusy(true);
    try {
      const r = await save({ data: { id: editing?.id ?? null, name: form.name, ip_address: form.ip_address, api_port: Number(form.api_port), location: form.location || null } });
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) { onSaved(); onClose(); }
    } catch { toast.error("Failed to save router"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="admin-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">
            {editing ? "Edit Router" : "Register New Router / Access Point"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="admin-label">Router Name *</Label>
            <Input value={form.name} onChange={f("name")} className="admin-input" placeholder="PalNet-AP-01" />
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">IP Address *</Label>
            <Input value={form.ip_address} onChange={f("ip_address")} className="admin-input" placeholder="192.168.88.1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="admin-label">API Port</Label>
              <Input type="number" value={form.api_port} onChange={f("api_port")} className="admin-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">Location / Site</Label>
              <Input value={form.location} onChange={f("location")} className="admin-input" placeholder="Rooftop Block A" />
            </div>
          </div>
          <p className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-2.5 text-xs text-slate-500">
            Router API credentials (username / password) are configured via environment variables
            <code className="ml-1 text-cyan-400">ROUTER_API_USER</code> and
            <code className="ml-1 text-cyan-400">ROUTER_API_PASSWORD</code>.
          </p>
          <Button className="admin-btn-primary w-full" disabled={busy} onClick={handleSave}>
            {busy && <Loader2 className="animate-spin size-4" />}
            {editing ? "Save Changes" : "Register Router"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Quick Voucher Generator ────────────────────────────────────────────── */
function QuickVoucherWidget() {
  const { data: plans } = usePlansSimple();
  const generate = useServerFn(generateVouchers);
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [qty, setQty] = useState(5);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const selectedPlan = plans?.find((p) => p.id === planId);

  async function handleGen() {
    if (!planId) { toast.error("Select a plan first."); return; }
    setBusy(true);
    try {
      const r = await generate({ data: { planId, quantity: qty } });
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) { setCodes(r.codes); await queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] }); }
    } catch { toast.error("Failed to generate vouchers"); }
    finally { setBusy(false); }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="admin-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Ticket className="size-4 text-cyan-400" />
        <p className="text-sm font-bold text-white">Quick Voucher Generator</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="admin-label">Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger className="admin-input h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(plans ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name} — {formatKes(p.price_kes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="admin-label">Quantity</Label>
          <Input
            type="number" min={1} max={200} value={qty}
            onChange={(e) => setQty(Math.min(200, Math.max(1, Number(e.target.value))))}
            className="admin-input h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button className="admin-btn-primary flex-1 h-8 text-xs gap-1.5" disabled={busy || !planId} onClick={handleGen}>
          {busy ? <Loader2 className="animate-spin size-3.5" /> : <Ticket className="size-3.5" />}
          Generate {qty} Codes
        </Button>
        {codes.length > 0 && (
          <>
            <Button variant="outline" size="sm" className="admin-btn-outline h-8 text-xs gap-1" onClick={copyAll}>
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <ClipboardCopy className="size-3.5" />}
              Copy
            </Button>
            <Button variant="outline" size="sm" className="admin-btn-outline h-8 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print
            </Button>
          </>
        )}
      </div>

      {codes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            {codes.length} codes · {selectedPlan?.name ?? "—"} · {selectedPlan ? formatKes(codes.length * selectedPlan.price_kes) : ""} face value
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {codes.map((c) => (
              <div key={c} className="flex flex-col items-center rounded-lg border border-slate-700/60 bg-slate-900/80 p-2">
                <p className="text-xs text-slate-500">PalNet</p>
                <p className="font-mono text-xs font-bold tracking-[0.2em] text-white">{c}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Reconnect Lookup Tool ──────────────────────────────────────────────── */
function ReconnectLookup() {
  const transfer = useServerFn(transferSession);
  const queryClient = useQueryClient();
  const [sms, setSms] = useState("");
  const [extracted, setExtracted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleSmsChange(text: string) {
    setSms(text);
    const match = text.match(/\b([A-Z0-9]{10})\b/);
    setExtracted(match?.[1] ?? null);
    setResult(null);
  }

  async function handleTransfer(code: string) {
    setBusy(true);
    try {
      const r = await transfer({
        data: {
          code: code.toUpperCase().replace(/\s/g, ""),
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          userAgent: null,
          deviceLabel: null,
        },
      });
      setResult(r.message);
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) await queryClient.invalidateQueries();
    } catch { toast.error("Transfer failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="admin-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="size-4 text-cyan-400" />
        <p className="text-sm font-bold text-white">Session Reconnect / Transfer Lookup</p>
      </div>
      <p className="text-xs text-slate-500">
        Paste a customer's full Safaricom M-Pesa SMS to extract the reference and manually transfer
        their session to a new device, or type the code directly.
      </p>
      <div className="space-y-1.5">
        <Label className="admin-label">Paste M-Pesa SMS or enter code</Label>
        <Textarea
          value={sms}
          onChange={(e) => handleSmsChange(e.target.value)}
          placeholder={`Paste full SMS e.g. "RHJ1K2L3M4 Confirmed. Ksh35.00 paid to PalNet…" or just type the code`}
          className="admin-input h-20 resize-none font-mono text-xs"
        />
      </div>

      {sms && (
        <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${extracted ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          {extracted ? (
            <>
              <div>
                <p className="text-xs text-slate-500">Extracted code</p>
                <p className="mt-0.5 font-mono text-lg font-black tracking-[0.3em] text-white">
                  {extracted}
                </p>
              </div>
              <Button
                size="sm"
                className="admin-btn-primary h-8 shrink-0 gap-1.5 text-xs"
                disabled={busy}
                onClick={() => handleTransfer(extracted)}
              >
                {busy ? <Loader2 className="animate-spin size-3.5" /> : <ArrowRightLeft className="size-3.5" />}
                Transfer
              </Button>
            </>
          ) : (
            <p className="text-xs text-red-400">No 10-character M-Pesa code found in that text.</p>
          )}
        </div>
      )}

      {result && (
        <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-300">
          {result}
        </p>
      )}

      <Link to="/admin/sessions" className="text-xs text-cyan-400 hover:underline">
        → View all active sessions
      </Link>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, refetch, isFetching } = useAdminStats();
  const { data: routers, isLoading: routersLoading } = useRouters();
  const queryClient = useQueryClient();
  const pingFn = useServerFn(testRouterConnection);
  const kickFn = useServerFn(terminateSession);
  const reconnectFn = useServerFn(transferSession);
  const [pingBusy, setPingBusy] = useState<string | null>(null);
  const [kickBusy, setKickBusy] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState<string | null>(null);
  const [routerModal, setRouterModal] = useState<{ open: boolean; editing: RouterRow | null }>({ open: false, editing: null });
  const [sessionSearch, setSessionSearch] = useState("");
  const [txSearch, setTxSearch] = useState("");

  const { data: sessions, isLoading: sessionsLoading } = useSessions(sessionSearch);
  const { data: transactions, isLoading: txLoading } = useTransactions(txSearch);
  const now = Date.now();

  async function handlePing(routerId: string) {
    setPingBusy(routerId);
    try {
      const r = await pingFn({ data: { routerId } });
      toast[r.ok && r.online ? "success" : "error"](r.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-routers"] });
    } catch { toast.error("Ping failed"); }
    finally { setPingBusy(null); }
  }

  async function handleKick(sessionId: string) {
    setKickBusy(sessionId);
    try {
      const r = await kickFn({ data: { subscriptionId: sessionId } });
      toast[r.ok ? "success" : "error"](r.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-sessions-dash"] });
    } catch { toast.error("Failed to terminate"); }
    finally { setKickBusy(null); }
  }

  async function handleConnect(txRef: string | null) {
    if (!txRef) { toast.error("No transaction reference for this payment."); return; }
    setConnectBusy(txRef);
    try {
      const r = await reconnectFn({
        data: { code: txRef, macAddress: null, ipAddress: null, userAgent: null, deviceLabel: null },
      });
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) await queryClient.invalidateQueries();
    } catch { toast.error("Connect failed"); }
    finally { setConnectBusy(null); }
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white">
            Network Overview & Control Center
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Live network snapshot · auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-cyan-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── KPI Bar ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl admin-skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Today's Revenue (KES)"
            value={String(stats?.todayRevenue ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            sub="Completed M-Pesa payments"
            icon={TrendingUp}
            color="bg-emerald-500/15 text-emerald-400"
          />
          <KpiCard
            label="Active Hotspot Users"
            value={String(stats?.activeAll ?? 0)}
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
            label="Total Routers Online"
            value={`${stats?.onlineRouters ?? 0} / ${stats?.totalRouters ?? 0}`}
            sub="Access points active"
            icon={Router}
            color="bg-blue-500/15 text-blue-400"
          />
        </div>
      )}

      {/* ── Router Status & Location Map ── */}
      <div>
        <SectionHead
          title="Router Status & Location Map"
          sub="MikroTik / OpenWrt access points — click a row to edit"
          action={
            <Button size="sm" className="admin-btn-primary h-8 gap-1.5 text-xs"
              onClick={() => setRouterModal({ open: true, editing: null })}>
              <Plus className="size-3.5" /> Add Router
            </Button>
          }
        />
        <div className="admin-card overflow-hidden">
          {routersLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 admin-skeleton rounded-lg" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Router</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(routers ?? []).map((r) => (
                    <tr key={r.id}
                      className="cursor-pointer hover:bg-slate-800/30 transition-colors"
                      onClick={() => setRouterModal({ open: true, editing: r })}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Status dot */}
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                            r.status === "online" ? "bg-emerald-500/15" : "bg-red-500/15"
                          }`}>
                            {r.status === "online"
                              ? <Wifi className="size-3.5 text-emerald-400" />
                              : <WifiOff className="size-3.5 text-red-400" />}
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {r.name}
                              <span className="ml-2 font-mono font-normal text-slate-400">
                                — {r.ip_address}
                              </span>
                              {r.location && (
                                <span className="ml-1 text-slate-500">· {r.location}</span>
                              )}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              r.status === "online" ? "text-emerald-400" : "text-red-400"
                            }`}>
                              {r.status === "online"
                                ? `Online · ${r.last_ping ? Math.round((Date.now() - new Date(r.last_ping).getTime()) / 86400000) + "d Up" : "Active"}`
                                : `Offline — Last Ping: ${r.last_ping ? Math.round((Date.now() - new Date(r.last_ping).getTime()) / 60000) + "m ago" : "Never"}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm"
                            className="admin-btn-outline h-7 gap-1 text-xs"
                            disabled={pingBusy === r.id}
                            onClick={() => handlePing(r.id)}>
                            {pingBusy === r.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <Activity className="size-3" />}
                            + Ping
                          </Button>
                          <Button variant="outline" size="sm"
                            className="admin-btn-outline h-7 gap-1 text-xs">
                            <CreditCard className="size-3" /> Logs
                          </Button>
                          <Button variant="outline" size="sm"
                            className="h-7 gap-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20"
                            onClick={() => setRouterModal({ open: true, editing: r })}>
                            <RefreshCw className="size-3" /> Reboot API
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!routers?.length && (
                    <tr>
                      <td colSpan={2} className="px-4 py-10 text-center text-slate-600">
                        No routers registered yet — click "Add Router" to connect your first access point.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent M-Pesa Transactions + Active Sessions ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* M-Pesa transactions */}
        <div>
          <SectionHead
            title="Recent M-Pesa Transactions"
            sub="Live transaction log"
            action={
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Phone / ref…"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="admin-input h-7 pl-7 text-xs"
                />
              </div>
            }
          />
          <div className="admin-card overflow-hidden">
            {txLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-3 py-2.5 text-left font-medium">Timestamp</th>
                      <th className="px-3 py-2.5 text-left font-medium">Plan</th>
                      <th className="px-3 py-2.5 text-left font-medium">Customer Number</th>
                      <th className="px-3 py-2.5 text-right font-medium">Amount (KES)</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                      <th className="px-3 py-2.5 text-left font-medium">M-Pesa Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(transactions ?? []).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-2.5 max-w-[90px] truncate text-slate-300">
                          {tx.internet_plans?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-white">{tx.phone_number ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-400">
                          {formatKes(tx.amount_kes)}
                        </td>
                        <td className="px-3 py-2.5"><TxStatusBadge status={tx.status} /></td>
                        <td className="px-3 py-2.5 max-w-[80px] truncate font-mono text-slate-600">
                          {tx.transaction_reference ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {!transactions?.length && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                          No transactions yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Link to="/admin/transactions" className="mt-2 block text-right text-xs text-cyan-400 hover:underline">
            View all transactions →
          </Link>
        </div>

        {/* Active sessions */}
        <div>
          <SectionHead
            title="Active Customer Sessions"
            sub={`${sessions?.length ?? 0} connected devices`}
            action={
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="MAC / IP / phone…"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="admin-input h-7 pl-7 text-xs"
                />
              </div>
            }
          />
          <div className="admin-card overflow-hidden">
            {sessionsLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500">
                      <th className="px-3 py-2.5 text-left font-medium">Device IP/MAC</th>
                      <th className="px-3 py-2.5 text-left font-medium">Plan Active</th>
                      <th className="px-3 py-2.5 text-left font-medium">Expires At</th>
                      <th className="px-3 py-2.5 text-left font-medium">Router Node</th>
                      <th className="px-3 py-2.5 text-right font-medium">Terminate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(sessions ?? []).map((s) => {
                      const remaining = new Date(s.end_time).getTime() - now;
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-2.5">
                            <p className="font-mono text-white">{s.ip_address ?? "—"}</p>
                            <p className="max-w-[100px] truncate font-mono text-slate-600">
                              {s.mac_address ?? ""}
                            </p>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                              ${s.internet_plans?.category === "tv" ? "bg-violet-500/15 text-violet-400" :
                                s.internet_plans?.category === "home" ? "bg-blue-500/15 text-blue-400" :
                                "bg-cyan-500/15 text-cyan-400"}`}>
                              {s.internet_plans?.name ?? "—"}
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 font-mono tabular-nums text-xs ${remaining < 300_000 ? "text-red-400" : "text-slate-400"}`}>
                            {new Date(s.end_time).toLocaleDateString("en-KE")}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {s.routers?.name ?? "Auto"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                className="h-6 gap-1 border border-red-500/20 bg-red-500/15 px-2 text-xs text-red-400 hover:bg-red-500/25 hover:text-red-300"
                                disabled={kickBusy === s.id}
                                onClick={() => handleKick(s.id)}
                              >
                                {kickBusy === s.id
                                  ? <Loader2 className="size-3 animate-spin" />
                                  : <Zap className="size-3" />}
                                Instant Terminate Session
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!sessions?.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                          No active sessions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Link to="/admin/sessions" className="mt-2 block text-right text-xs text-cyan-400 hover:underline">
            View all sessions →
          </Link>
        </div>
      </div>

      {/* ── Voucher Generator + Reconnect Tool ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <QuickVoucherWidget />
        <ReconnectLookup />
      </div>

      {/* ── Router modal ── */}
      <RouterModal
        open={routerModal.open}
        editing={routerModal.editing}
        onClose={() => setRouterModal({ open: false, editing: null })}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-routers"] })}
      />
    </div>
  );
}
