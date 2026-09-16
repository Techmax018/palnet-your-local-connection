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
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
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
