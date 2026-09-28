import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE ?? null;

  if (url && serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  try {
    const mod = await import("@/integrations/supabase/client");
    return (mod as any).supabase;
  } catch (err) {
    throw new Error("No Supabase client available: set SUPABASE_SERVICE_ROLE_KEY or configure client exports");
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  try {
    const supabase = await getSupabaseAdmin();
    const { data: row, error: selErr } = await supabase
      .from("provision_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (selErr) {
      console.error("[provision/bootstrap] select error", selErr);
      return new Response("Server error", { status: 500 });
    }

    if (!row) return new Response("Invalid token", { status: 404 });

    const isUsed = (row as any).is_used;
    const expiresAt = (row as any).expires_at ? new Date((row as any).expires_at) : null;
    const now = new Date();

    if (isUsed) return new Response("Token already used", { status: 410 });
    if (expiresAt && expiresAt <= now) return new Response("Token expired", { status: 410 });

    const siteIdentity = (row as any).site_identity ?? (row as any).site ?? token;

    // mark token used
    await supabase.from("provision_tokens").update({ is_used: true, used_at: new Date().toISOString() }).eq("token", token);

    const payload = `/system backup save name="before-palnet-provision" overwrite=yes
/system identity set name="${siteIdentity}"
/ip hotspot walled-garden
add dst-host="palnet-wifi.lovable.app" comment="PalNet Portal"
add dst-host="*.payhero.co.ke" comment="PayHero API"
add dst-host="*.supabase.co" comment="Supabase Backend"

/system script
add name="PalNetHeartbeat" owner="admin" source="{\\
    :local cpu [/system resource get cpu-load];\\
    :local freeMem [/system resource get free-memory];\\
    :local uptime [/system resource get uptime];\\
    /tool fetch url=\"https://palnet-wifi.lovable.app/api/provision/heartbeat\" http-method=post http-data=\"{\\\"device_id\\\":\\\"${siteIdentity}\\\",\\\"cpu\\\":\\\$cpu,\\\"memory\\\":\\\$freeMem,\\\"uptime\\\":\\\"\\\$uptime\\\"}\" http-header-field=\"Content-Type: application/json\" keep-result=no;\\
} "

/system scheduler
add name="PalNetHeartbeatSchedule" interval=1m on-event="PalNetHeartbeat" start-time=startup
`;

    return new Response(payload, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    console.error("[provision/bootstrap] error", err);
    return new Response("Server error", { status: 500 });
  }
}
