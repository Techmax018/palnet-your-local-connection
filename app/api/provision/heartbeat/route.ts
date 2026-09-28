import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE ?? null;

  // Prefer service-role client when available; fall back to the public client for local testing.
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

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[provision/heartbeat] invalid JSON", err);
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const data = body as { device_id?: string; cpu?: number | string; memory?: number | string; uptime?: string } | undefined;
  if (!data || typeof data.device_id !== "string") {
    return NextResponse.json({ success: false, message: "Missing device_id" }, { status: 400 });
  }

  const deviceId = data.device_id;
  const cpu = typeof data.cpu === "string" ? Number(data.cpu) : data.cpu ?? null;
  const freeMemory = typeof data.memory === "string" ? Number(data.memory) : data.memory ?? null;
  const uptime = typeof data.uptime === "string" ? data.uptime : String(data.uptime ?? "");

  try {
    const supabase = await getSupabaseAdmin();
    const now = new Date().toISOString();

    // Find existing router by device_id or identity
    const { data: existing, error: selErr } = await supabase
      .from("routers")
      .select("id")
      .or(`device_id.eq.${deviceId},identity.eq.${deviceId}`)
      .maybeSingle();

    if (selErr) {
      console.error("[provision/heartbeat] select error", selErr);
      return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      device_id: deviceId,
      identity: deviceId,
      status: "online",
      last_seen: now,
      cpu_load: cpu,
      free_memory: freeMemory,
      uptime: uptime,
      updated_at: now,
    };

    let routerId: string | null = existing?.id ?? null;

    if (routerId) {
      const { error: upErr } = await supabase.from("routers").update(payload).eq("id", routerId);
      if (upErr) throw upErr;
    } else {
      const { data: insData, error: insErr } = await supabase
        .from("routers")
        .insert({ device_id: deviceId, identity: deviceId, status: "online", last_seen: now, created_at: now })
        .select("id")
        .maybeSingle();
      if (insErr) throw insErr;
      routerId = (insData as any)?.id ?? null;
      if (!routerId) {
        return NextResponse.json({ success: false, message: "Failed to create router" }, { status: 500 });
      }
      // update metrics on inserted row
      const { error: upErr } = await supabase.from("routers").update(payload).eq("id", routerId);
      if (upErr) throw upErr;
    }

    // insert heartbeat row referencing router_id
    const { error: hbErr } = await supabase
      .from("router_heartbeats")
      .insert({ router_id: routerId, cpu: cpu, memory: freeMemory, uptime, status: "online", created_at: now });
    if (hbErr) throw hbErr;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[provision/heartbeat] error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
