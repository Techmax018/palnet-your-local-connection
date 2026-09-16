import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { terminateSession } from "@/lib/palnet.functions";
import { formatCountdown } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/sessions")({
  head: () => ({ meta: [{ title: "PalNet Admin — Sessions" }] }),
  component: AdminSessions,
});

type Session = {
  id: string;
  mac_address: string | null;
  ip_address: string | null;
  phone_number: string | null;
  device_label: string | null;
  start_time: string;
  end_time: string;
  status: string;
  internet_plans: { name: string; category: string } | null;
  routers: { name: string } | null;
};

function AdminSessions() {
  const queryClient = useQueryClient();
  const kick = useServerFn(terminateSession);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["admin-sessions"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(
          "id, mac_address, ip_address, phone_number, device_label, start_time, end_time, status, internet_plans(name, category), routers(name)",
        )
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("end_time", { ascending: false });
      return (data ?? []) as unknown as Session[];
    },
  });

  const filtered = (sessions ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.mac_address?.toLowerCase().includes(q) ||
      s.ip_address?.toLowerCase().includes(q) ||
      s.phone_number?.includes(q) ||
      s.internet_plans?.name.toLowerCase().includes(q)
    );
  });

  async function handleKick(sessionId: string) {
    setBusy(sessionId);
    try {
      const result = await kick({ data: { subscriptionId: sessionId } });
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    } catch {
      toast.error("Failed to terminate session");
    } finally {
      setBusy(null);
    }
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Active Sessions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions?.length ?? 0} connected device{sessions?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search MAC, IP, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <Card className="surface-panel p-0 overflow-hidden gap-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">MAC / Device</th>
                  <th className="px-4 py-2.5 text-left font-medium">IP</th>
                  <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                  <th className="px-4 py-2.5 text-left font-medium">Router</th>
                  <th className="px-4 py-2.5 text-left font-medium">Remaining</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((s) => {
                  const remaining = new Date(s.end_time).getTime() - now;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-display">{s.mac_address ?? "—"}</p>
                        {s.device_label && (
                          <p className="text-muted-foreground truncate max-w-[120px]" title={s.device_label}>
                            {s.device_label}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-display text-muted-foreground">{s.ip_address ?? "—"}</td>
                      <td className="px-4 py-2.5 font-display">{s.phone_number ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.internet_plans?.category === "tv"
                            ? "bg-accent/20 text-accent"
                            : s.internet_plans?.category === "home"
                            ? "bg-primary/20 text-primary"
                            : "bg-success/20 text-success"
                        }`}>
                          {s.internet_plans?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.routers?.name ?? "Auto"}</td>
                      <td className="px-4 py-2.5 font-display tabular-nums">
                        <span className={remaining < 300_000 ? "text-destructive" : "text-foreground"}>
                          {formatCountdown(remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 text-xs gap-1 px-2"
                            disabled={busy === s.id}
                            onClick={() => handleKick(s.id)}
                          >
                            {busy === s.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <Zap className="size-3" />}
                            Kick
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {search ? "No sessions match your search" : "No active sessions"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
