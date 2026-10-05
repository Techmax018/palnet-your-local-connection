import { createFileRoute } from "@tanstack/react-router";
import { hotspotCredentials } from "@/lib/palnet";

/**
 * Router pulls this every 20s (X-PalNet-Key) and imports it: creates a hotspot
 * user for each paid, active session so the portal can log the device in.
 */
export const Route = createFileRoute("/api/public/provision/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = request.headers.get("x-palnet-key") ?? "";
        if (key.length < 32) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tok } = await supabaseAdmin
          .from("provision_tokens").select("site_identity").eq("heartbeat_key", key).maybeSingle();
        if (!tok) return new Response("Unauthorized", { status: 401 });

        const now = Date.now();
        const { data: subs } = await supabaseAdmin
          .from("user_subscriptions")
          .select("id, end_time, status")
          .gt("end_time", new Date(now - 2 * 86_400_000).toISOString())
          .order("end_time", { ascending: false })
          .limit(1000);

        const lines = ["# PalNet hotspot users"];
        for (const s of subs ?? []) {
          const { username, password } = hotspotCredentials(s.id as string);
          const left = Math.floor((new Date(s.end_time as string).getTime() - now) / 1000);
          if (s.status === "active" && left > 0) {
            lines.push(
              `:if ([:len [/ip hotspot user find name="${username}"]] = 0) do={ /ip hotspot user add name="${username}" password="${password}" limit-uptime=${left}s comment="PalNet-auto" }`,
            );
          } else {
            lines.push(`/ip hotspot user remove [find name="${username}"]`);
            lines.push(`/ip hotspot active remove [find user="${username}"]`);
          }
        }
        return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/plain" } });
      },
    },
  },
});
