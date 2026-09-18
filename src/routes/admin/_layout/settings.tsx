import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, Bell, CheckCircle2, Circle, Clock, Globe, Loader2,
  Network, Save, Settings, Shield, ToggleLeft, ToggleRight, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { updateSystemSettings } from "@/lib/palnet.functions";

export const Route = createFileRoute("/admin/_layout/settings")({
  head: () => ({ meta: [{ title: "PalNet Admin — Settings" }] }),
  component: AdminSettings,
});

/* ─── live system health ─────────────────────────────────────────────────── */
function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [routersResult, plansResult, subsResult] = await Promise.all([
        supabase.from("routers").select("id, name, status, last_ping").order("name"),
        supabase.from("internet_plans").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("user_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("end_time", new Date().toISOString()),
      ]);
      return {
        routers: (routersResult.data ?? []) as { id: string; name: string; status: string; last_ping: string | null }[],
        activePlans: plansResult.count ?? 0,
        activeSessions: subsResult.count ?? 0,
        dbConnected: !routersResult.error,
      };
    },
  });
}

/* ─── network settings from DB ──────────────────────────────────────────── */
function useNetworkSettings() {
  return useQuery({
    queryKey: ["network-settings-all"],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("system_settings").select("*").eq("id", true).maybeSingle();
        const map: Record<string, string> = {};
        if (!data) return map;
        map["portal_name"] = data.portal_name ?? "PalNet Wi-Fi";
        map["support_phone"] = data.support_phone ?? "";
        map["wifi_ssid"] = data.wifi_ssid ?? "PalNet-WiFi";
        map["anti_tethering_enabled"] = data.anti_tethering_enabled ? "true" : "false";
        map["maintenance_mode"] = data.maintenance_mode ? "true" : "false";
        map["guest_checkout_enabled"] = data.guest_checkout_enabled ? "true" : "false";
        return map;
      } catch { return {} as Record<string, string>; }
    },
  });
}

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function Section({
  icon: Icon, title, sub, children,
}: {
  icon: React.ElementType; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="admin-card p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <Icon className="size-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Toggle setting row ─────────────────────────────────────────────────── */
function ToggleSetting({
  label, description, value, onChange, busy,
}: {
  label: string; description: string;
  value: boolean; onChange: (v: boolean) => void; busy?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => !busy && onChange(!value)}
        className="shrink-0 transition-opacity hover:opacity-80"
        disabled={busy}
      >
        {busy
          ? <Loader2 className="size-6 animate-spin text-slate-500" />
          : value
          ? <ToggleRight className="size-7 text-emerald-400" />
          : <ToggleLeft  className="size-7 text-slate-600" />}
      </button>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: settings, isLoading: settingsLoading } = useNetworkSettings();
  const saveSystem = useServerFn(updateSystemSettings);

  // Local editable fields
  const [portalName, setPortalName]     = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [wifiSsid, setWifiSsid]         = useState("");
  const [savingBusy, setSavingBusy]     = useState(false);
  const [toggleBusy, setToggleBusy]     = useState<string | null>(null);

  // Populate local fields once settings load
  const [populated, setPopulated] = useState(false);
  if (settings && !populated) {
    setPortalName(settings["portal_name"] ?? "PalNet Wi-Fi");
    setSupportPhone(settings["support_phone"] ?? "");
    setWifiSsid(settings["wifi_ssid"] ?? "PalNet-WiFi");
    setPopulated(true);
  }

  async function toggle(key: string, current: boolean) {
    setToggleBusy(key);
    try {
      const payload: any = {};
      if (key === "anti_tethering_enabled") payload.anti_tethering_enabled = !current;
      if (key === "maintenance_mode") payload.maintenance_mode = !current;
      if (key === "guest_checkout_enabled") payload.guest_checkout_enabled = !current;
      if (key === "alert_router_offline") payload.alert_router_offline = !current;
      if (key === "alert_tethering") payload.alert_tethering = !current;
      const r = await saveSystem({ data: payload });
      toast[r.ok ? "success" : "error"](r.message);
      await queryClient.invalidateQueries({ queryKey: ["network-settings-all"] });
      await queryClient.invalidateQueries({ queryKey: ["anti-tethering-setting"] });
    } catch { toast.error("Failed to update setting"); }
    finally { setToggleBusy(null); }
  }

  async function savePortalSettings() {
    setSavingBusy(true);
    try {
      const r = await saveSystem({ data: { portal_name: portalName, support_phone: supportPhone || null, wifi_ssid: wifiSsid } });
      toast[r.ok ? "success" : "error"](r.message);
      await queryClient.invalidateQueries({ queryKey: ["network-settings-all"] });
    } catch { toast.error("Failed to save portal settings"); }
    finally { setSavingBusy(false); }
  }

  const antiTethering   = settings?.["anti_tethering_enabled"] === "true";
  const maintenanceMode = settings?.["maintenance_mode"]        === "true";
  const guestCheckout   = settings?.["guest_checkout_enabled"]  !== "false"; // default true

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="size-5 text-cyan-400" />
          System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Network controls, portal configuration, and live system health
        </p>
      </div>

      {/* ── Live System Health ── */}
      <Section icon={Activity} title="System Health" sub="Live connection and service status">
        {healthLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 admin-skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Database */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <Network className="size-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-white">Supabase Database</p>
                  <p className="text-xs text-slate-500">Real-time data & authentication</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                health?.dbConnected
                  ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                  : "bg-red-500/15 text-red-400 ring-1 ring-red-500/20"
              }`}>
                <Circle className={`size-1.5 ${health?.dbConnected ? "fill-emerald-400" : "fill-red-400"}`} />
                {health?.dbConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* M-Pesa */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <Globe className="size-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-white">Safaricom Daraja (M-Pesa)</p>
                  <p className="text-xs text-slate-500">STK Push payment processing</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
                <Circle className="size-1.5 fill-emerald-400" /> API Ready
              </span>
            </div>

            {/* Routers */}
            <div className="space-y-1.5">
              {(health?.routers ?? []).length === 0 ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Wifi className="size-4 text-slate-500" />
                    <p className="text-sm text-slate-400">No routers registered yet</p>
                  </div>
                </div>
              ) : (
                (health?.routers ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Wifi className="size-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{r.name}</p>
                        <p className="text-xs text-slate-500">
                          {r.last_ping
                            ? `Last ping: ${new Date(r.last_ping).toLocaleTimeString("en-KE", { timeStyle: "short" })}`
                            : "Never pinged"}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.status === "online"
                        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                        : "bg-red-500/15 text-red-400 ring-1 ring-red-500/20"
                    }`}>
                      <Circle className={`size-1.5 ${r.status === "online" ? "fill-emerald-400" : "fill-red-400"}`} />
                      {r.status === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white">{health?.activePlans ?? 0}</p>
                <p className="text-xs text-slate-500 mt-0.5">Active Plans</p>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white">{health?.activeSessions ?? 0}</p>
                <p className="text-xs text-slate-500 mt-0.5">Live Sessions</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Network Controls ── */}
      <Section icon={Shield} title="Network Controls" sub="Runtime toggles for network policies">
        {settingsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 admin-skeleton rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-2">
            <ToggleSetting
              label="Guest Checkout (No Login Required)"
              description="Allow customers to buy packages with M-Pesa without creating an account"
              value={guestCheckout}
              onChange={() => toggle("guest_checkout_enabled", guestCheckout)}
              busy={toggleBusy === "guest_checkout_enabled"}
            />
            <ToggleSetting
              label="Anti-Tethering Enforcement"
              description="Block hotspot sharing — each device must purchase its own pass"
              value={antiTethering}
              onChange={() => toggle("anti_tethering_enabled", antiTethering)}
              busy={toggleBusy === "anti_tethering_enabled"}
            />
            <ToggleSetting
              label="Maintenance Mode"
              description="Temporarily hide the public portal and show a maintenance message"
              value={maintenanceMode}
              onChange={() => toggle("maintenance_mode", maintenanceMode)}
              busy={toggleBusy === "maintenance_mode"}
            />
          </div>
        )}
      </Section>

      {/* ── Portal Configuration ── */}
      <Section icon={Globe} title="Portal Configuration" sub="Public-facing display settings">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="admin-label">Portal / Network Name</Label>
            <Input
              value={portalName}
              onChange={(e) => setPortalName(e.target.value)}
              className="admin-input"
              placeholder="PalNet Wi-Fi"
            />
            <p className="text-xs text-slate-600">Shown in the customer portal header</p>
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">Wi-Fi SSID</Label>
            <Input
              value={wifiSsid}
              onChange={(e) => setWifiSsid(e.target.value)}
              className="admin-input"
              placeholder="PalNet-WiFi"
            />
            <p className="text-xs text-slate-600">The network name customers connect to</p>
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">Support Phone Number</Label>
            <Input
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className="admin-input"
              placeholder="0712 345 678"
              inputMode="tel"
            />
            <p className="text-xs text-slate-600">Printed on scratch cards and shown on the portal</p>
          </div>
          <Button
            className="admin-btn-primary gap-2"
            disabled={savingBusy}
            onClick={savePortalSettings}
          >
            {savingBusy ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
            Save Portal Settings
          </Button>
        </div>
      </Section>

      {/* ── Session Policies ── */}
      <Section icon={Clock} title="Session Policies" sub="How sessions behave for connected devices">
        <div className="space-y-2">
          {[
            { label: "Session binding", value: "One active session per device (MAC address)" },
            { label: "Idle timeout",    value: "Managed per-plan by the router" },
            { label: "Reconnection",    value: "Via M-Pesa code or scratch card (/reconnect)" },
            { label: "Auto-expiry",     value: "Subscription ends at plan duration" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-900/40 px-4 py-3">
              <p className="text-xs text-slate-400 shrink-0">{label}</p>
              <p className="text-xs text-white text-right">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-3 mt-2">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <CheckCircle2 className="size-3.5 text-cyan-400 shrink-0" />
            To change session duration, idle timeout, or bandwidth limits — edit the plan in
            <span className="text-cyan-400"> Internet Plans</span>.
          </p>
        </div>
      </Section>

      {/* ── Notification Preferences ── */}
      <Section icon={Bell} title="Notification Preferences" sub="Admin alerts and thresholds">
        <div className="space-y-2">
          <ToggleSetting
            label="Low-balance Alerts"
            description="Notify when a router goes offline for more than 5 minutes"
            value={settings?.["alert_router_offline"] !== "false"}
            onChange={() => toggle("alert_router_offline", settings?.["alert_router_offline"] !== "false")}
            busy={toggleBusy === "alert_router_offline"}
          />
          <ToggleSetting
            label="Suspicious Tethering Alerts"
            description="Flag sessions detected as sharing their connection"
            value={settings?.["alert_tethering"] !== "false"}
            onChange={() => toggle("alert_tethering", settings?.["alert_tethering"] !== "false")}
            busy={toggleBusy === "alert_tethering"}
          />
        </div>
      </Section>
    </div>
  );
}
