import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRightLeft, Cable, ChevronDown, Clock, Gauge, Loader2,
  Plus, ShieldCheck, Smartphone, Ticket, Tv, Wifi, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PalNetHeader } from "@/components/PalNetHeader";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { TvGuide } from "@/components/TvGuide";
import { ReconnectPanel } from "@/components/ReconnectPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveSession, useSession, usePlans, getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";
import { supabase } from "@/integrations/supabase/client";
import { submitInstallationRequest, redeemGuestVoucher } from "@/lib/palnet.functions";
import { formatKes, formatCountdown, planDurationLabel, type Plan } from "@/lib/palnet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PalNet Wi-Fi — Hotspot, Home LAN & TV Packages" },
      { name: "description", content: "Buy a PalNet Wi-Fi pass with M-Pesa — hotspot, home internet and Smart TV. No account needed." },
    ],
  }),
  component: CaptivePortal,
});

/* ─── Install modal ────────────────────────────────────────────────────────── */
function InstallModal({ open, onClose, homePlans }: {
  open: boolean; onClose: () => void; homePlans: Plan[];
}) {
  const submit = useServerFn(submitInstallationRequest);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", houseNumber: "", preferredPlanId: "" });
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!form.fullName || !form.phoneNumber || !form.houseNumber) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setBusy(true);
    try {
      const result = await submit({ data: { ...form, preferredPlanId: form.preferredPlanId || null } });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) {
        setForm({ fullName: "", phoneNumber: "", houseNumber: "", preferredPlanId: "" });
        onClose();
      }
    } catch { toast.error("Submission failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Request Home Installation</DialogTitle>
          <DialogDescription className="text-xs">
            LAN cable + indoor Wi-Fi router + free setup — KES 2,500 one-time fee.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name *</Label>
            <Input value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} className="h-9 text-sm" placeholder="John Kamau" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone Number *</Label>
            <Input inputMode="tel" value={form.phoneNumber} onChange={(e) => setForm(f => ({ ...f, phoneNumber: e.target.value }))} className="h-9 text-sm" placeholder="0712 345 678" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location / Area *</Label>
            <Input value={form.houseNumber} onChange={(e) => setForm(f => ({ ...f, houseNumber: e.target.value }))} className="h-9 text-sm" placeholder="e.g. Kasarani, Block C House 14" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Preferred Plan (optional)</Label>
            <Select value={form.preferredPlanId} onValueChange={(v) => setForm(f => ({ ...f, preferredPlanId: v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select a plan…" /></SelectTrigger>
              <SelectContent>
                {homePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} — {formatKes(p.price_kes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full font-display text-sm" disabled={busy} onClick={handleSubmit}>
            {busy && <Loader2 className="animate-spin size-4" />} Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Session banner ───────────────────────────────────────────────────────── */
function SessionBanner({ onTopUp }: { onTopUp: () => void }) {
  const { user } = useSession();
  const { data: session } = useActiveSession(user?.id);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  if (!session) return null;
  const remaining = new Date(session.end_time).getTime() - now;

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 shrink-0">
            <span className="h-2 w-2 rounded-full bg-success pulse-live" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">{session.plan_name ?? "PalNet Access"}</p>
            <p className="text-xs text-muted-foreground">{session.mac_address ?? session.ip_address ?? "Device connected"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-black tabular-nums text-gradient-brand">{formatCountdown(remaining)}</p>
          <Button size="sm" className="h-7 text-xs font-display gap-1" onClick={onTopUp}>
            <Plus className="size-3" /> Top Up
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Voucher bar ──────────────────────────────────────────────────────────── */
function VoucherBar() {
  const redeem = useServerFn(redeemGuestVoucher);
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRedeem() {
    setBusy(true);
    try {
      const result = await redeem({
        data: { code, phone: phone || null, macAddress: getDeviceMac(), ipAddress: getDeviceIp(), deviceLabel: navigator?.userAgent?.slice(0, 60) ?? null },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { setCode(""); setPhone(""); setExpanded(false); await queryClient.invalidateQueries(); }
    } catch { toast.error("Could not redeem. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="surface-panel p-3">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setExpanded(e => !e)}>
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Ticket className="size-3.5 text-accent" /> Have a PalNet Scratch Card?
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="6-digit code" maxLength={20} className="h-8 flex-1 font-display tracking-[0.2em] text-sm uppercase" />
            <Button size="sm" className="h-8 font-display text-xs gap-1" disabled={busy || code.length < 4} onClick={handleRedeem}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />} Redeem
            </Button>
          </div>
          <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone for SMS receipt (optional)" className="h-8 text-xs" />
        </div>
      )}
    </div>
  );
}

/* ─── Plan cards ───────────────────────────────────────────────────────────── */
function HomePlanCard({ plan, badge, onSelect }: { plan: Plan; badge?: string | undefined; onSelect: (p: Plan) => void }) {
  return (
    <div className="surface-panel relative overflow-hidden p-3 gap-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      {badge && <span className="absolute right-2 top-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent border border-accent/30">{badge}</span>}
      <div className="flex items-start justify-between gap-1">
        <p className="font-display text-lg font-black text-gradient-brand leading-none">{formatKes(plan.price_kes)}</p>
        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Gauge className="size-3 text-accent" />{plan.speed_limit_mbps} Mbps</span>
      </div>
      <p className="mt-1 text-xs font-semibold text-foreground leading-snug">{plan.name}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{planDurationLabel(plan)}</p>
      <p className="mt-1.5 text-xs text-muted-foreground/70">Account ID auto-generated after payment.</p>
      <Button size="sm" className="mt-2 w-full font-display text-xs h-7" onClick={() => onSelect(plan)}>
        <Smartphone className="size-3" /> Pay with M-Pesa
      </Button>
    </div>
  );
}

function HotspotCard({ plan, onSelect }: { plan: Plan; onSelect: (p: Plan) => void }) {
  return (
    <button onClick={() => onSelect(plan)} className="surface-panel relative overflow-hidden p-3 text-left transition-all hover:glow-neon active:scale-95">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      <p className="font-display text-xl font-black text-gradient-brand leading-none">{formatKes(plan.price_kes)}</p>
      <p className="mt-1 text-xs font-semibold text-foreground line-clamp-2 leading-snug">{plan.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{planDurationLabel(plan)}</p>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-accent"><Gauge className="size-3" />{plan.speed_limit_mbps}M</div>
    </button>
  );
}

function TvPlanCard({ plan, onSelect }: { plan: Plan; onSelect: (p: Plan) => void }) {
  const [tvIp, setTvIp] = useState("");
  return (
    <div className="surface-panel relative overflow-hidden p-3 gap-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      <p className="font-display text-xl font-black text-gradient-brand leading-none">{formatKes(plan.price_kes)}</p>
      <p className="mt-1 text-xs font-semibold text-foreground">{plan.name}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />{planDurationLabel(plan)}</p>
      <Input value={tvIp} onChange={(e) => setTvIp(e.target.value)} placeholder="TV IP or Account Code" className="mt-2 h-7 text-xs" />
      <Button size="sm" className="mt-2 w-full font-display text-xs h-7" onClick={() => onSelect(plan)}>
        <Tv className="size-3" /> Activate
      </Button>
    </div>
  );
}

function SkeletonGrid({ cols, rows = 2 }: { cols: number; rows?: number }) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {Array.from({ length: cols * rows }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
    </div>
  );
}

/* ─── Main portal ──────────────────────────────────────────────────────────── */
function CaptivePortal() {
  const { data: plans, isLoading } = usePlans();
  const { data: sysSettings } = useQuery({
    queryKey: ["system-settings-public"],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("system_settings").select("*").eq("id", true).maybeSingle();
        return data ?? null;
      } catch { return null; }
    },
  });
  const [selected, setSelected] = useState<Plan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  /* Silently check anti-tethering setting — table may not exist yet */
  const { data: antiTetheringEnabled } = useQuery({
    queryKey: ["anti-tethering-setting"],
    refetchInterval: 300_000,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("network_settings")
          .select("value")
          .eq("key", "anti_tethering_enabled")
          .maybeSingle();
        if (error) return false;
        return data?.value === "true";
      } catch { return false; }
    },
  });

  function openCheckout(plan: Plan) { setSelected(plan); setCheckoutOpen(true); }

  const byCategory = (cat: string) => (plans ?? []).filter((p) => p.category === cat && p.is_active);
  const homePlans = byCategory("home");
  const hotspotPlans = byCategory("hotspot");
  const tvPlans = byCategory("tv");

  const homeBadge = (plan: Plan) => {
    const sorted = [...homePlans].sort((a, b) => a.price_kes - b.price_kes);
    const mid = sorted[Math.floor(sorted.length / 2)];
    return mid?.id === plan.id ? "Most Popular" : undefined;
  };

  return (
    <div className="min-h-screen" style={{ background: "#0b0f19" }}>
      {/* Simple top header — no hamburger, no sidebar */}
      <PalNetHeader online />

      {/* Promo banner */}
      <div className="border-b border-accent/20 bg-accent/5 px-4 py-2">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs text-foreground">
            <Cable className="size-3.5 text-accent shrink-0" />
            <span>
              <strong className="text-accent">Home LAN/Cable Installation</strong>
              {" — "}KES 2,500 · Router + Free Setup
            </span>
          </p>
          <Button
            size="sm"
            className="h-6 shrink-0 text-xs gap-1 border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
            onClick={() => setInstallOpen(true)}
          >
            <Plus className="size-3" /> Request
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-3 pb-16 pt-4 space-y-3">
        <SessionBanner onTopUp={() => { setSelected(null); setCheckoutOpen(true); }} />
        <VoucherBar />

        {/* Package tabs */}
        <Tabs defaultValue="hotspot">
          <TabsList className="w-full">
            <TabsTrigger value="hotspot" className="flex-1 gap-1 text-xs">
              <Wifi className="size-3.5" /> Hotspot
            </TabsTrigger>
            <TabsTrigger value="home" className="flex-1 gap-1 text-xs">
              <Cable className="size-3.5" /> Home LAN
            </TabsTrigger>
            <TabsTrigger value="tv" className="flex-1 gap-1 text-xs">
              <Tv className="size-3.5" /> Smart TV
            </TabsTrigger>
            <TabsTrigger value="reconnect" className="flex-1 gap-1 text-xs">
              <ArrowRightLeft className="size-3.5" /> Reconnect
            </TabsTrigger>
          </TabsList>

          {/* Hotspot */}
          <TabsContent value="hotspot" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Instant wireless access. Auto-detects your device.</p>
            {antiTetheringEnabled && (
              <div className="surface-panel p-3 border-destructive/30">
                <p className="text-xs font-bold text-destructive">Sharing Restricted — each device needs its own pass.</p>
                <Button size="sm" className="mt-2 text-xs" onClick={() => openCheckout(hotspotPlans[0]!)}>Buy Pass for This Device</Button>
              </div>
            )}
            {isLoading ? <SkeletonGrid cols={3} /> : (
              <div className="grid grid-cols-3 gap-2">
                {hotspotPlans.map(p => <HotspotCard key={p.id} plan={p} onSelect={openCheckout} />)}
              </div>
            )}
          </TabsContent>

          {/* Home LAN */}
          <TabsContent value="home" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">Dedicated high-speed cable direct to your indoor Wi-Fi router.</p>
            {isLoading ? <SkeletonGrid cols={2} /> : (
              <div className="grid grid-cols-2 gap-2">
                {homePlans.map(p => <HomePlanCard key={p.id} plan={p} badge={homeBadge(p)} onSelect={openCheckout} />)}
              </div>
            )}
            <Button variant="outline" className="w-full border-dashed border-accent/30 text-accent/80 text-xs hover:bg-accent/5 hover:text-accent" onClick={() => setInstallOpen(true)}>
              <Cable className="size-3.5" /> New connection? Request cable installation →
            </Button>
          </TabsContent>

          {/* Smart TV */}
          <TabsContent value="tv" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">High-priority streaming passes for Smart TVs and Android Boxes.</p>
            <TvGuide />
            {isLoading ? <SkeletonGrid cols={2} /> : (
              <div className="grid grid-cols-2 gap-2">
                {tvPlans.map(p => <TvPlanCard key={p.id} plan={p} onSelect={openCheckout} />)}
              </div>
            )}
          </TabsContent>

          {/* Reconnect */}
          <TabsContent value="reconnect" className="pt-3">
            <div className="surface-panel p-4">
              <ReconnectPanel onSuccess={() => {}} />
            </div>
          </TabsContent>
        </Tabs>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
          <ShieldCheck className="size-3.5 text-accent" />
          Payments secured via M-Pesa · PalNet never stores your PIN.
          <span> · <a href={`tel:${sysSettings?.support_phone ?? "0703161031"}`} className="text-accent/60 hover:text-accent">Support: {sysSettings?.support_phone ?? "0703161031"}</a></span>
          <span> · </span>
          <Link to="/admin/login" className="text-accent/50 hover:text-accent/80 transition-colors text-xs">
            ISP Admin
          </Link>
        </p>
      </main>

      <CheckoutDialog plan={selected} open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} homePlans={homePlans} />
    </div>
  );
}
