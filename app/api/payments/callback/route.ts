import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type PayHeroCallback = {
  id?: string | null;
  reference?: string | null;
  transaction_id?: string | null;
  external_reference?: string | null;
  status?: string | null;
  amount?: number | string | null;
  amount_kes?: number | string | null;
  total_amount?: number | string | null;
  phone_number?: string | null;
  customer_phone?: string | null;
  phone?: string | null;
  msisdn?: string | null;
  provider?: string | null;
  payment_method?: string | null;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;

  let digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    digits = `254${digits}`;
  } else if (digits.startsWith("+254")) {
    digits = digits.replace("+", "");
  }

  return digits.length >= 12 ? digits : null;
}

function parseAmount(raw?: number | string | null): number | null {
  if (raw == null || raw === "") return null;

  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(value)) return null;

  return Number(value);
}

function normalizeStatus(raw?: string | null): "pending" | "completed" | "failed" | "cancelled" {
  const value = (raw ?? "").toString().trim().toLowerCase();

  if (["success", "successful", "completed", "paid", "succeeded", "approved"].includes(value)) {
    return "completed";
  }

  if (["failed", "failure", "declined", "reversed", "error"].includes(value)) {
    return "failed";
  }

  if (["cancelled", "canceled"].includes(value)) {
    return "cancelled";
  }

  return "pending";
}

async function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE ??
    null;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service-role configuration for payment callback.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function POST(request: Request) {
  let payload: PayHeroCallback | null = null;

  try {
    payload = (await request.json()) as PayHeroCallback;
  } catch (error) {
    console.error("[payhero-callback] invalid JSON payload", error);
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 200 });
  }

  try {
    const amount = parseAmount(
      payload.amount ??
        payload.amount_kes ??
        (typeof payload.data?.amount === "number" || typeof payload.data?.amount === "string"
          ? payload.data.amount
          : null) ??
        (typeof payload.data?.amount_kes === "number" || typeof payload.data?.amount_kes === "string"
          ? payload.data.amount_kes
          : null) ??
        (typeof payload.data?.total_amount === "number" || typeof payload.data?.total_amount === "string"
          ? payload.data.total_amount
          : null) ??
        null,
    );

    const phone = normalizePhone(
      payload.phone_number ??
        payload.customer_phone ??
        payload.phone ??
        payload.msisdn ??
        (typeof payload.data?.phone_number === "string" ? payload.data.phone_number : null) ??
        (typeof payload.data?.customer_phone === "string" ? payload.data.customer_phone : null) ??
        null,
    );

    const reference =
      payload.reference ??
      payload.transaction_id ??
      payload.external_reference ??
      payload.id ??
      (typeof payload.data?.reference === "string" ? payload.data.reference : null) ??
      (typeof payload.data?.transaction_id === "string" ? payload.data.transaction_id : null) ??
      (typeof payload.data?.external_reference === "string" ? payload.data.external_reference : null) ??
      `PH-${Date.now()}`;

    const mappedStatus = normalizeStatus(
      typeof payload.status === "string" ? payload.status : null ??
        (typeof payload.data?.status === "string" ? payload.data.status : null) ??
        (typeof payload.data?.state === "string" ? payload.data.state : null),
    );

    const supabase = await getSupabaseAdmin();

    const { data: existing, error: selectError } = await supabase
      .from("transactions")
      .select("id, transaction_reference, status, phone_number, amount_kes")
      .eq("transaction_reference", reference)
      .maybeSingle();

    if (selectError) {
      console.error("[payhero-callback] select error", selectError);
    }

    const updatePayload: Record<string, unknown> = {
      payment_method: payload.provider ?? payload.payment_method ?? "payhero",
      status: mappedStatus,
      transaction_reference: reference,
      updated_at: new Date().toISOString(),
    };

    if (amount != null) updatePayload.amount_kes = amount;
    if (phone) updatePayload.phone_number = phone;

    if (existing?.id) {
      const { error: updateError } = await supabase.from("transactions").update(updatePayload).eq("id", existing.id);
      if (updateError) {
        throw updateError;
      }
    } else {
      const insertPayload: Record<string, unknown> = {
        payment_method: payload.provider ?? payload.payment_method ?? "payhero",
        status: mappedStatus,
        amount_kes: amount ?? 0,
        phone_number: phone,
        transaction_reference: reference,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from("transactions").insert(insertPayload);
      if (insertError) {
        throw insertError;
      }
    }

    return NextResponse.json(
      { success: true, message: "Accepted", status: mappedStatus },
      { status: 200 },
    );
  } catch (error) {
    console.error("[payhero-callback] callback processing error", error);
    return NextResponse.json(
      { success: false, message: "Callback processed with error" },
      { status: 200 },
    );
  }
}
