/**
 * DeviceLockedScreen — shown when the portal detects an active session
 * registered to a DIFFERENT MAC address than the current device.
 */
import { Lock, ShieldAlert } from "lucide-react";
import { ReconnectPanel } from "@/components/ReconnectPanel";

export function DeviceLockedScreen({
  registeredMac,
  currentMac,
  planName,
  onUnlocked,
}: {
  registeredMac: string;
  currentMac: string | null;
  planName: string | null;
  onUnlocked: () => void;
}) {
  // Mask all but last 5 chars of the registered MAC for privacy
  const maskedMac = registeredMac.length > 5
    ? `XX:XX:XX:${registeredMac.slice(-5)}`
    : registeredMac;

  return (
    <div className="surface-panel relative overflow-hidden p-5 space-y-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-destructive to-transparent" />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 border border-destructive/25">
          <Lock className="size-5 text-destructive" />
        </div>
        <div>
          <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
            <ShieldAlert className="size-4 text-destructive" />
            Device Locked
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {planName ? <><strong className="text-foreground">{planName}</strong> is</> : "A session is"} currently active on another device{" "}
            <span className="font-display text-foreground">(MAC: {maskedMac})</span>.
          </p>
          {currentMac && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your device: <span className="font-display text-foreground">{currentMac}</span>
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
        To transfer access to <strong className="text-foreground">this device</strong>, enter your
        M-Pesa transaction code or PalNet voucher code below.
      </p>

      <ReconnectPanel onSuccess={onUnlocked} />
    </div>
  );
}
