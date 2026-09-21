/**
 * PayHero (Lipwa) M-Pesa STK Push.
 *
 * Runs live when the PayHero credentials are configured as secrets; otherwise it
 * reports `live: false` so the caller can confirm the payment locally and keep
 * the billing flow usable during setup.
 */

const PAYHERO_BASE = "https://backend.payhero.co.ke/api/v2";

function basicAuth(): string | undefined {
  const explicit = process.env["PAYHERO_BASIC_AUTH"];
  if (explicit) return explicit.startsWith("Basic ") ? explicit : `Basic ${explicit}`;
  const user = process.env["PAYHERO_API_USERNAME"];
  const pass = process.env["PAYHERO_API_PASSWORD"];
  if (!user || !pass) return undefined;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function callbackUrl(): string | undefined {
  const direct = process.env["PAYHERO_CALLBACK_URL"] ?? process.env["MPESA_CALLBACK_URL"];
  if (direct) return direct;
  const appUrl = process.env["APP_URL"] ?? process.env["NEXT_PUBLIC_APP_URL"];
  if (!appUrl) return undefined;
  return new URL(
    "/api/public/mpesa/callback",
    appUrl.endsWith("/") ? appUrl : `${appUrl}/`,
  ).toString();
}

export async function requestStkPush(input: {
  phone: string;
  amount: number;
  reference: string;
  description: string;
}): Promise<{ live: boolean; message: string; providerReference?: string }> {
  const auth = basicAuth();
  const channelId = Number(process.env["PAYHERO_CHANNEL_ID"] ?? "");
  const callback = callbackUrl();

  if (!auth || !channelId || !callback) {
    console.info("[payhero] credentials missing — simulating STK push", input.reference);
    return { live: false, message: "Simulated STK push" };
  }

  let res: Response;
  try {
    res = await fetch(`${PAYHERO_BASE}/payments`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(input.amount),
        phone_number: input.phone,
        channel_id: channelId,
        provider: "m-pesa",
        external_reference: input.reference,
        customer_name: input.description.slice(0, 60),
        callback_url: callback,
      }),
    });
  } catch (error) {
    console.error("[payhero] request failed", error);
    return { live: false, message: "Could not reach PayHero" };
  }

  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`[payhero] stk push failed [${res.status}]: ${bodyText}`);
    return { live: false, message: "STK push rejected by PayHero" };
  }

  let parsed: { success?: boolean; status?: string; reference?: string; CheckoutRequestID?: string; error_message?: string } = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    /* PayHero returned a non-JSON body; treat as accepted only if 2xx */
  }

  if (parsed.success === false) {
    console.error(`[payhero] stk push rejected: ${bodyText}`);
    return { live: false, message: parsed.error_message ?? "STK push rejected by PayHero" };
  }

  return {
    live: true,
    message: "STK push sent",
    providerReference: parsed.reference ?? parsed.CheckoutRequestID,
  };
}
