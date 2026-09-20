import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");

  if (!digits) return raw;

  if (digits.startsWith("0")) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    digits = `254${digits}`;
  } else if (digits.startsWith("+254")) {
    digits = digits.replace("+", "");
  }

  return digits;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phoneNumber?: string;
      amount?: number | string;
      planName?: string;
      reference?: string;
    };

    const phoneNumber = normalizePhone(body.phoneNumber ?? "");
    const amount = Number(body.amount ?? 0);

    if (!phoneNumber || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid phone number and amount are required." },
        { status: 400 },
      );
    }

    const username = process.env.PAYHERO_API_USERNAME;
    const password = process.env.PAYHERO_API_PASSWORD;
    const channelId = Number(process.env.PAYHERO_CHANNEL_ID ?? 0);
    const callbackUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://palnet-wifi.vercel.app").replace(/\/$/, "")}/api/payments/callback`;

    if (!username || !password || !channelId) {
      return NextResponse.json(
        { success: false, message: "PayHero credentials are not configured." },
        { status: 500 },
      );
    }

    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    const payload = {
      amount: Math.round(amount),
      phone_number: phoneNumber,
      channel_id: channelId,
      provider: "m-pesa",
      external_reference: body.reference ?? `PN-${Date.now()}`,
      customer_name: body.planName ?? "PalNet Customer",
      callback_url: callbackUrl,
    };

    const response = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      success?: boolean;
      message?: string;
      error?: string;
      reference?: string;
    };

    if (response.ok && (data.status === "Success" || data.success === true)) {
      return NextResponse.json({
        success: true,
        reference: data.reference ?? payload.external_reference,
        message: "STK push sent to customer phone.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: data.message ?? data.error ?? "STK push failed.",
      },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
