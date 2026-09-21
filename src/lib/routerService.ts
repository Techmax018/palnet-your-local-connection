/**
 * PalNet router integration layer (MikroTik REST API / RADIUS).
 *
 * Server-only helpers. Every function is safe to call from a server function
 * handler or a server route handler. When a router has no reachable REST
 * endpoint (typical in development), the calls are logged and reported as
 * simulated so the billing flow still completes end to end.
 */

export type RouterTarget = {
  id?: string;
  name?: string;
  ip_address: string;
  api_port?: number | null;
};

export type RouterCommandResult = {
  ok: boolean;
  simulated: boolean;
  message: string;
};

const REQUEST_TIMEOUT_MS = 4000;

function routerBaseUrl(target: RouterTarget): string {
  const port = target.api_port ?? 8728;
  return `http://${target.ip_address}:${port}/rest`;
}

function authHeader(): Record<string, string> {
  const user = process.env["ROUTER_API_USER"];
  const pass = process.env["ROUTER_API_PASSWORD"];
  if (!user || !pass) return {};
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
}

async function routerRequest(
  target: RouterTarget,
  path: string,
  body: unknown,
): Promise<RouterCommandResult> {
  const url = `${routerBaseUrl(target)}${path}`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, simulated: false, message: `Router responded ${response.status}` };
    }
    return { ok: true, simulated: false, message: "Router command applied" };
  } catch (error) {
    console.info("[routerService] simulated command", { url, body, error: String(error) });
    return { ok: true, simulated: true, message: "Router unreachable — command simulated" };
  }
}

/** Allow a device through the router firewall / hotspot for a given time budget. */
export async function authorizeMAC(
  macAddress: string,
  durationMinutes: number,
  target: RouterTarget,
): Promise<RouterCommandResult> {
  return routerRequest(target, "/ip/hotspot/ip-binding/add", {
    "mac-address": macAddress,
    type: "bypassed",
    comment: `palnet:${durationMinutes}m:${new Date().toISOString()}`,
  });
}

/** Remove a device's access, e.g. when its subscription timer reaches zero. */
export async function revokeMAC(
  macAddress: string,
  target: RouterTarget,
): Promise<RouterCommandResult> {
  return routerRequest(target, "/ip/hotspot/ip-binding/remove", {
    "mac-address": macAddress,
  });
}

/** Lightweight reachability probe used by the admin Router Manager. */
export async function pingRouter(target: RouterTarget): Promise<{ online: boolean }> {
  try {
    const response = await fetch(`${routerBaseUrl(target)}/system/resource`, {
      headers: authHeader(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { online: response.ok };
  } catch {
    return { online: false };
  }
}

export type MpesaCallbackPayload = {
  /** PayHero (Lipwa) callback shape */
  response?: {
    ResultCode?: number;
    Status?: string;
    ExternalReference?: string;
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    MpesaReceiptNumber?: string;
    Amount?: number;
    Phone?: string;
  };
  /** Legacy Safaricom Daraja shape (still accepted) */
  Body?: {
    stkCallback?: {
      ResultCode?: number;
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: string | number }> };
    };
  };
};

/**
 * Handle a PayHero (or legacy Daraja) M-Pesa confirmation: mark the transaction
 * paid, create the subscription and authorize the device on its router.
 */
export async function processMpesaCallback(payload: MpesaCallbackPayload) {
  const payHero = payload.response;
  const callback = payload.Body?.stkCallback;

  const reference =
    payHero?.ExternalReference ??
    payHero?.CheckoutRequestID ??
    callback?.CheckoutRequestID ??
    callback?.MerchantRequestID;
  if (!reference) return { ok: false, message: "Missing checkout reference" };

  const resultCode = payHero
    ? (payHero.ResultCode ?? (payHero.Status === "Success" ? 0 : 1))
    : (callback?.ResultCode ?? 1);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id, user_id, plan_id, status, phone_number, mac_address, ip_address, device_label")
    .eq("transaction_reference", reference)
    .maybeSingle();

  if (!tx) return { ok: false, message: "Unknown transaction reference" };

  if ((callback?.ResultCode ?? 1) !== 0) {
    await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", tx.id);
    return { ok: true, message: "Payment failed and recorded" };
  }

  await supabaseAdmin.from("transactions").update({ status: "completed" }).eq("id", tx.id);

  const { activateSubscription } = await import("./palnet.server");
  const result = await activateSubscription({
    userId: (tx.user_id as string | null) ?? null,
    planId: tx.plan_id as string,
    phone: (tx.phone_number as string | null) ?? null,
    macAddress: (tx.mac_address as string | null) ?? null,
    ipAddress: (tx.ip_address as string | null) ?? null,
    deviceLabel: (tx.device_label as string | null) ?? null,
  });

  return { ok: true, message: "Subscription activated", subscriptionId: result.subscriptionId };
}

/** Authorize a device by IP address (for TV / static-IP plans). */
export async function authorizeIP(
  ipAddress: string,
  durationMinutes: number,
  target: RouterTarget,
): Promise<RouterCommandResult> {
  return routerRequest(target, "/ip/firewall/address-list/add", {
    list: "palnet-authorized",
    address: ipAddress,
    comment: `palnet:${durationMinutes}m:${new Date().toISOString()}`,
    timeout: `${Math.floor(durationMinutes / 60)}:${String(durationMinutes % 60).padStart(2, "0")}:00`,
  });
}

/** Remove IP authorization (TV / static-IP plans). */
export async function revokeIP(
  ipAddress: string,
  target: RouterTarget,
): Promise<RouterCommandResult> {
  return routerRequest(target, "/ip/firewall/address-list/remove", {
    list: "palnet-authorized",
    address: ipAddress,
  });
}

/**
 * Transfer an active session from one device to another on the router.
 * Revokes the old MAC/IP and immediately authorizes the new one.
 */
export async function transferDevice(opts: {
  oldMac: string | null;
  oldIp: string | null;
  newMac: string | null;
  newIp: string | null;
  remainingMinutes: number;
  target: RouterTarget;
}): Promise<RouterCommandResult> {
  const { oldMac, oldIp, newMac, newIp, remainingMinutes, target } = opts;

  // Revoke old device
  if (oldMac) await revokeMAC(oldMac, target).catch(() => null);
  if (oldIp) await revokeIP(oldIp, target).catch(() => null);

  // Authorize new device
  let result: RouterCommandResult = { ok: true, simulated: true, message: "No new device provided" };
  if (newMac) result = await authorizeMAC(newMac, remainingMinutes, target);
  else if (newIp) result = await authorizeIP(newIp, remainingMinutes, target);

  return result;
}

/**
 * Apply MikroTik Mangle rules that enforce TTL=1 on the hotspot bridge
 * to prevent client tethering/hotspot sharing.
 */
export async function applyAntiTetheringRules(
  target: RouterTarget,
): Promise<RouterCommandResult> {
  // Set TTL = 1 on postrouting for the hotspot bridge so tethered devices drop immediately
  const rule1 = await routerRequest(target, "/ip/firewall/mangle/add", {
    action: "change-ttl",
    chain: "postrouting",
    "new-ttl": "set:1",
    "out-interface": "Hotspot-Bridge",
    comment: "Block PalNet Tethering",
    passthrough: "yes",
  });
  if (!rule1.ok && !rule1.simulated) return rule1;

  // Block common tethering detection bypass ports (Android hotspot uses 5353/mDNS)
  const rule2 = await routerRequest(target, "/ip/firewall/mangle/add", {
    action: "mark-packet",
    chain: "prerouting",
    protocol: "udp",
    "dst-port": "5353",
    "new-packet-mark": "palnet-tethered",
    passthrough: "no",
    comment: "Flag PalNet tethering mDNS",
  });

  return rule2.simulated
    ? { ok: true, simulated: true, message: "Anti-tethering rules simulated (router unreachable)" }
    : { ok: true, simulated: false, message: "Anti-tethering rules applied to router" };
}

/** Remove all PalNet anti-tethering mangle rules from the router. */
export async function removeAntiTetheringRules(
  target: RouterTarget,
): Promise<RouterCommandResult> {
  return routerRequest(target, "/ip/firewall/mangle/remove", {
    "?comment": "Block PalNet Tethering",
  });
}
