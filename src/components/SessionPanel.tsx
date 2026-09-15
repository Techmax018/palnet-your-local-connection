import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, PowerOff, Router as RouterIcon } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCountdown } from "@/lib/palnet";
import { disconnectMySession } from "@/lib/palnet.functions";
import type { ActiveSession } from "@/hooks/usePalNet";

export function SessionPanel({
  session,
  onTopUp,
}: {
  session: ActiveSession;
  onTopUp: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const disconnect = useServerFn(disconnectMySession);
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(session.end_time).getTime() - now;

  async function handleDisconnect() {
    setBusy(true);
    try {
      const result = await disconnect({});
      toast[result.ok ? "success" : "error"](result.message);
      await queryClient.invalidateQueries();
    } catch {
      toast.error("Could not disconnect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="surface-panel gap-0 p-6 glow-neon">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Active session</p>
          <h2 className="font-display text-xl font-bold text-foreground">
            {session.internet_plans?.name ?? "PalNet Access"}
          </h2>
        </div>
        <Badge className="bg-success text-success-foreground">Online</Badge>
      </div>

      <p className="mt-5 font-display text-4xl font-black tabular-nums text-gradient-brand sm:text-5xl">
        {formatCountdown(remaining)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Time remaining before disconnection</p>

      <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
          <dt className="text-xs text-muted-foreground">Device MAC</dt>
          <dd className="mt-0.5 font-display text-foreground">{session.mac_address ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
          <dt className="text-xs text-muted-foreground">Assigned IP</dt>
          <dd className="mt-0.5 font-display text-foreground">{session.ip_address ?? "—"}</dd>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RouterIcon className="size-3.5" /> Router
          </dt>
          <dd className="mt-0.5 font-display text-foreground">
            {session.routers?.name ?? "Auto-assigned"}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="flex-1 font-display" onClick={onTopUp}>
          <Plus /> Top up / extend time
        </Button>
        <Button
          variant="destructive"
          className="flex-1 font-display"
          disabled={busy}
          onClick={handleDisconnect}
        >
          {busy ? <Loader2 className="animate-spin" /> : <PowerOff />} Disconnect
        </Button>
      </div>
    </Card>
  );
}
