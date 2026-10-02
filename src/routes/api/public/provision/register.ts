import { createFileRoute } from "@tanstack/react-router";

import { parseDeviceRegistration } from "@/lib/provisioning";

export const Route = createFileRoute("/api/public/provision/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.json().catch(() => null);
        const parsed = parseDeviceRegistration(raw);
        if (!parsed.ok) {
          return new Response(parsed.message, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenRow } = await supabaseAdmin
          .from("provision_tokens")
          .select("id, site_identity, is_used, expires_at, heartbeat_key")
          .eq("token", parsed.data.token)
          .maybeSingle();

        if (!tokenRow) {
          return new Response("Invalid token", { status: 404 });
        }

        if (new Date(tokenRow.expires_at) <= new Date()) {
          return new Response("Token expired", { status: 410 });
        }

        const heartbeatKey =
          tokenRow.heartbeat_key ??
          `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;

        const siteIdentity = parsed.data.site_identity || tokenRow.site_identity;
        const now = new Date().toISOString();

        const { data: existingRouter } = await supabaseAdmin
          .from("routers")
          .select("id")
          .eq("site_identity", siteIdentity)
          .maybeSingle();

        if (existingRouter) {
          await supabaseAdmin
            .from("routers")
            .update({
              name: siteIdentity,
              status: "online",
              last_seen: now,
              last_ping: now,
              ip_address: request.headers.get("cf-connecting-ip") ?? "0.0.0.0",
            })
            .eq("id", existingRouter.id);
        } else {
          await supabaseAdmin.from("routers").insert({
            name: siteIdentity,
            site_identity: siteIdentity,
            ip_address: request.headers.get("cf-connecting-ip") ?? "0.0.0.0",
            api_port: 8728,
            status: "online",
            last_seen: now,
            last_ping: now,
            location: parsed.data.board_name,
            created_at: now,
          });
        }

        await supabaseAdmin
          .from("provision_tokens")
          .update({
            is_used: true,
            used_at: now,
            heartbeat_key: heartbeatKey,
          })
          .eq("id", tokenRow.id)
          .eq("is_used", false)
          .select("id");

        return Response.json({
          ok: true,
          site_identity: siteIdentity,
          device_id: parsed.data.device_id,
          serial_number: parsed.data.serial_number,
          model: parsed.data.model,
          heartbeat_key: heartbeatKey,
          config_version: "v1",
        });
      },
    },
  },
});
