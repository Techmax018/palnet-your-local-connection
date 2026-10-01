import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  site: z.string().max(64).optional(),
  cpu_load: z.coerce.number().int().min(0).max(100),
  free_memory: z.coerce.number().int().min(0),
  uptime: z.string().max(40),
});

export const Route = createFileRoute("/api/public/provision/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-palnet-key") ?? "";
        if (key.length < 32) return new Response("Unauthorized", { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("provision_tokens")
          .select("site_identity")
          .eq("heartbeat_key", key)
          .maybeSingle();
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const site = tok.site_identity; // identity comes from the key, never the body
        const now = new Date().toISOString();
        const telemetry = {
          status: "online",
          cpu_load: parsed.data.cpu_load,
          free_memory: parsed.data.free_memory,
          uptime: parsed.data.uptime,
          last_seen: now,
          last_ping: now,
        };
        const { data: existing } = await supabaseAdmin
          .from("routers").select("id").eq("site_identity", site).maybeSingle();
        let routerId = existing?.id as string | undefined;
        if (routerId) {
          await supabaseAdmin.from("routers").update(telemetry).eq("id", routerId);
        } else {
          const ip = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";
          const { data: created } = await supabaseAdmin
            .from("routers")
            .insert({ name: site, site_identity: site, ip_address: ip, ...telemetry })
            .select("id").single();
          routerId = created?.id as string | undefined;
        }
        if (routerId) {
          await supabaseAdmin.from("router_heartbeats").insert({
            router_id: routerId, cpu: parsed.data.cpu_load,
            memory: Math.min(parsed.data.free_memory, 2147483647),
            uptime: parsed.data.uptime, status: "online",
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
