import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone } from "./palnet";

const purchaseSchema = z.object({
  planId: z.string().uuid(),
  phone: z.string().min(9).max(15),
  macAddress: z.string().max(32).optional().nullable(),
});

/**
 * Starts an M-Pesa STK push for a plan, records the pending transaction and —
 * once the callback confirms payment — activates the subscription. Without live
 * Daraja credentials the push is auto-confirmed so the flow stays testable.
 */
export const payWithMpesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => purchaseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false as const, message: "Enter a valid Safaricom number, e.g. 0712345678" };

    const { data: plan, error: planError } = await context.supabase
      .from("internet_plans")
      .select("id, name, price_kes, is_active")
      .eq("id", data.planId)
      .single();
    if (planError || !plan || !plan.is_active) {
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
    });
    if (txError) return { ok: false as const, message: "Could not start payment. Try again." };

    await supabaseAdmin
      .from("profiles")
      .update({ phone_number: phone })
      .eq("id", context.userId);

    const { requestStkPush } = await import("./mpesa.server");
    const push = await requestStkPush({
      phone,
      amount: Number(plan.price_kes),
      reference,
      description: plan.name,
    });

    if (!push.live) {
      // Sandbox mode: confirm immediately through the same callback path.
      const { processMpesaCallback } = await import("./routerService");
      const result = await processMpesaCallback({
        Body: { stkCallback: { ResultCode: 0, CheckoutRequestID: reference } },
      });
      return {
        ok: result.ok,
        simulated: true as const,
        reference,
        message: result.ok
          ? `Payment of ${plan.price_kes} KES confirmed — you are online.`
          : "Payment could not be confirmed",
      };
    }

    return {
      ok: true as const,
      simulated: false as const,
      reference,
      message: `Check your phone ${phone} and enter your M-Pesa PIN to complete payment.`,
    };
  });

/** Redeems a scratch-card voucher and activates the linked plan. */
export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20), macAddress: z.string().max(32).optional().nullable() }).parse(data),
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
    if (voucher.status !== "unused") return { ok: false as const, message: "This voucher has already been used" };

    const { activateSubscription } = await import("./palnet.server");
    const activation = await activateSubscription({
      userId: context.userId,
      planId: voucher.plan_id as string,
      macAddress: data.macAddress ?? null,
    });

    await supabaseAdmin
      .from("vouchers")
      .update({
        status: "active",
        used_by: context.userId,
        activated_at: new Date().toISOString(),
        expires_at: activation.endTime,
      })
      .eq("id", voucher.id);

    const { data: plan } = await supabaseAdmin
      .from("internet_plans")
      .select("name, price_kes")
      .eq("id", voucher.plan_id as string)
      .single();

    await supabaseAdmin.from("transactions").insert({
      user_id: context.userId,
      plan_id: voucher.plan_id,
      amount_kes: plan?.price_kes ?? 0,
      payment_method: "voucher",
      transaction_reference: code,
      status: "completed",
    });

    return { ok: true as const, message: `${plan?.name ?? "Voucher"} activated — you are online.` };
  });

/** Ends the caller's own active session and revokes router access. */
export const disconnectMySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub } = await context.supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("end_time", { ascending: false })
      .maybeSingle();
    if (!sub) return { ok: false as const, message: "No active session" };

    const { terminateSubscription } = await import("./palnet.server");
    await terminateSubscription(sub.id as string);
    return { ok: true as const, message: "Disconnected" };
  });

/** Admin: force-terminate any session. */
export const terminateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { terminateSubscription } = await import("./palnet.server");
    await terminateSubscription(data.subscriptionId);
    return { ok: true as const };
  });

/** Admin: probe a router and store its health. */
export const testRouterConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ routerId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: router } = await context.supabase
      .from("routers")
      .select("id, ip_address, api_port")
      .eq("id", data.routerId)
      .single();
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
