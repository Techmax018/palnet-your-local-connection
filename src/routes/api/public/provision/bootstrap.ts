import { createFileRoute } from "@tanstack/react-router";

const APP_HOST = "palnet-wifi.lovable.app";

function rosEscape(v: string) {
  return v.replace(/[^A-Za-z0-9_.-]/g, "");
}

export const Route = createFileRoute("/api/public/provision/bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!/^prov_[a-z0-9]{16,64}$/i.test(token)) return new Response("Invalid token", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("provision_tokens")
          .select("id, site_identity, is_used, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!row) return new Response("Invalid token", { status: 404 });
        if (row.is_used) return new Response("Token already used", { status: 410 });
        if (new Date(row.expires_at) <= new Date()) return new Response("Token expired", { status: 410 });

        const heartbeatKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        // Atomic one-time claim
        const { data: claimed } = await supabaseAdmin
          .from("provision_tokens")
          .update({ is_used: true, used_at: new Date().toISOString(), heartbeat_key: heartbeatKey })
          .eq("id", row.id)
          .eq("is_used", false)
          .select("id");
        if (!claimed?.length) return new Response("Token already used", { status: 410 });

        const site = rosEscape(row.site_identity) || "PalNet-Site";
        const url = `https://${APP_HOST}/api/public/provision/heartbeat`;
        const rsc = `# PalNet bootstrap (RouterOS 7.x)
/system backup save name="before-palnet-provision" dont-encrypt=yes
/system identity set name="${site}"
/ip hotspot walled-garden
add dst-host="${APP_HOST}" comment="PalNet Portal"
add dst-host="*.payhero.co.ke" comment="PayHero API"
/system script
remove [find name="PalNetHeartbeat"]
add name="PalNetHeartbeat" policy=read,write,test source={
:local cpu [/system resource get cpu-load]
:local mem [/system resource get free-memory]
:local up [/system resource get uptime]
/tool fetch url="${url}" mode=https http-method=post keep-result=no http-header-field="Content-Type: application/json,X-PalNet-Key: ${heartbeatKey}" http-data=("{\\"site\\":\\"${site}\\",\\"cpu_load\\":" . \\$cpu . ",\\"free_memory\\":" . \\$mem . ",\\"uptime\\":\\"" . \\$up . "\\"}")
}
/system scheduler
remove [find name="PalNetHeartbeatSchedule"]
add name="PalNetHeartbeatSchedule" interval=1m on-event="PalNetHeartbeat" start-time=startup
`;
        return new Response(rsc, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
      },
    },
  },
});
