import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, PowerOff, Router as RouterIcon } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCountdown } from "@/lib/palnet";
import { disconnectMySession, disconnectGuestSession } from "@/lib/palnet.functions";
import type { NormalizedSession } from "@/hooks/usePalNet";

export function SessionPanel({
  session,
  onTopUp,
}: {
  session: NormalizedSession;
  onTopUp: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const disconnectUser = useServerFn(disconnectMySession);
  const disconnectGuest = useServerFn(disconnectGuestSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(session.end_time).getTime() - now;

  async function handleDisconnect() {
    setBusy(true);
    try {
      let result: { ok: boolean; message: string };
      if (session.isGuest) {
        if (!session.mac_address) {
          toast.error("Cannot disconnect — device address not found.");
          return;
        }
        result = await disconnectGuest({
          data: { subscriptionId: session.id, macAddress: session.mac_address },
        });
      } else {
        result = await disconnectUser({ data: {} });
      }
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Could not disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const planName = session.plan_name ?? "PalNet Access";
  const mac = session.mac_address;
  const ip = session.ip_address;
  const router = session.router_name;

  return (
    <Card className="surface-panel gap-0 p-4 glow-neon">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Active session</p>
          <h2 className="font-display text-base font-bold text-foreground">{planName}</h2>
        </div>
        <Badge className="bg-success text-success-foreground text-xs">Online</Badge>
      </div>

      <p className="mt-3 font-display text-3xl font-black tabular-nums text-gradient-brand sm:text-4xl">
        {formatCountdown(remaining)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">Time remaining</p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
          <dt className="text-muted-foreground">MAC</dt>
          <dd className="mt-0.5 font-display truncate text-foreground">{mac ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
          <dt className="text-muted-foreground">IP</dt>
          <dd className="mt-0.5 font-display truncate text-foreground">{ip ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <RouterIcon className="size-3" /> Router
          </dt>
          <dd className="mt-0.5 font-display truncate text-foreground">{router ?? "Auto"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1 font-display text-xs h-8" onClick={onTopUp}>
          <Plus className="size-3.5" /> Top up
        </Button>
        <Button
          variant="destructive"
          className="flex-1 font-display text-xs h-8"
          disabled={busy}
          onClick={handleDisconnect}
        >
          {busy ? <Loader2 className="animate-spin size-3.5" /> : <PowerOff className="size-3.5" />}
          Disconnect
        </Button>
      </div>
    </Card>
  );
}
