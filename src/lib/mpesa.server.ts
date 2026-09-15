/**
 * M-Pesa Daraja STK Push. Runs live when the Daraja credentials are configured
 * as secrets; otherwise it reports `live: false` so the caller can confirm the
 * payment locally and keep the billing flow usable during setup.
 */
export async function requestStkPush(input: {
  phone: string;
  amount: number;
  reference: string;
  description: string;
}): Promise<{ live: boolean; message: string }> {
  const key = process.env["MPESA_CONSUMER_KEY"];
  const secret = process.env["MPESA_CONSUMER_SECRET"];
  const shortcode = process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  const callbackUrl = process.env["MPESA_CALLBACK_URL"];

  if (!key || !secret || !shortcode || !passkey || !callbackUrl) {
    console.info("[mpesa] credentials missing — simulating STK push", input.reference);
    return { live: false, message: "Simulated STK push" };
  }

  const base =
    process.env["MPESA_ENV"] === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const tokenRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
  });
  if (!tokenRes.ok) return { live: false, message: "Could not authenticate with M-Pesa" };
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${stamp}`).toString("base64");

  const pushRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: stamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(input.amount),
      PartyA: input.phone,
      PartyB: shortcode,
      PhoneNumber: input.phone,
      CallBackURL: callbackUrl,
      AccountReference: input.reference,
      TransactionDesc: input.description,
    }),
  });

  if (!pushRes.ok) {
    console.error("[mpesa] stk push failed", await pushRes.text());
    return { live: false, message: "STK push rejected" };
  }

  return { live: true, message: "STK push sent" };
}
