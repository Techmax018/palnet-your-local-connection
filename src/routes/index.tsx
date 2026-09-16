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
import { DeviceLockedScreen } from "@/components/DeviceLockedScreen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveSession, useSession, usePlans, getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";
import { supabase } from "@/integrations/supabase/client";
import {
  submitInstallationRequest, redeemGuestVoucher,
} from "@/lib/palnet.functions";
import { formatKes, formatCountdown, planDurationLabel, type Plan } from "@/lib/palnet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PalNet Wi-Fi — Home LAN, Hotspot & TV Packages" },
      { name: "description", content: "Fast local internet — cable home plans, hotspot passes and Smart TV streaming. Pay with M-Pesa, no account needed." },
    ],
  }),
  component: CaptivePortal,
});

/* ═══════════════════════════════════════════════
   INSTALLATION REQUEST MODAL
═══════════════════════════════════════════════ */
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
      const result = await submit({
        data: { ...form, preferredPlanId: form.preferredPlanId || null },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { setForm({ fullName: "", phoneNumber: "", houseNumber: "", preferredPlanId: "" }); onClose(); }
    } catch { toast.error("Submission failed. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-sm">Request Home Installation</DialogTitle>
          <DialogDescription className="text-xs">
            LAN cable + indoor Wi-Fi router + free setup — KES 3,000 one-time fee.
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
            <Label className="text-xs">House / Apartment Number *</Label>
            <Input value={form.houseNumber} onChange={(e) => setForm(f => ({ ...f, houseNumber: e.target.value }))} className="h-9 text-sm" placeholder="Block C, House 14" />
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
            {busy && <Loader2 className="animate-spin size-4" />}
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════
   ACTIVE SESSION BANNER
═══════════════════════════════════════════════ */
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
  const planName = session.plan_name ?? "PalNet Access";
  const mac = session.mac_address;
  const ip = session.ip_address;

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 shrink-0">
            <span className="h-2 w-2 rounded-full bg-success pulse-live" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">{planName}</p>
            <p className="text-xs text-muted-foreground">
              {mac ?? ip ?? "Device connected"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-display text-lg font-black tabular-nums text-gradient-brand">
            {formatCountdown(remaining)}
          </p>
          <Button size="sm" className="h-7 text-xs font-display gap-1" onClick={onTopUp}>
            <Plus className="size-3" /> Top Up
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VOUCHER REDEMPTION BAR
═══════════════════════════════════════════════ */
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
        data: {
          code, phone: phone || null,
          macAddress: getDeviceMac(), ipAddress: getDeviceIp(),
          deviceLabel: navigator?.userAgent?.slice(0, 60) ?? null,
        },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { setCode(""); setPhone(""); setExpanded(false); await queryClient.invalidateQueries(); }
    } catch { toast.error("Could not redeem. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="surface-panel p-3">
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Ticket className="size-3.5 text-accent" />
          Have a PalNet Scratch Card?
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="6-digit code  e.g. 4F9K2P"
              maxLength={20}
              className="h-8 flex-1 font-display tracking-[0.2em] text-sm uppercase"
            />
            <Button size="sm" className="h-8 font-display text-xs gap-1" disabled={busy || code.length < 4} onClick={handleRedeem}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
              Redeem
            </Button>
          </div>
          <Input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone for SMS receipt (optional)"
            className="h-8 text-xs"
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HOME PLAN CARD (with account ID input)
═══════════════════════════════════════════════ */
function HomePlanCard({ plan, badge, onSelect }: {
  plan: Plan; badge?: string;
  onSelect: (plan: Plan, accountId: string) => void;
}) {
  const [accountId, setAccountId] = useState("");

  return (
    <div className="surface-panel relative overflow-hidden p-3 gap-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      {badge && (
        <span className="absolute right-2 top-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent border border-accent/30">
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between gap-1">
        <p className="font-display text-lg font-black text-gradient-brand leading-none">
          {formatKes(plan.price_kes)}
        </p>
        <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <Gauge className="size-3 text-accent" />{plan.speed_limit_mbps} Mbps
        </span>
      </div>
      <p className="mt-1 text-xs font-semibold text-foreground leading-snug">{plan.name}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" />{planDurationLabel(plan)}
      </p>
      <Input
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        placeholder="House / Account ID"
        className="mt-2 h-7 text-xs"
      />
      <Button
        size="sm"
        className="mt-2 w-full font-display text-xs h-7"
        disabled={!accountId.trim()}
        onClick={() => onSelect(plan, accountId.trim())}
      >
        <Smartphone className="size-3" /> Pay with M-Pesa
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HOTSPOT MICRO CARD
═══════════════════════════════════════════════ */
function HotspotCard({ plan, onSelect }: { plan: Plan; onSelect: (p: Plan) => void }) {
  return (
    <button
      onClick={() => onSelect(plan)}
      className="surface-panel relative overflow-hidden p-3 text-left transition-all hover:glow-neon active:scale-95"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      <p className="font-display text-xl font-black text-gradient-brand leading-none">
        {formatKes(plan.price_kes)}
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground line-clamp-2 leading-snug">
        {plan.name}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{planDurationLabel(plan)}</p>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-accent">
        <Gauge className="size-3" />{plan.speed_limit_mbps}M
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════
   TV PLAN CARD
═══════════════════════════════════════════════ */
function TvPlanCard({ plan, onSelect }: { plan: Plan; onSelect: (p: Plan) => void }) {
  const [tvIp, setTvIp] = useState("");
  return (
    <div className="surface-panel relative overflow-hidden p-3 gap-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
      <p className="font-display text-xl font-black text-gradient-brand leading-none">
        {formatKes(plan.price_kes)}
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground">{plan.name}</p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3" />{planDurationLabel(plan)}
      </p>
      <Input
        value={tvIp}
        onChange={(e) => setTvIp(e.target.value)}
        placeholder="TV IP or Account Code"
        className="mt-2 h-7 text-xs"
      />
      <Button
        size="sm"
        className="mt-2 w-full font-display text-xs h-7"
        onClick={() => onSelect(plan)}
      >
        <Tv className="size-3" /> Activate
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LOADING SKELETON GRIDS
═══════════════════════════════════════════════ */
function SkeletonGrid({ cols, rows = 2 }: { cols: number; rows?: number }) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TETHERING GUARD BANNER
═══════════════════════════════════════════════ */
function TetheringGuardBanner({ onBuyPass }: { onBuyPass: () => void }) {
  return (
    <div className="surface-panel relative overflow-hidden p-4 border-destructive/30">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive to-transparent" />
      <p className="font-display text-sm font-bold text-destructive">Sharing Restricted | PalNet Security</p>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
        Hotspot tethering and Wi-Fi sharing are disabled on this network pass. Each device requires
        its own pass.
      </p>
      <Button size="sm" className="mt-3 font-display text-xs" onClick={onBuyPass}>
        Buy Pass for This Device
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PORTAL
═══════════════════════════════════════════════ */
function CaptivePortal() {
  const { user } = useSession();
  const { data: plans, isLoading } = usePlans();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Plan | null>(null);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [tab, setTab] = useState("home");

  // Device-lock detection: check if this device is the registered device for
  // any phone-based session lookup
  const currentMac = getDeviceMac();
  const { data: lockInfo } = useQuery({
    queryKey: ["device-lock", currentMac],
    refetchInterval: 60_000,
    enabled: !!currentMac,
    queryFn: async () => {
      // We only check when there's NO current device session (would already be shown in banner)
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id, mac_address, internet_plans(name), end_time")
        .eq("status", "active")
        .eq("mac_address", currentMac!)
        .gt("end_time", new Date().toISOString())
        .maybeSingle();
      // If we DO have a session on this MAC, not locked
      if (data) return null;
      return null; // Lock check happens server-side when phone is known
    },
  });

  // Anti-tethering: read the global setting
  const { data: antiTetheringEnabled } = useQuery({
    queryKey: ["anti-tethering-setting"],
    refetchInterval: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("network_settings")
        .select("value")
        .eq("key", "anti_tethering_enabled")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  function openCheckout(plan: Plan, accId?: string) {
    setSelected(plan);
    setAccountId(accId);
    setCheckoutOpen(true);
  }

  const byCategory = (cat: string) =>
    (plans ?? []).filter((p) => p.category === cat && p.is_active);

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
      <PalNetHeader />

      {/* Promotional Banner */}
      <div className="relative overflow-hidden border-b border-accent/20 bg-accent/5 px-4 py-2.5">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs text-foreground">
            <Cable className="size-3.5 text-accent shrink-0" />
            <span>
              <strong className="text-accent">Get Direct Home LAN/Cable Installed</strong>
              {" — "}KES 3,000 (Includes Indoor Wi-Fi Router + Free Setup)
            </span>
          </p>
          <Button
            size="sm"
            className="h-7 shrink-0 font-display text-xs gap-1.5 border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
            onClick={() => setInstallOpen(true)}
          >
            <Plus className="size-3" /> Request Installation
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-3 pb-16 pt-4 space-y-3">

        {/* Active session status banner */}
        <SessionBanner onTopUp={() => openCheckout(null!)} />

        {/* Voucher redemption */}
        <VoucherBar />

        {/* 4-tab package layout */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="home" className="flex-1 gap-1 text-xs">
              <Cable className="size-3.5" /> Home LAN
            </TabsTrigger>
            <TabsTrigger value="hotspot" className="flex-1 gap-1 text-xs">
              <Wifi className="size-3.5" /> Hotspot
            </TabsTrigger>
            <TabsTrigger value="tv" className="flex-1 gap-1 text-xs">
              <Tv className="size-3.5" /> Smart TV
            </TabsTrigger>
            <TabsTrigger value="reconnect" className="flex-1 gap-1 text-xs">
              <ArrowRightLeft className="size-3.5" /> Reconnect
            </TabsTrigger>
          </TabsList>

          {/* ── Home LAN ── */}
          <TabsContent value="home" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Dedicated high-speed cable access straight to your indoor Wi-Fi router.
            </p>
            {isLoading ? <SkeletonGrid cols={2} /> : (
              <div className="grid grid-cols-2 gap-2">
                {homePlans.map((p) => (
                  <HomePlanCard
                    key={p.id}
                    plan={p}
                    badge={homeBadge(p)}
                    onSelect={(plan, accId) => openCheckout(plan, accId)}
                  />
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full border-dashed border-accent/30 text-accent/80 text-xs hover:bg-accent/5 hover:text-accent"
              onClick={() => setInstallOpen(true)}
            >
              <Cable className="size-3.5" />
              New connection? Request cable installation →
            </Button>
          </TabsContent>

          {/* ── Hotspot ── */}
          <TabsContent value="hotspot" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Instant wireless access for mobile devices and visitors. Auto-detects your device.
            </p>
            {antiTetheringEnabled && (
              <TetheringGuardBanner onBuyPass={() => openCheckout(hotspotPlans[0] ?? null!)} />
            )}
            {isLoading ? <SkeletonGrid cols={3} /> : (
              <div className="grid grid-cols-3 gap-2">
                {hotspotPlans.map((p) => (
                  <HotspotCard key={p.id} plan={p} onSelect={(plan) => openCheckout(plan)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Smart TV ── */}
          <TabsContent value="tv" className="pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              High-priority streaming passes for Smart TVs and Android Boxes.
            </p>
            <TvGuide />
            {isLoading ? <SkeletonGrid cols={2} /> : (
              <div className="grid grid-cols-2 gap-2">
                {tvPlans.map((p) => (
                  <TvPlanCard key={p.id} plan={p} onSelect={(plan) => openCheckout(plan)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Reconnect ── */}
          <TabsContent value="reconnect" className="pt-3">
            <div className="surface-panel p-4">
              <ReconnectPanel onSuccess={() => setTab("home")} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Trust footer */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
          <ShieldCheck className="size-3.5 text-accent" />
          Payments processed securely via M-Pesa. PalNet never stores your PIN.
          {!user && (
            <>
              {" · "}
              <Link to="/auth" className="text-accent underline underline-offset-2">Sign in</Link>
            </>
          )}
        </p>
      </main>

      <CheckoutDialog
        plan={selected}
        accountId={accountId}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
      />
      <InstallModal
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        homePlans={homePlans}
      />
    </div>
  );
}
