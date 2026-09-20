/**
 * Settings & System Config — all operational settings are stored in the
 * network_settings table and read live by the portal, the alert engine and
 * the dashboard. Server credentials are shown read-only (they live as
 * server secrets and are never sent to the browser).
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Database, Key, Loader2, RotateCcw, Save, Settings, ShieldBan, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { updateNetworkSetting, applyAntiTetheringToAllRouters } from "@/lib/palnet.functions";

export const Route = createFileRoute("/admin/_layout/settings")({
  head: () => ({
    meta: [
      { title: "PalNet Admin — Settings" },
      { name: "description", content: "Configure PalNet hotspot, alerts and anti-tethering settings." },
    ],
  }),
  component: AdminSettings,
});

type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  hotspot_ssid: "PalNet-WiFi",
  support_phone: "0700000000",
  max_devices_per_session: "1",
  anti_tethering_enabled: "false",
  alert_voucher_low_threshold: "10",
  alert_expiry_warning_minutes: "15",
  alert_router_offline_enabled: "true",
  alert_failed_payment_enabled: "true",
};

function Section({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
  children: React.ReactNode;
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

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AdminSettings() {
  const queryClient = useQueryClient();
  const saveSetting = useServerFn(updateNetworkSetting);
  const applyRules = useServerFn(applyAntiTetheringToAllRouters);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["network-settings"],
    queryFn: async (): Promise<SettingsMap> => {
      const { data, error } = await supabase.from("network_settings").select("key, value");
      if (error) throw error;
      const map: SettingsMap = { ...DEFAULTS };
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
  });

  const [form, setForm] = useState<SettingsMap>(DEFAULTS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved) setForm(saved);
  }, [saved]);

  const dirty = !!saved && Object.keys(form).some((k) => form[k] !== saved[k]);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    if (!saved) return;
    setBusy(true);
    try {
      const changed = Object.keys(form).filter((k) => form[k] !== saved[k]);
      for (const key of changed) {
        const result = await saveSetting({ data: { key, value: form[key] ?? "" } });
        if (!result.ok) throw new Error(result.message);
      }
      /* Push anti-tethering state to the live routers when it changed */
      if (changed.includes("anti_tethering_enabled")) {
        const res = await applyRules({ data: { enable: form["anti_tethering_enabled"] === "true" } });
        toast.info(res.message);
      }
      await queryClient.invalidateQueries({ queryKey: ["network-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-alerts"] });
      toast.success(`Saved ${changed.length} setting${changed.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 admin-skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl pb-16">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="size-5 text-cyan-400" />
          Settings &amp; System Config
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Saved to your database instantly — the customer portal, alerts and dashboard use these values.
        </p>
      </div>

      <Section icon={Wifi} title="Hotspot & Branding" sub="Shown to customers on the portal">
        <div className="space-y-1.5">
          <Label className="admin-label">Wi-Fi network name (SSID)</Label>
          <Input
            className="admin-input"
            value={form["hotspot_ssid"] ?? ""}
            onChange={(e) => set("hotspot_ssid", e.target.value)}
            placeholder="PalNet-WiFi"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="admin-label">Support phone number</Label>
          <Input
            className="admin-input"
            value={form["support_phone"] ?? ""}
            onChange={(e) => set("support_phone", e.target.value)}
            placeholder="0700000000"
          />
        </div>
      </Section>

      <Section icon={ShieldBan} title="Device Sharing Controls" sub="Applied on every online router">
        <div className="space-y-1.5">
          <Label className="admin-label">Max devices per paid session</Label>
          <Input
            type="number"
            min={1}
            max={10}
            className="admin-input"
            value={form["max_devices_per_session"] ?? "1"}
            onChange={(e) =>
              set("max_devices_per_session", String(Math.min(10, Math.max(1, Number(e.target.value) || 1))))
            }
          />
        </div>
        <ToggleRow
          label="Block hotspot tethering"
          hint="Stops one payment being shared with extra phones"
          checked={form["anti_tethering_enabled"] === "true"}
          onChange={(v) => set("anti_tethering_enabled", String(v))}
        />
      </Section>

      <Section icon={Bell} title="Alert Rules" sub="Controls the notification bell feed">
        <ToggleRow
          label="Router offline alerts"
          hint="Warn the moment an access point stops responding"
          checked={form["alert_router_offline_enabled"] === "true"}
          onChange={(v) => set("alert_router_offline_enabled", String(v))}
        />
        <ToggleRow
          label="Failed M-Pesa payment alerts"
          hint="Warn on failed payments from the last 24 hours"
          checked={form["alert_failed_payment_enabled"] === "true"}
          onChange={(v) => set("alert_failed_payment_enabled", String(v))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="admin-label">Warn when a session has less than (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={240}
              className="admin-input"
              value={form["alert_expiry_warning_minutes"] ?? "15"}
              onChange={(e) =>
                set("alert_expiry_warning_minutes", String(Math.min(240, Math.max(1, Number(e.target.value) || 1))))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">Low voucher stock threshold</Label>
            <Input
              type="number"
              min={1}
              max={500}
              className="admin-input"
              value={form["alert_voucher_low_threshold"] ?? "10"}
              onChange={(e) =>
                set("alert_voucher_low_threshold", String(Math.min(500, Math.max(1, Number(e.target.value) || 1))))
              }
            />
          </div>
        </div>
      </Section>

      <Section icon={Key} title="Server Credentials" sub="Stored securely on the server — never shown in the browser">
        <div className="space-y-2">
          {[
            { label: "M-Pesa (Daraja) API keys", note: "STK Push consumer key, secret, passkey, shortcode" },
            { label: "Router API login", note: "MikroTik / OpenWrt REST username and password" },
            { label: "Database service key", note: "Used by payment callbacks and admin actions" },
          ].map((c) => (
            <div
              key={c.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/60 bg-slate-900/50 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{c.label}</p>
                <p className="truncate text-xs text-slate-500">{c.note}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                Server-side
              </span>
            </div>
          ))}
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Database className="size-3" />
            Ask your developer to update these keys — they cannot be edited from a web page for security.
          </p>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-slate-800/80 bg-[#0d1117]/95 px-1 py-3 backdrop-blur">
        <Button className="admin-btn-primary gap-2" disabled={!dirty || busy} onClick={handleSave}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {dirty ? "Save Changes" : "Saved"}
        </Button>
        {dirty && (
          <Button
            variant="outline"
            className="admin-btn-outline gap-2 text-xs"
            disabled={busy}
            onClick={() => saved && setForm(saved)}
          >
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
