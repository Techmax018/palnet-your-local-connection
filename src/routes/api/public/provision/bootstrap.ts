import { createFileRoute } from "@tanstack/react-router";

import { buildBootstrapScript, validateProvisionToken } from "@/lib/provisioning";

export const Route = createFileRoute("/api/public/provision/bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const requestOrigin = new URL(request.url).origin;
        if (!/^prov_[a-z0-9_-]{8,96}$/i.test(token)) {
          return new Response("Invalid token", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row, error: lookupError } = await supabaseAdmin
          .from("provision_tokens")
          .select("id, site_identity, is_used, expires_at, token, heartbeat_key")
          .eq("token", token)
          .maybeSingle();

        if (lookupError) {
          console.error("Could not look up bootstrap token.", lookupError);
          return new Response("Could not validate token", { status: 500 });
        }
        if (!row) return new Response("Invalid token", { status: 404 });
        if (row.is_used) return new Response("Token already used", { status: 410 });

        const validation = validateProvisionToken(token, row.expires_at);
        if (!validation.ok) {
          return new Response(validation.message ?? "Token invalid", { status: 410 });
        }

        let heartbeatKey = row.heartbeat_key;
        if (!heartbeatKey) {
          const newHeartbeatKey = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
          const { data: seeded, error: seedError } = await supabaseAdmin
            .from("provision_tokens")
            .update({ heartbeat_key: newHeartbeatKey })
            .eq("id", row.id)
            .eq("is_used", false)
            .is("heartbeat_key", null)
            .select("heartbeat_key")
            .maybeSingle();

          if (seedError) {
            console.error("Could not initialize bootstrap heartbeat key.", seedError);
            return new Response("Could not prepare bootstrap", { status: 500 });
          }

          heartbeatKey = seeded?.heartbeat_key ?? null;
          if (!heartbeatKey) {
            const { data: refreshed, error: refreshError } = await supabaseAdmin
              .from("provision_tokens")
              .select("is_used, heartbeat_key")
              .eq("id", row.id)
              .maybeSingle();

            if (refreshError) {
              console.error("Could not refresh bootstrap token state.", refreshError);
              return new Response("Could not prepare bootstrap", { status: 500 });
            }
            if (!refreshed) return new Response("Invalid token", { status: 404 });
            if (refreshed.is_used) return new Response("Token already used", { status: 410 });
            heartbeatKey = refreshed.heartbeat_key;
            if (!heartbeatKey) {
              console.error("Bootstrap heartbeat key was not persisted for token.", row.id);
              return new Response("Could not prepare bootstrap", { status: 500 });
            }
          }
        }

        const sp = new URL(request.url).searchParams;
        const script = buildBootstrapScript({
          siteIdentity: row.site_identity || validation.siteIdentity || "PalNet-Site",
          token: row.token,
          heartbeatKey,
          configVersion: "v2",
          apiBaseUrl: requestOrigin,
          network: {
            wan: sp.get("wan") ?? undefined,
            lanBridge: sp.get("lan") ?? undefined,
            lanPorts: sp.get("ports")?.split(",") ?? undefined,
            gateway: sp.get("gw") ?? undefined,
            pool: sp.get("pool") ?? undefined,
          },
        });

        return new Response(script, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
