import { createFileRoute } from "@tanstack/react-router";

import { buildBootstrapScript, validateProvisionToken } from "@/lib/provisioning";

const APP_HOST = "palnet-wifi.lovable.app";

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
        const { data: row } = await supabaseAdmin
          .from("provision_tokens")
          .select("id, site_identity, is_used, expires_at, token")
          .eq("token", token)
          .maybeSingle();

        if (!row) return new Response("Invalid token", { status: 404 });
        if (row.is_used) return new Response("Token already used", { status: 410 });

        const validation = validateProvisionToken(token, row.expires_at);
        if (!validation.ok) {
          return new Response(validation.message ?? "Token invalid", { status: 410 });
        }

        const heartbeatKey = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
        const { data: claimed } = await supabaseAdmin
          .from("provision_tokens")
          .update({ is_used: true, used_at: new Date().toISOString(), heartbeat_key: heartbeatKey })
          .eq("id", row.id)
          .eq("is_used", false)
          .select("id");

        if (!claimed?.length) return new Response("Token already used", { status: 410 });

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
