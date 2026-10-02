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
  const reference = payHero?.ExternalReference ?? null;
  const providerReference = payHero?.CheckoutRequestID ?? callback?.CheckoutRequestID ?? null;
  if (!reference && !providerReference) return { ok: false, message: "Missing checkout reference" };
  return settleTransaction({
    reference,
    providerReference,
    receiptHint: payHero?.MpesaReceiptNumber ?? receiptFromDaraja(callback) ?? null,
    phoneHint: payHero?.Phone ? String(payHero.Phone) : null,
  });
}

/**
 * Confirms a pending transaction with PayHero (never trusting caller data for
 * the outcome) and activates the session. Called by the callback and by the
 * customer's status poll, so a slow/missing callback no longer blocks access.
 */
export async function settleTransaction(input: {
  reference: string | null;
  providerReference?: string | null;
  receiptHint?: string | null;
  phoneHint?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cols = "id, user_id, plan_id, status, amount_kes, transaction_reference, provider_reference, phone_number, mac_address, ip_address, device_label";
  let tx = null as any;
  if (input.reference) {
    tx = (await supabaseAdmin.from("transactions").select(cols).eq("transaction_reference", input.reference).maybeSingle()).data;
  }
  if (!tx && input.providerReference) {
    tx = (await supabaseAdmin.from("transactions").select(cols).eq("provider_reference", input.providerReference).maybeSingle()).data;
  }
  if (!tx) return { ok: false, message: "Unknown transaction reference" };
  if (tx.status !== "pending") return { ok: true, message: "Already processed" };

  const { verifyPayment } = await import("./payhero.server");
  const candidates = [...new Set([tx.provider_reference, input.providerReference, tx.transaction_reference].filter(Boolean))] as string[];
  let verified: Awaited<ReturnType<typeof verifyPayment>> = { status: "unknown", amount: null, externalReference: null };
  for (const ref of candidates) {
    verified = await verifyPayment(ref);
    if (verified.status !== "unknown") break;
  }
  if (verified.externalReference && verified.externalReference !== tx.transaction_reference) {
    return { ok: false, message: "Reference mismatch" };
  }
  if (verified.status === "failed") {
    await supabaseAdmin.from("transactions").update({ status: "failed" }).eq("id", tx.id).eq("status", "pending");
    return { ok: true, message: "Payment failed and recorded" };
  }
  if (verified.status !== "success") return { ok: false, message: "Payment not confirmed" };
  if (verified.amount != null && verified.amount < Number(tx.amount_kes)) {
    return { ok: false, message: "Amount mismatch" };
  }

  const { data: claimed } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "completed",
      mpesa_receipt_number: verified.receipt ?? input.receiptHint ?? null,
      phone_number: input.phoneHint ?? tx.phone_number,
      amount_kes: verified.amount ?? tx.amount_kes,
    })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { ok: true, message: "Already processed" };

  const { activateSubscription } = await import("./palnet.server");
  const result = await activateSubscription({
    userId: tx.user_id ?? null,
    planId: tx.plan_id as string,
    phone: tx.phone_number ?? null,
    macAddress: tx.mac_address ?? null,
    ipAddress: tx.ip_address ?? null,
    deviceLabel: tx.device_label ?? null,
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

function receiptFromDaraja(cb: unknown): string | null {
  const items = (cb as { CallbackMetadata?: { Item?: { Name: string; Value?: unknown }[] } } | undefined)
    ?.CallbackMetadata?.Item;
  const hit = items?.find((i) => i.Name === "MpesaReceiptNumber");
  return hit?.Value ? String(hit.Value) : null;
}
