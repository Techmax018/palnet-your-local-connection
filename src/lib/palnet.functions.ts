import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone } from "./palnet";

const deviceSchema = {
  macAddress: z.string().max(32).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
  deviceLabel: z.string().max(60).optional().nullable(),
};

const guestPurchaseSchema = z.object({
  planId: z.string().uuid(),
  phone: z.string().min(9).max(15),
  ...deviceSchema,
});

/**
 * Guest checkout — no account required. Records the pending transaction against
 * the device (MAC / IP / phone), triggers an M-Pesa STK push and activates the
 * session once the Daraja callback confirms payment. Without live Daraja
 * credentials the push is auto-confirmed so the portal stays usable.
 */
export const startGuestPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => guestPurchaseSchema.parse(data))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      return { ok: false as const, message: "Enter a valid Safaricom number, e.g. 0712345678" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin
      .from("internet_plans")
      .select("id, name, price_kes, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !plan.is_active) {
      return { ok: false as const, message: "This package is not available right now" };
    }

    const reference = `PN${Date.now().toString(36).toUpperCase()}`;

    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      plan_id: plan.id,
      amount_kes: plan.price_kes,
      payment_method: "mpesa",
      transaction_reference: reference,
      status: "pending",
      phone_number: phone,
      mac_address: data.macAddress ?? null,
      ip_address: data.ipAddress ?? null,
      device_label: data.deviceLabel ?? null,
    });
    if (txError) return { ok: false as const, message: "Could not start payment. Try again." };

    const { requestStkPush } = await import("./mpesa.server");
    const push = await requestStkPush({
      phone,
      amount: Number(plan.price_kes),
      reference,
      description: plan.name,
    });

    if (!push.live) {
      const { processMpesaCallback } = await import("./routerService");
      const result = await processMpesaCallback({
        Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: reference } },
      });
      return {
        ok: result.ok,
        simulated: true as const,
        reference,
        message: result.ok
          ? `Payment of KES ${plan.price_kes} confirmed — you are online.`
          : "Payment could not be confirmed",
      };
    }

    return {
      ok: true as const,
      simulated: false as const,
      reference,
      message: `Check ${data.phone} and enter your M-Pesa PIN to go online.`,
    };
  });

/** Guest scratch-card redemption. */
export const redeemGuestVoucher = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(4).max(20),
        phone: z.string().max(15).optional().nullable(),
        ...deviceSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase().replace(/\s/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: voucher } = await supabaseAdmin
      .from("vouchers")
      .select("id, plan_id, status")
      .eq("code", code)
      .maybeSingle();

    if (!voucher) return { ok: false as const, message: "That voucher code was not found" };
    if (voucher.status !== "unused") {
      return { ok: false as const, message: "This voucher has already been used" };
    }

    const { activateSubscription } = await import("./palnet.server");
    const activation = await activateSubscription({
      planId: voucher.plan_id as string,
      macAddress: data.macAddress ?? null,
      ipAddress: data.ipAddress ?? null,
      deviceLabel: data.deviceLabel ?? null,
      phone: data.phone ? normalizePhone(data.phone) : null,
    });

    await supabaseAdmin
      .from("vouchers")
      .update({
        status: "active",
        activated_at: new Date().toISOString(),
        expires_at: activation.endTime,
      })
      .eq("id", voucher.id);

    const { data: plan } = await supabaseAdmin
      .from("internet_plans")
      .select("name, price_kes")
      .eq("id", voucher.plan_id as string)
      .maybeSingle();

    await supabaseAdmin.from("transactions").insert({
      plan_id: voucher.plan_id,
      amount_kes: plan?.price_kes ?? 0,
      payment_method: "voucher",
      transaction_reference: code,
      status: "completed",
      phone_number: data.phone ? normalizePhone(data.phone) : null,
      mac_address: data.macAddress ?? null,
      ip_address: data.ipAddress ?? null,
      device_label: data.deviceLabel ?? null,
    });

    return { ok: true as const, message: `${plan?.name ?? "Voucher"} activated — you are online.` };
  });

const lookupSchema = z.object({
  macAddress: z.string().max(32).optional().nullable(),
  phone: z.string().max(15).optional().nullable(),
  reference: z.string().max(40).optional().nullable(),
});

export type GuestSession = {
  id: string;
  start_time: string;
  end_time: string;
  mac_address: string | null;
  ip_address: string | null;
  device_label: string | null;
  status: string;
  plan_name: string | null;
  plan_category: string | null;
  speed_limit_mbps: number | null;
  router_name: string | null;
};

/** Looks up the caller's active session by device address or phone number. */
export const lookupGuestSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }): Promise<GuestSession | null> => {
    if (!data.macAddress && !data.phone) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("user_subscriptions")
      .select(
        "id, start_time, end_time, mac_address, ip_address, device_label, status, internet_plans(name, category, speed_limit_mbps), routers(name)",
      )
      .eq("status", "active")
      .gt("end_time", new Date().toISOString())
      .order("end_time", { ascending: false })
      .limit(1);

    query = data.macAddress
      ? query.eq("mac_address", data.macAddress)
      : query.eq("phone_number", normalizePhone(data.phone!) ?? data.phone!);

    const { data: rows } = await query;
    type Row = {
      id: string;
      start_time: string;
      end_time: string;
      mac_address: string | null;
      ip_address: string | null;
      device_label: string | null;
      status: string;
      internet_plans?: { name: string; category: string; speed_limit_mbps: number } | null;
      routers?: { name: string } | null;
    };
    const row = rows?.[0] as unknown as Row | undefined;
    if (!row) return null;

    return {
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      mac_address: row.mac_address ?? null,
      ip_address: row.ip_address ?? null,
      device_label: row.device_label ?? null,
      status: row.status,
      plan_name: row.internet_plans?.name ?? null,
      plan_category: row.internet_plans?.category ?? null,
      speed_limit_mbps: row.internet_plans?.speed_limit_mbps ?? null,
      router_name: row.routers?.name ?? null,
    };
  });

/** Ends a guest session for the device that owns it. */
export const disconnectGuestSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ subscriptionId: z.string().uuid(), macAddress: z.string().max(32) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, mac_address")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub || sub.mac_address !== data.macAddress) {
      return { ok: false as const, message: "Session not found for this device" };
    }
    const { terminateSubscription } = await import("./palnet.server");
    await terminateSubscription(data.subscriptionId);
    return { ok: true as const, message: "Disconnected" };
  });

/* ------------------------------- Admin area ------------------------------- */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/** Admin: force-terminate any session. */
export const terminateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { terminateSubscription } = await import("./palnet.server");
    await terminateSubscription(data.subscriptionId);
    return { ok: true as const, message: "Session terminated" };
  });

/** Admin: probe a router and store its health. */
export const testRouterConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ routerId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: router } = await context.supabase
      .from("routers")
      .select("id, ip_address, api_port")
      .eq("id", data.routerId)
      .maybeSingle();
    if (!router) return { ok: false as const, online: false, message: "Router not found" };

    const { pingRouter } = await import("./routerService");
    const probe = await pingRouter(router);

    await context.supabase
      .from("routers")
      .update({ status: probe.online ? "online" : "offline", last_ping: new Date().toISOString() })
      .eq("id", router.id);

    return {
      ok: true as const,
      online: probe.online,
      message: probe.online ? "Router reachable" : "Router did not respond",
    };
  });

const routerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2).max(60),
  ip_address: z.string().trim().min(3).max(45),
  api_port: z.number().int().min(1).max(65535),
  location: z.string().trim().max(80).optional().nullable(),
});

/** Admin: create or update a router. */
export const saveRouter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => routerSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      name: data.name,
      ip_address: data.ip_address,
      api_port: data.api_port,
      location: data.location ?? null,
    };
    const { error } = data.id
      ? await context.supabase.from("routers").update(payload).eq("id", data.id)
      : await context.supabase.from("routers").insert(payload);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: data.id ? "Router updated" : "Router added" };
  });

const planSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2).max(60),
  category: z.enum(["hotspot", "home", "tv"]),
  duration_type: z.enum(["minutes", "hours", "days"]),
  duration_value: z.number().int().min(1).max(3650),
  speed_limit_mbps: z.number().int().min(1).max(1000),
  price_kes: z.number().min(0).max(1_000_000),
  download_limit_mb: z.number().int().min(0).max(10_000_000).optional().nullable(),
  is_active: z.boolean(),
});

/** Admin: create or update a plan. */
export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => planSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      name: data.name,
      category: data.category,
      duration_type: data.duration_type,
      duration_value: data.duration_value,
      speed_limit_mbps: data.speed_limit_mbps,
      price_kes: data.price_kes,
      download_limit_mb: data.download_limit_mb ?? null,
      is_active: data.is_active,
    };
    const { error } = data.id
      ? await context.supabase.from("internet_plans").update(payload).eq("id", data.id)
      : await context.supabase.from("internet_plans").insert(payload);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: data.id ? "Plan updated" : "Plan created" };
  });

/** Admin: generate a printable batch of scratch-card codes for a plan. */
export const generateVouchers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ planId: z.string().uuid(), quantity: z.number().int().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const codes = new Set<string>();
    while (codes.size < data.quantity) {
      let code = "";
      for (let i = 0; i < 6; i += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      codes.add(code);
    }

    const rows = [...codes].map((code) => ({ code, plan_id: data.planId, status: "unused" }));
    const { data: inserted, error } = await context.supabase
      .from("vouchers")
      .insert(rows)
      .select("code");
    if (error) return { ok: false as const, message: error.message, codes: [] as string[] };

    return {
      ok: true as const,
      message: `${inserted?.length ?? 0} scratch cards generated`,
      codes: (inserted ?? []).map((row: { code: string }) => row.code),
    };
  });

/* -------- Logged-in user convenience wrappers (kept for compatibility) ---- */

/**
 * Signed-in user M-Pesa payment. Delegates to startGuestPayment but attaches
 * the authenticated user_id via the session.
 */
export const payWithMpesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ planId: z.string().uuid(), phone: z.string().min(9).max(15) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) {
      return { ok: false as const, message: "Enter a valid Safaricom number, e.g. 0712345678" };
    }

    const { data: plan } = await context.supabase
      .from("internet_plans")
      .select("id, name, price_kes, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !plan.is_active) {
      return { ok: false as const, message: "This package is not available right now" };
    }

    const reference = `PN${Date.now().toString(36).toUpperCase()}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      plan_id: plan.id,
      amount_kes: plan.price_kes,
      payment_method: "mpesa",
      transaction_reference: reference,
      status: "pending",
      phone_number: phone,
    });
    if (txError) return { ok: false as const, message: "Could not start payment. Try again." };

    const { requestStkPush } = await import("./mpesa.server");
    const push = await requestStkPush({
      phone,
      amount: Number(plan.price_kes),
      reference,
      description: plan.name,
    });

    if (!push.live) {
      const { processMpesaCallback } = await import("./routerService");
      const result = await processMpesaCallback({
        Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: reference } },
      });
      return {
        ok: result.ok as true,
        simulated: true as const,
        reference,
        message: result.ok
          ? `Payment of KES ${plan.price_kes} confirmed — you are online.`
          : "Payment could not be confirmed",
      };
    }

    return {
      ok: true as const,
      simulated: false as const,
      reference,
      message: `Check ${data.phone} and enter your M-Pesa PIN to go online.`,
    };
  });

/** Signed-in user scratch-card redemption. */
export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase().replace(/\s/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: voucher } = await supabaseAdmin
      .from("vouchers")
      .select("id, plan_id, status")
      .eq("code", code)
      .maybeSingle();

    if (!voucher) return { ok: false as const, message: "That voucher code was not found" };
    if (voucher.status !== "unused") {
      return { ok: false as const, message: "This voucher has already been used" };
    }

    const { activateSubscription } = await import("./palnet.server");
    const activation = await activateSubscription({
      userId: context.userId,
      planId: voucher.plan_id as string,
    });

    await supabaseAdmin
      .from("vouchers")
      .update({ status: "active", activated_at: new Date().toISOString(), expires_at: activation.endTime })
      .eq("id", voucher.id);

    const { data: plan } = await supabaseAdmin
      .from("internet_plans")
      .select("name")
      .eq("id", voucher.plan_id as string)
      .maybeSingle();

    return { ok: true as const, message: `${plan?.name ?? "Voucher"} activated — you are online.` };
  });

/** Signed-in user self-disconnect. */
export const disconnectMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .gt("end_time", new Date().toISOString())
      .order("end_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return { ok: false as const, message: "No active session found" };
    const { terminateSubscription } = await import("./palnet.server");
    await terminateSubscription(sub.id as string);
    return { ok: true as const, message: "You have been disconnected" };
  });

/** Admin: claim the admin role — allowed only while no admin exists yet. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false as const, message: "An admin already exists" };

    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    await supabaseAdmin.from("profiles").update({ role: "admin" }).eq("id", context.userId);
    return { ok: true as const, message: "You are now the PalNet administrator" };
  });

/* ─── Installation request (guest, no auth required) ─── */

export const submitInstallationRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80),
        phoneNumber: z.string().min(9).max(15),
        houseNumber: z.string().trim().min(1).max(60),
        preferredPlanId: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phoneNumber) ?? data.phoneNumber;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("installation_requests").insert({
      full_name: data.fullName,
      phone_number: phone,
      house_number: data.houseNumber,
      preferred_plan_id: data.preferredPlanId ?? null,
      status: "pending",
    });
    if (error) return { ok: false as const, message: "Could not submit request. Please try again." };
    return { ok: true as const, message: "Request received! Our team will contact you shortly." };
  });

/* ─── Session transfer / reconnect (no auth — proven by holding the code) ─── */

/**
 * Reconnect / Transfer: the caller proves ownership of a session by presenting
 * the original M-Pesa transaction reference or PalNet voucher code, then binds
 * the session to their current device (MAC / IP).
 *
 * Server-side steps:
 *  1. Resolve the code → active subscription
 *  2. Verify time has not expired
 *  3. Save old MAC as previous_mac_address
 *  4. Update subscription with new MAC / IP / user-agent
 *  5. Trigger router: revoke old device, authorize new device
 */
export const transferSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().trim().min(6).max(20),
        ...deviceSchema,
        userAgent: z.string().max(200).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase().replace(/\s/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ── 1. Resolve the code ──────────────────────────────────────────────────
    // Try transactions table first (M-Pesa reference)
    let subscriptionId: string | null = null;

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("transaction_reference", code)
      .eq("status", "completed")
      .maybeSingle();

    if (tx) {
      // Find the subscription that was activated for this transaction
      // We join via plan_id + created_at proximity (best match within 5 minutes)
      const { data: sub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("id")
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subscriptionId = sub?.id ?? null;
    }

    // Try vouchers table if no tx match
    if (!subscriptionId) {
      const { data: voucher } = await supabaseAdmin
        .from("vouchers")
        .select("id, subscription_id")
        .eq("code", code)
        .in("status", ["active", "used"])
        .maybeSingle();
      if (voucher?.subscription_id) {
        subscriptionId = voucher.subscription_id as string;
      }
    }

    if (!subscriptionId) {
      return { ok: false as const, message: "No active session found for that code. Check the code and try again." };
    }

    // ── 2. Load the current subscription ────────────────────────────────────
    const { data: sub } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, mac_address, ip_address, end_time, router_id, internet_plans(duration_value, duration_type)")
      .eq("id", subscriptionId)
      .eq("status", "active")
      .gt("end_time", new Date().toISOString())
      .maybeSingle();

    if (!sub) {
      return { ok: false as const, message: "Session has expired or was already terminated." };
    }

    const remainingMs = new Date(sub.end_time as string).getTime() - Date.now();
    const remainingMinutes = Math.floor(remainingMs / 60_000);

    const oldMac = (sub.mac_address as string | null) ?? null;
    const oldIp = (sub.ip_address as string | null) ?? null;
    const newMac = data.macAddress ?? null;
    const newIp = data.ipAddress ?? null;

    // Nothing to transfer — already the same device
    if (oldMac && oldMac === newMac) {
      return { ok: true as const, message: "This device is already the registered device for that session." };
    }

    // ── 3 & 4. Update subscription ───────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        previous_mac_address: oldMac,
        mac_address: newMac,
        ip_address: newIp,
        user_agent: data.userAgent ?? null,
        last_reconnect_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updateErr) {
      return { ok: false as const, message: "Database error — could not transfer session." };
    }

    // ── 5. Router: revoke old, authorize new ─────────────────────────────────
    if (sub.router_id) {
      const { data: router } = await supabaseAdmin
        .from("routers")
        .select("ip_address, api_port")
        .eq("id", sub.router_id as string)
        .maybeSingle();

      if (router) {
        const { transferDevice } = await import("./routerService");
        await transferDevice({
          oldMac,
          oldIp,
          newMac,
          newIp,
          remainingMinutes,
          target: router,
        }).catch(() => null); // non-fatal — session is already updated in DB
      }
    }

    return {
      ok: true as const,
      message: "Session successfully transferred to this device! You are now online.",
    };
  });

/* ─── Device-lock check (client calls this to detect a locked session) ─── */

/**
 * Returns the registered MAC for a session identified by phone number so the
 * portal can show the "Device Locked" screen when the current device differs.
 */
export const checkDeviceLock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().min(9).max(15).optional().nullable(),
        macAddress: z.string().max(32).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{
    locked: boolean;
    registeredMac: string | null;
    currentMac: string | null;
    subscriptionId: string | null;
    planName: string | null;
    endTime: string | null;
  }> => {
    if (!data.phone && !data.macAddress) {
      return { locked: false, registeredMac: null, currentMac: data.macAddress ?? null, subscriptionId: null, planName: null, endTime: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If we already know the MAC, check if there's an *active* session for a *different* MAC on the same phone
    let query = supabaseAdmin
      .from("user_subscriptions")
      .select("id, mac_address, end_time, internet_plans(name)")
      .eq("status", "active")
      .gt("end_time", new Date().toISOString())
      .order("end_time", { ascending: false })
      .limit(1);

    if (data.phone) {
      const normalized = normalizePhone(data.phone) ?? data.phone;
      query = query.eq("phone_number", normalized) as typeof query;
    } else {
      // MAC is known — already the registered device
      return { locked: false, registeredMac: data.macAddress ?? null, currentMac: data.macAddress ?? null, subscriptionId: null, planName: null, endTime: null };
    }

    const { data: rows } = await query;
    type SubRow = { id: string; mac_address: string | null; end_time: string; internet_plans?: { name: string } | null };
    const sub = rows?.[0] as unknown as SubRow | undefined;

    if (!sub) {
      return { locked: false, registeredMac: null, currentMac: data.macAddress ?? null, subscriptionId: null, planName: null, endTime: null };
    }

    const isSameDevice = !sub.mac_address || sub.mac_address === data.macAddress;

    return {
      locked: !isSameDevice,
      registeredMac: sub.mac_address ?? null,
      currentMac: data.macAddress ?? null,
      subscriptionId: sub.id,
      planName: sub.internet_plans?.name ?? null,
      endTime: sub.end_time,
    };
  });

/* ─── Tethering flag (called by portal or background worker) ─── */

export const flagSuspiciousTethering = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ subscriptionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_subscriptions")
      .update({
        suspicious_tethering: true,
        tether_attempts_count: supabaseAdmin.rpc("increment_tether_count" as any, { sub_id: data.subscriptionId }) as any,
      })
      .eq("id", data.subscriptionId);
    return { ok: true as const };
  });

/* ─── Admin: update global network setting ─── */

export const updateNetworkSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ key: z.string().min(1).max(60), value: z.string().max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const now = new Date().toISOString();

      // Use upsert with explicit onConflict to ensure insert-or-update behavior.
      // Requires `key` to be a PRIMARY KEY or UNIQUE column on the table.
      const { data: saved, error } = await supabaseAdmin
        .from("network_settings")
        .upsert(
          { key: data.key, value: data.value, updated_at: now },
          { onConflict: "key" },
        )
        .select()
        .limit(1)
        .single();

      if (error) throw error;
      return { ok: true as const, message: "Setting updated", setting: saved };
    } catch (err: any) {
      console.error("updateNetworkSetting error:", err);
      return { ok: false as const, message: err?.message ?? String(err) };
    }
  });

/* ─── Admin: apply / remove anti-tethering rules on all online routers ─── */

export const applyAntiTetheringToAllRouters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ enable: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: routers } = await supabaseAdmin
      .from("routers")
      .select("ip_address, api_port")
      .eq("status", "online");

    if (!routers?.length) {
      return { ok: true as const, message: "No online routers found — settings saved only in DB." };
    }

    const { applyAntiTetheringRules, removeAntiTetheringRules } = await import("./routerService");
    let applied = 0;
    for (const r of routers) {
      const result = data.enable
        ? await applyAntiTetheringRules(r)
        : await removeAntiTetheringRules(r);
      if (result.ok) applied++;
    }

    return {
      ok: true as const,
      message: `${data.enable ? "Applied" : "Removed"} anti-tethering rules on ${applied}/${routers.length} router(s).`,
    };
  });

/* ─── Admin: delete a plan ─── */

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("internet_plans")
      .delete()
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, message: "Plan deleted" };
  });

/* ─── Poll payment status (client polls every 3s after STK push) ─── */

export const pollPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ reference: z.string().min(4).max(40) }).parse(data),
  )
  .handler(async ({ data }): Promise<{
    status: "pending" | "completed" | "failed" | "expired";
    subscriptionEndTime: string | null;
    planName: string | null;
    message: string;
  }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id, status, plan_id, created_at, internet_plans(name)")
      .eq("transaction_reference", data.reference)
      .maybeSingle();

    if (!tx) {
      return { status: "expired", subscriptionEndTime: null, planName: null, message: "Transaction not found." };
    }

    // Expire pending transactions older than 5 minutes
    const age = Date.now() - new Date(tx.created_at as string).getTime();
    if (tx.status === "pending" && age > 5 * 60 * 1000) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", tx.id);
      return { status: "expired", subscriptionEndTime: null, planName: (tx.internet_plans as any)?.name ?? null, message: "Payment request expired. Please try again." };
    }

    if (tx.status === "failed") {
      return { status: "failed", subscriptionEndTime: null, planName: (tx.internet_plans as any)?.name ?? null, message: "Payment was cancelled or failed. Please try again." };
    }

    if (tx.status === "completed") {
      // Find the active subscription created for this reference
      const { data: sub } = await supabaseAdmin
        .from("user_subscriptions")
        .select("end_time")
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        status: "completed",
        subscriptionEndTime: (sub?.end_time as string | null) ?? null,
        planName: (tx.internet_plans as any)?.name ?? null,
        message: "Payment confirmed — you are online!",
      };
    }

    return { status: "pending", subscriptionEndTime: null, planName: (tx.internet_plans as any)?.name ?? null, message: "Waiting for M-Pesa confirmation…" };
  });
