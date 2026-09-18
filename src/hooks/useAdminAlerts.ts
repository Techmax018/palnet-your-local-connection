/**
 * Real-time admin alerts.
 *
 * Derives four alert kinds from live database state:
 *   • router  — an access point is offline
 *   • payment — an M-Pesa transaction failed in the last 24h
 *   • expiry  — an active subscription expires within the warning window
 *   • voucher — a plan's unused voucher stock dropped below the threshold
 *
 * Thresholds/toggles come from the network_settings table, so the Settings
 * page controls this feed. Postgres changes on the four source tables push
 * an instant refetch; a 30s poll is the fallback.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertKind = "router" | "payment" | "expiry" | "voucher";

export type AdminAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  at: string; // ISO timestamp for sorting
  to?: string; // admin route to open
};

const READ_KEY = "palnet.admin.alerts.read";

export function useNetworkSettings() {
  return useQuery({
    queryKey: ["network-settings"],
    queryFn: async () => {
      // Single-row system_settings table - map typed columns back to string keys
      const { data } = await supabase.from("system_settings").select("*").eq("id", true).maybeSingle();
      const map: Record<string, string> = {};
      if (!data) return map;
      map["portal_name"] = data.portal_name ?? "";
      map["support_phone"] = data.support_phone ?? "0703161031";
      map["wifi_ssid"] = data.wifi_ssid ?? "";
      map["anti_tethering_enabled"] = data.anti_tethering_enabled ? "true" : "false";
      map["maintenance_mode"] = data.maintenance_mode ? "true" : "false";
      map["guest_checkout_enabled"] = data.guest_checkout_enabled ? "true" : "false";
      map["alert_router_offline"] = data.alert_router_offline ? "true" : "false";
      map["alert_tethering"] = data.alert_tethering ? "true" : "false";
      // Backwards-compatible alert keys with sensible defaults
      map["alert_voucher_low_threshold"] = map["alert_voucher_low_threshold"] ?? "10";
      map["alert_expiry_warning_minutes"] = map["alert_expiry_warning_minutes"] ?? "15";
      map["alert_router_offline_enabled"] = data.alert_router_offline ? "true" : "false";
      map["alert_failed_payment_enabled"] = map["alert_failed_payment_enabled"] ?? "true";
      return map;
    },
    staleTime: 30_000,
  });
}

export function useAdminAlerts() {
  const queryClient = useQueryClient();
  const { data: settings } = useNetworkSettings();

  const voucherLow = Number(settings?.["alert_voucher_low_threshold"] ?? 10);
  const expiryMinutes = Number(settings?.["alert_expiry_warning_minutes"] ?? 15);
  const routerAlerts = (settings?.["alert_router_offline_enabled"] ?? "true") === "true";
  const paymentAlerts = (settings?.["alert_failed_payment_enabled"] ?? "true") === "true";

  const query = useQuery({
    queryKey: ["admin-alerts", voucherLow, expiryMinutes, routerAlerts, paymentAlerts],
    refetchInterval: 30_000,
    queryFn: async (): Promise<AdminAlert[]> => {
      const now = Date.now();
      const alerts: AdminAlert[] = [];

      const [routers, failed, expiring, vouchers, plans] = await Promise.all([
        supabase.from("routers").select("id, name, ip_address, location, status, last_ping"),
        supabase
          .from("transactions")
          .select("id, phone_number, amount_kes, created_at, transaction_reference, status")
          .eq("status", "failed")
          .gte("created_at", new Date(now - 86_400_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("user_subscriptions")
          .select("id, phone_number, mac_address, end_time, status, plan_id")
          .eq("status", "active")
          .gt("end_time", new Date(now).toISOString())
          .lt("end_time", new Date(now + expiryMinutes * 60_000).toISOString())
          .order("end_time", { ascending: true })
          .limit(20),
        supabase.from("vouchers").select("plan_id, status").eq("status", "unused"),
        supabase.from("internet_plans").select("id, name").eq("is_active", true),
      ]);

      /* Router outages */
      if (routerAlerts) {
        for (const r of routers.data ?? []) {
          if (r.status === "online") continue;
          alerts.push({
            id: `router:${r.id}:${r.last_ping ?? "never"}`,
            kind: "router",
            severity: "critical",
            title: `Router offline — ${r.name}`,
            detail: `${r.ip_address}${r.location ? ` · ${r.location}` : ""} is not responding.`,
            at: r.last_ping ?? new Date(now).toISOString(),
            to: "/admin/routers",
          });
        }
      }

      /* Failed M-Pesa payments */
      if (paymentAlerts) {
        for (const t of failed.data ?? []) {
          alerts.push({
            id: `payment:${t.id}`,
            kind: "payment",
            severity: "warning",
            title: `Payment failed — KES ${Number(t.amount_kes).toLocaleString()}`,
            detail: `${t.phone_number ?? "Unknown number"}${
              t.transaction_reference ? ` · ref ${t.transaction_reference}` : ""
            }`,
            at: t.created_at,
            to: "/admin/transactions",
          });
        }
      }

      /* Expiring subscriptions */
      const planNames = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
      for (const s of expiring.data ?? []) {
        const mins = Math.max(0, Math.round((new Date(s.end_time).getTime() - now) / 60_000));
        alerts.push({
          id: `expiry:${s.id}`,
          kind: "expiry",
          severity: "info",
          title: `Session expiring in ${mins} min`,
          detail: `${s.phone_number ?? s.mac_address ?? "Guest device"} · ${
            planNames.get(s.plan_id) ?? "Plan"
          }`,
          at: s.end_time,
          to: "/admin/sessions",
        });
      }

      /* Low voucher stock (plans that have been stocked before) */
      const unusedByPlan = new Map<string, number>();
      for (const v of vouchers.data ?? []) {
        if (!v.plan_id) continue;
        unusedByPlan.set(v.plan_id, (unusedByPlan.get(v.plan_id) ?? 0) + 1);
      }
      for (const [planId, count] of unusedByPlan) {
        if (count >= voucherLow) continue;
        alerts.push({
          id: `voucher:${planId}:${count}`,
          kind: "voucher",
          severity: count === 0 ? "critical" : "warning",
          title:
            count === 0
              ? `Out of vouchers — ${planNames.get(planId) ?? "Plan"}`
              : `Low voucher stock — ${planNames.get(planId) ?? "Plan"}`,
          detail: `${count} unused scratch card${count === 1 ? "" : "s"} left (threshold ${voucherLow}).`,
          at: new Date(now).toISOString(),
          to: "/admin/vouchers",
        });
      }

      const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
      return alerts.sort(
        (a, b) => order[a.severity] - order[b.severity] || (a.at < b.at ? 1 : -1),
      );
    },
  });

  /* Realtime push — refetch alerts the moment source data changes */
  useEffect(() => {
    const channel = supabase
      .channel("admin-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "routers" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-alerts"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-alerts"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "user_subscriptions" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-alerts"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vouchers" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-alerts"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  /* Read/dismiss state kept per browser */
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_KEY);
      if (raw) setRead(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((ids: string[]) => {
    setRead(ids);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-300)));
    } catch {
      /* ignore */
    }
  }, []);

  const alerts = query.data ?? [];
  const readSet = useMemo(() => new Set(read), [read]);
  const unread = alerts.filter((a) => !readSet.has(a.id));

  const markAllRead = useCallback(
    () => persist([...new Set([...read, ...alerts.map((a) => a.id)])]),
    [alerts, read, persist],
  );
  const dismiss = useCallback(
    (id: string) => persist([...new Set([...read, id])]),
    [read, persist],
  );

  return {
    alerts,
    unread,
    unreadCount: unread.length,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markAllRead,
    dismiss,
  };
}
