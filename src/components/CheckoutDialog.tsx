/**
 * CheckoutDialog — complete M-Pesa STK push UX with full state machine:
 *
 *  idle        → user enters phone, clicks Pay
 *  waiting_pin → STK push sent, waiting for customer to enter PIN
 *  verifying   → PIN entered (or callback received), confirming session
 *  connected   → subscription active, countdown timer shown
 *  error       → payment failed / expired / cancelled
 *
 * Voucher flow stays simple (instant success/error).
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle, CheckCircle2, Clock, Gauge, Loader2,
  RefreshCw, Smartphone, Ticket, Wifi, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKes, formatCountdown, planDurationLabel, type Plan } from "@/lib/palnet";
import {
  startGuestPayment, redeemGuestVoucher, pollPaymentStatus,
} from "@/lib/palnet.functions";
import { getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";

type PayState =
  | { step: "idle" }
  | { step: "waiting_pin"; reference: string; phone: string; planName: string }
  | { step: "verifying"; reference: string; planName: string }
  | { step: "connected"; planName: string; endTime: string }
  | { step: "error"; reason: "failed" | "expired" | "cancelled"; planName: string };

export function CheckoutDialog({
  plan,
  accountId,
  open,
  onOpenChange,
}: {
  plan: Plan | null;
  accountId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const pay = useServerFn(startGuestPayment);
  const redeem = useServerFn(redeemGuestVoucher);
  const poll = useServerFn(pollPaymentStatus);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [payState, setPayState] = useState<PayState>({ step: "idle" });

  // Live countdown in connected state
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPayState({ step: "idle" });
        setPhone("");
        setCode("");
      }, 300);
    }
  }, [open]);

  // Start/stop countdown ticker
  useEffect(() => {
    if (payState.step === "connected") {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [payState.step]);

  // Poll payment status while waiting_pin or verifying
  useEffect(() => {
    if (payState.step !== "waiting_pin" && payState.step !== "verifying") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const reference = payState.reference;

    async function checkStatus() {
      try {
        const result = await poll({ data: { reference } });

        if (result.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPayState({
            step: "connected",
            planName: result.planName ?? "PalNet Access",
            endTime: result.subscriptionEndTime ?? new Date(Date.now() + 3_600_000).toISOString(),
          });
          await queryClient.invalidateQueries();
        } else if (result.status === "pending" && payState.step === "waiting_pin") {
          // Move to verifying after first ping back
          if (payState.step === "waiting_pin") {
            setPayState((s) => s.step === "waiting_pin"
              ? { step: "verifying", reference: s.reference, planName: s.planName }
              : s);
          }
        } else if (result.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPayState({ step: "error", reason: "failed", planName: result.planName ?? "PalNet" });
        } else if (result.status === "expired") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPayState({ step: "error", reason: "expired", planName: result.planName ?? "PalNet" });
        }
      } catch {
        // silent — will retry on next tick
      }
    }

    checkStatus(); // immediate first check
    pollRef.current = setInterval(checkStatus, 3_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payState.step]);

  const deviceLabel = accountId
    ? `AccountID:${accountId}`.slice(0, 60)
    : (typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : null);

  async function handlePay() {
    if (!plan || phone.trim().length < 9) return;
    setPayState({ step: "idle" }); // reset before starting
    try {
      const result = await pay({
        data: {
          planId: plan.id,
          phone,
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          deviceLabel,
        },
      });

      if (!result.ok) {
        setPayState({ step: "error", reason: "failed", planName: plan.name });
        toast.error(result.message);
        return;
      }

      setPayState({
        step: "waiting_pin",
        reference: result.reference,
        phone,
        planName: plan.name,
      });
    } catch {
      setPayState({ step: "error", reason: "failed", planName: plan?.name ?? "PalNet" });
      toast.error("Could not start payment. Please try again.");
    }
  }

  async function handleRedeem() {
    setVoucherBusy(true);
    try {
      const result = await redeem({
        data: {
          code,
          phone: phone || null,
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          deviceLabel,
        },
      });
      if (result.ok) {
        toast.success(result.message);
        await queryClient.invalidateQueries();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Could not redeem that code. Please try again.");
    } finally {
      setVoucherBusy(false);
    }
  }

  function reset() {
    setPayState({ step: "idle" });
    setPhone("");
    setCode("");
  }

  // ── Render helpers ──────────────────────────────────────────────────────

  const planDesc = plan
    ? `${formatKes(plan.price_kes)} · ${planDurationLabel(plan)} · up to ${plan.speed_limit_mbps} Mbps`
    : null;

  if (payState.step === "connected") {
    const remaining = new Date(payState.endTime).getTime() - now;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xs text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Animated wifi icon */}
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden"
                style={{
                  background: "linear-gradient(135deg,rgba(0,243,255,0.02),rgba(0,243,255,0.01))",
                  border: "1px solid rgba(0,243,255,0.06)",
                  boxShadow: "0 0 20px rgba(0,243,255,0.12)",
                }}
              >
                <img src="/__l5e/assets-v1/d5f17890-e832-47f2-818f-8d165e2da0fb/palnet-logo.jpg" alt="PalNet" className="h-12 w-12 object-contain" />
              </div>

            <div>
              <p className="font-display text-base font-black text-foreground">
                Payment Successful!
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You are connected on <strong className="text-foreground">{payState.planName}</strong>
              </p>
            </div>

            {/* Countdown */}
            <div className="w-full rounded-xl border border-success/30 bg-success/5 p-3 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Time remaining</p>
              <p className="font-display text-3xl font-black tabular-nums text-gradient-brand">
                {remaining > 0 ? formatCountdown(remaining) : "00:00:00"}
              </p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(payState.endTime).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="size-3.5" />
              Connected to PalNet
            </div>

            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (payState.step === "error") {
    const msgs: Record<typeof payState.reason, { icon: typeof XCircle; title: string; body: string; color: string }> = {
      failed: {
        icon: XCircle,
        title: "Payment Failed",
        body: "The M-Pesa payment was declined or cancelled. Please check your balance and try again.",
        color: "text-destructive",
      },
      expired: {
        icon: Clock,
        title: "Request Expired",
        body: "The M-Pesa STK push expired (5 minutes). Please request a new payment.",
        color: "text-warning",
      },
      cancelled: {
        icon: AlertCircle,
        title: "Payment Cancelled",
        body: "You cancelled the M-Pesa prompt. Press try again to resend.",
        color: "text-warning",
      },
    };
    const m = msgs[payState.reason];
    const Icon = m.icon;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xs text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <Icon className={`size-12 ${m.color}`} />
            <div>
              <p className={`font-display text-base font-black ${m.color}`}>{m.title}</p>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
                {m.body}
              </p>
            </div>
            <Button className="font-display text-sm gap-2" onClick={reset}>
              <RefreshCw className="size-4" /> Try Again
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (payState.step === "waiting_pin" || payState.step === "verifying") {
    const isVerifying = payState.step === "verifying";
    return (
      <Dialog open={open} onOpenChange={(o) => {
        if (!o) setPayState({ step: "error", reason: "cancelled", planName: payState.planName });
        onOpenChange(o);
      }}>
        <DialogContent className="sm:max-w-xs text-center">
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Animated loader ring */}
            <div className="relative">
              <div
                className="h-16 w-16 rounded-full border-2 border-cyan-400/20 animate-spin"
                style={{ borderTopColor: "#00f3ff" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {isVerifying
                  ? <CheckCircle2 className="size-6 text-cyan-400" />
                  : <Smartphone className="size-6 text-cyan-400" />}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-display text-sm font-bold text-foreground">
                {isVerifying ? "Verifying Payment…" : "Check Your Phone"}
              </p>
              <p className="text-xs text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                {isVerifying
                  ? "Payment received. Setting up your session — this takes just a moment."
                  : `An M-Pesa prompt has been sent to ${payState.phone}. Enter your PIN to pay ${plan ? formatKes(plan.price_kes) : ""}.`}
              </p>
            </div>

            {/* Plan summary pill */}
            {plan && (
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground w-full justify-center">
                <Gauge className="size-3.5 text-accent shrink-0" />
                <span className="font-semibold text-foreground">{plan.name}</span>
                <span>·</span>
                <span>{formatKes(plan.price_kes)}</span>
                <span>·</span>
                <span>{plan.speed_limit_mbps} Mbps</span>
              </div>
            )}

            {!isVerifying && (
              <p className="text-xs text-muted-foreground">
                Didn't receive it?{" "}
                <button
                  className="text-accent underline underline-offset-2"
                  onClick={reset}
                >
                  Try again
                </button>
              </p>
            )}

            {/* Dots progress indicator */}
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-cyan-400/60 animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Idle — normal checkout form ─────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {plan ? plan.name : "PalNet Checkout"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {planDesc ?? "Pay with M-Pesa or redeem a scratch card — no account needed."}
            {accountId && <span className="ml-1 text-accent">· Account: {accountId}</span>}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mpesa">
          <TabsList className="w-full">
            <TabsTrigger value="mpesa" className="flex-1 gap-1.5 text-xs">
              <Smartphone className="size-3.5" /> M-Pesa
            </TabsTrigger>
            <TabsTrigger value="voucher" className="flex-1 gap-1.5 text-xs">
              <Ticket className="size-3.5" /> Scratch card
            </TabsTrigger>
          </TabsList>

          {/* ── M-Pesa ── */}
          <TabsContent value="mpesa" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-phone" className="text-xs">M-Pesa phone number</Label>
              <Input
                id="pay-phone"
                inputMode="tel"
                placeholder="0712 345 678"
                value={phone}
                maxLength={15}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handlePay()}
              />
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <Smartphone className="size-3.5 text-accent" />
                How M-Pesa payment works
              </p>
              <ol className="space-y-0.5 ml-5 list-decimal">
                <li>Enter your Safaricom number above</li>
                <li>A push notification appears on your phone</li>
                <li>Enter your M-Pesa PIN to confirm</li>
                <li>Your internet session activates instantly</li>
              </ol>
            </div>

            <Button
              className="w-full font-display text-sm"
              disabled={!plan || phone.trim().length < 9}
              onClick={handlePay}
            >
              {plan ? `Pay ${formatKes(plan.price_kes)} with M-Pesa` : "Send payment request"}
            </Button>
          </TabsContent>

          {/* ── Voucher ── */}
          <TabsContent value="voucher" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="voucher-code" className="text-xs">Scratch card code</Label>
              <Input
                id="voucher-code"
                placeholder="e.g. 4F9K2P"
                value={code}
                maxLength={20}
                className="h-9 font-display tracking-[0.3em] uppercase text-sm"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-phone" className="text-xs">
                Phone number <span className="text-muted-foreground">(optional — for SMS receipt)</span>
              </Label>
              <Input
                id="voucher-phone"
                inputMode="tel"
                placeholder="0712 345 678"
                value={phone}
                maxLength={15}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Scratch off the silver strip and enter the 6-character code.
            </p>
            <Button
              className="w-full font-display text-sm"
              variant="secondary"
              disabled={voucherBusy || code.trim().length < 4}
              onClick={handleRedeem}
            >
              {voucherBusy && <Loader2 className="animate-spin size-4" />}
              Redeem code
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
