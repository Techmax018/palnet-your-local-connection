import { planMinutes } from "./palnet";
import { authorizeMAC, revokeMAC } from "./routerService";

export type ActivationIdentity = {
  userId?: string | null;
  phone?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  deviceLabel?: string | null;
  routerId?: string | null;
};

/**
 * Creates (or extends) an active subscription for a signed-in user OR a guest
 * device (identified by MAC address / phone number) and pushes the firewall
 * authorization to the assigned router.
 */
export async function activateSubscription(input: ActivationIdentity & { planId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: plan, error: planError } = await supabaseAdmin
    .from("internet_plans")
    .select("*")
    .eq("id", input.planId)
    .single();
  if (planError || !plan) throw new Error("Plan not found");

  const minutes = planMinutes(plan);

  let routerId = input.routerId ?? null;
  let router: { id: string; ip_address: string; api_port: number | null } | null = null;
  const { data: routers } = await supabaseAdmin
    .from("routers")
    .select("id, ip_address, api_port, status")
    .order("status", { ascending: true });
  if (routers && routers.length > 0) {
    router =
      (routerId ? routers.find((r) => r.id === routerId) : routers.find((r) => r.status === "online")) ??
      routers[0]!;
    routerId = router.id;
  }

  const mac = input.macAddress ?? generateMac(input.userId ?? input.phone ?? String(Date.now()));
  const ip = input.ipAddress ?? generateIp();

  // Extend an existing active session for the same identity instead of stacking.
  let query = supabaseAdmin
    .from("user_subscriptions")
    .select("id, end_time")
    .eq("status", "active")
    .gt("end_time", new Date().toISOString())
    .order("end_time", { ascending: false })
    .limit(1);

  if (input.userId) query = query.eq("user_id", input.userId);
  else if (input.macAddress) query = query.eq("mac_address", input.macAddress);
  else if (input.phone) query = query.eq("phone_number", input.phone);

  const { data: matches } = await query;
  const existing = matches?.[0] ?? null;

  const base = existing ? new Date(existing.end_time as string) : new Date();
  const endTime = new Date(base.getTime() + minutes * 60_000).toISOString();

  let subscriptionId: string;
  if (existing) {
    await supabaseAdmin
      .from("user_subscriptions")
      .update({ end_time: endTime, plan_id: input.planId, status: "active" })
      .eq("id", existing.id);
    subscriptionId = existing.id as string;
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("user_subscriptions")
      .insert({
        user_id: input.userId ?? null,
        plan_id: input.planId,
        router_id: routerId,
        mac_address: mac,
        ip_address: ip,
        phone_number: input.phone ?? null,
        device_label: input.deviceLabel ?? null,
        end_time: endTime,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create subscription");
    subscriptionId = created.id as string;
  }

  const { data: session } = await supabaseAdmin
    .from("user_subscriptions")
    .select("mac_address")
    .eq("id", subscriptionId)
    .single();

  if (router && session?.mac_address) {
    await authorizeMAC(session.mac_address as string, minutes, router);
  }

  return { subscriptionId, endTime, minutes };
}

export async function terminateSubscription(subscriptionId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: sub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id, mac_address, router_id")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub) throw new Error("Session not found");

  if (sub.router_id) {
    const { data: router } = await supabaseAdmin
      .from("routers")
      .select("id, ip_address, api_port")
      .eq("id", sub.router_id)
      .maybeSingle();
    if (router && sub.mac_address) await revokeMAC(sub.mac_address as string, router);
  }

  await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "expired", end_time: new Date().toISOString() })
    .eq("id", subscriptionId);

  return { ok: true };
}

/** Deterministic pseudo device address for portal demos where no RADIUS MAC is supplied. */
function generateMac(seed: string): string {
  const hex = seed.replace(/[^a-f0-9]/gi, "").padEnd(12, "0").slice(0, 12).toUpperCase();
  return hex.match(/.{2}/g)!.join(":");
}

function generateIp(): string {
  return `10.10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 253) + 2}`;
}
