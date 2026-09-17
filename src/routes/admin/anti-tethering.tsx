import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Check, ClipboardCopy, Loader2, ShieldBan, ShieldCheck,
  ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  updateNetworkSetting,
  applyAntiTetheringToAllRouters,
  terminateSession,
} from "@/lib/palnet.functions";
import { formatCountdown } from "@/lib/palnet";

export const Route = createFileRoute("/admin/anti-tethering")({
  head: () => ({ meta: [{ title: "PalNet Admin — Anti-Tethering" }] }),
  component: AdminAntiTethering,
});

/* ── MikroTik script templates ── */
const MIKROTIK_SCRIPTS = [
  {
    label: "Set TTL = 1 on Hotspot Bridge (blocks tethered devices)",
    script: `/ip firewall mangle\nadd action=change-ttl chain=postrouting new-ttl=set:1 out-interface=Hotspot-Bridge passthrough=yes comment="Block PalNet Tethering"`,
  },
  {
    label: "Block mDNS tethering detection bypass (UDP 5353)",
    script: `/ip firewall mangle\nadd action=mark-packet chain=prerouting protocol=udp dst-port=5353 new-packet-mark=palnet-tethered passthrough=no comment="Flag PalNet tethering mDNS"`,
  },
  {
    label: "Drop packets with TTL ≤ 1 inbound (secondary-device kill)",
    script: `/ip firewall filter\nadd action=drop chain=forward ttl=equal:1 comment="Drop PalNet tethered packets"`,
  },
  {
    label: "Remove all PalNet mangle rules (reset)",
    script: `/ip firewall mangle\nremove [find comment~"PalNet"]`,
  },
];

function ScriptCard({ label, script }: { label: string; script: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="admin-card p-3 space-y-2">
      <p className="text-xs font-semibold text-white">{label}</p>
      <pre className="rounded-lg bg-black/60 border border-slate-800 p-3 text-xs text-cyan-300 font-mono whitespace-pre overflow-x-auto leading-relaxed">
        {script}
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="admin-btn-outline h-7 gap-1.5 text-xs"
        onClick={copy}
      >
        {copied ? <Check className="size-3 text-emerald-400" /> : <ClipboardCopy className="size-3" />}
        {copied ? "Copied!" : "Copy Script"}
      </Button>
    </div>
  );
}

function AdminAntiTethering() {
  const queryClient = useQueryClient();
  const updateSetting = useServerFn(updateNetworkSetting);
  const applyRules = useServerFn(applyAntiTetheringToAllRouters);
  const kickFn = useServerFn(terminateSession);

  const [applyBusy, setApplyBusy] = useState(false);
  const [kickBusy, setKickBusy] = useState<string | null>(null);

  /* ── Anti-tethering global toggle ── */
  const { data: enabled, isLoading: settingLoading } = useQuery({
    queryKey: ["anti-tethering-setting"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("network_settings")
        .select("value")
        .eq("key", "anti_tethering_enabled")
        .maybeSingle();
      return data?.value === "true";
    },
  });

  /* ── Suspicious sessions ── */
  const { data: suspicious, isLoading: suspiciousLoading } = useQuery({
    queryKey: ["suspicious-sessions"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(
          "id, mac_address, ip_address, phone_number, user_agent, tether_attempts_count, end_time, internet_plans(name, category)",
        )
        .eq("status", "active")
        .eq("suspicious_tethering", true)
        .gt("end_time", new Date().toISOString())
        .order("tether_attempts_count", { ascending: false });
      return data ?? [];
    },
  });

  async function toggleEnabled() {
    const newVal = !enabled;
    const result = await updateSetting({
      data: { key: "anti_tethering_enabled", value: String(newVal) },
    });
    toast[result.ok ? "success" : "error"](result.message ?? (newVal ? "Anti-tethering enabled" : "Anti-tethering disabled"));
    await queryClient.invalidateQueries({ queryKey: ["anti-tethering-setting"] });
  }

  async function handleApplyRouters() {
    setApplyBusy(true);
    try {
      const result = await applyRules({ data: { enable: !enabled } });
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["anti-tethering-setting"] });
    } catch { toast.error("Failed to apply router rules"); }
    finally { setApplyBusy(false); }
  }

  async function handleKick(sessionId: string) {
    setKickBusy(sessionId);
    try {
      const result = await kickFn({ data: { subscriptionId: sessionId } });
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["suspicious-sessions"] });
    } catch { toast.error("Failed to kick session"); }
    finally { setKickBusy(null); }
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldBan className="size-5 text-cyan-400" />
          Anti-Tethering & Sharing Controls
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          MikroTik TTL enforcement, suspicious session monitoring, and RouterOS script generator
        </p>
      </div>

      {/* Global toggle card */}
      <div className="admin-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            {enabled
              ? <ShieldCheck className="size-4 text-emerald-400" />
              : <AlertTriangle className="size-4 text-amber-400" />}
            Strict Anti-Tethering (TTL = 1 Enforcement)
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            When enabled, tethered devices are blocked at the router level and the portal shows a
            sharing-restricted screen.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {settingLoading ? (
            <Skeleton className="h-8 w-32 admin-skeleton rounded-lg" />
          ) : (
            <>
              <button
                onClick={toggleEnabled}
                className="flex items-center gap-2 text-sm font-medium transition-colors"
              >
                {enabled
                  ? <ToggleRight className="size-8 text-emerald-400" />
                  : <ToggleLeft className="size-8 text-slate-600" />}
                <span className={enabled ? "text-emerald-400" : "text-slate-500"}>
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </button>
              <Button
                size="sm"
                className="admin-btn-primary h-8 gap-1.5 text-xs"
                disabled={applyBusy}
                onClick={handleApplyRouters}
              >
                {applyBusy
                  ? <Loader2 className="animate-spin size-3.5" />
                  : <ShieldBan className="size-3.5" />}
                {enabled ? "Remove from Routers" : "Apply to Routers"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Suspicious sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Live Suspicious Sessions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sessions flagged for possible hotspot sharing or proxy bypass
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400 ring-1 ring-red-500/20">
            {suspicious?.length ?? 0} flagged
          </span>
        </div>

        <div className="admin-card overflow-hidden">
          {suspiciousLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 admin-skeleton rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">MAC / IP</th>
                    <th className="px-4 py-3 text-left font-medium">Phone</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Attempts</th>
                    <th className="px-4 py-3 text-left font-medium">Expires</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(suspicious ?? []).map((s: any) => {
                    const remaining = new Date(s.end_time).getTime() - now;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-white">{s.mac_address ?? "—"}</p>
                          <p className="text-slate-600 font-mono">{s.ip_address ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-white">{s.phone_number ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.internet_plans?.category === "tv"
                              ? "bg-violet-500/15 text-violet-400"
                              : s.internet_plans?.category === "home"
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-cyan-500/15 text-cyan-400"
                          }`}>
                            {s.internet_plans?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">
                            <AlertTriangle className="size-3" />
                            {s.tether_attempts_count ?? 1}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-mono tabular-nums ${remaining < 300_000 ? "text-red-400" : "text-slate-400"}`}>
                          {formatCountdown(remaining)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              className="h-6 gap-1 px-2 text-xs bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25"
                              disabled={kickBusy === s.id}
                              onClick={() => handleKick(s.id)}
                            >
                              {kickBusy === s.id
                                ? <Loader2 className="size-3 animate-spin" />
                                : <Zap className="size-3" />}
                              Force Disconnect
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!suspicious?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-600">
                        No suspicious sessions detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RouterOS script generator */}
      <div>
        <h2 className="text-sm font-bold text-white mb-1">RouterOS Script Generator</h2>
        <p className="text-xs text-slate-500 mb-3">
          Copy and paste these commands directly into your MikroTik terminal or Winbox script runner.
        </p>
        <div className="space-y-3">
          {MIKROTIK_SCRIPTS.map((s) => (
            <ScriptCard key={s.label} label={s.label} script={s.script} />
          ))}
        </div>
      </div>
    </div>
  );
}
