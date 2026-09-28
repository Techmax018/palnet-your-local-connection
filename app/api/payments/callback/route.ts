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
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch (err) {
    console.error("[payhero-callback] invalid JSON payload", err);
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  // Expect strict PayHero structure: { response: { Status, Amount, MpesaReceiptNumber, Phone, CheckoutRequestID, ResultDesc } }
  const body = raw as { response?: Record<string, unknown> } | undefined;
  const resp = body?.response;

  if (!resp || typeof resp !== "object") {
    console.error("[payhero-callback] missing response object");
    return NextResponse.json({ success: false, message: "Invalid callback shape" }, { status: 400 });
  }

  const Status = resp.Status;
  const Amount = resp.Amount;
  const MpesaReceiptNumber = resp.MpesaReceiptNumber;
  const Phone = resp.Phone;
  const CheckoutRequestID = resp.CheckoutRequestID;
  const ResultDesc = resp.ResultDesc;

  if (typeof Status !== "boolean" || typeof Amount !== "number" || typeof MpesaReceiptNumber !== "string" || typeof Phone !== "string") {
    console.error("[payhero-callback] invalid response field types", { Status, Amount, MpesaReceiptNumber, Phone });
    return NextResponse.json({ success: false, message: "Invalid callback fields" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseAdmin();

    const reference = String(CheckoutRequestID ?? MpesaReceiptNumber);
    const phone = normalizePhone(Phone) ?? null;
    const amount = Amount;
    const mappedStatus = Status ? "completed" : "failed";

    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("transaction_reference", reference)
      .maybeSingle();

    const updatePayload: Record<string, unknown> = {
      payment_method: "payhero",
      status: mappedStatus,
      transaction_reference: reference,
      updated_at: new Date().toISOString(),
    };
    updatePayload.amount_kes = amount;
    if (phone) updatePayload.phone_number = phone;

    if (existing?.id) {
      const { error: updateError } = await supabase.from("transactions").update(updatePayload).eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const insertPayload: Record<string, unknown> = {
        payment_method: "payhero",
        status: mappedStatus,
        amount_kes: amount,
        phone_number: phone,
        transaction_reference: reference,
        created_at: new Date().toISOString(),
      };
      const { error: insertError } = await supabase.from("transactions").insert(insertPayload);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, message: "Accepted", status: mappedStatus }, { status: 200 });
  } catch (error) {
    console.error("[payhero-callback] callback processing error", error);
    return NextResponse.json({ success: false, message: "Callback processing error" }, { status: 500 });
  }
}
