import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Smartphone, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";
import { startGuestPayment, redeemGuestVoucher } from "@/lib/palnet.functions";
import { getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";

export function CheckoutDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const pay = useServerFn(startGuestPayment);
  const redeem = useServerFn(redeemGuestVoucher);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePay() {
    if (!plan) return;
    setBusy(true);
    try {
      const result = await pay({
        data: {
          planId: plan.id,
          phone,
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          deviceLabel: navigator?.userAgent?.slice(0, 60) ?? null,
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
      toast.error("Payment could not be started. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRedeem() {
    setBusy(true);
    try {
      const result = await redeem({
        data: {
          code,
          phone: phone || null,
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          deviceLabel: navigator?.userAgent?.slice(0, 60) ?? null,
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
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {plan ? plan.name : "PalNet Checkout"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {plan
              ? `${formatKes(plan.price_kes)} · ${planDurationLabel(plan)} · up to ${plan.speed_limit_mbps} Mbps`
              : "Pay with M-Pesa or redeem a scratch card — no account needed."}
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

          <TabsContent value="mpesa" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                M-Pesa phone number
              </Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="0712 345 678"
                value={phone}
                maxLength={15}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A push notification is sent to your Safaricom line. Enter your M-Pesa PIN to go
              online instantly. No account needed.
            </p>
            <Button
              className="w-full font-display text-sm"
              disabled={busy || !plan || phone.trim().length < 9}
              onClick={handlePay}
            >
              {busy && <Loader2 className="animate-spin" />}
              {plan ? `Pay ${formatKes(plan.price_kes)}` : "Send payment request"}
            </Button>
          </TabsContent>

          <TabsContent value="voucher" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs">
                Scratch card code
              </Label>
              <Input
                id="code"
                placeholder="e.g. 4F9K2P"
                value={code}
                maxLength={20}
                className="h-9 font-display tracking-[0.3em] uppercase text-sm"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher-phone" className="text-xs">
                Phone number (optional — for SMS receipt)
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
              disabled={busy || code.trim().length < 4}
              onClick={handleRedeem}
            >
              {busy && <Loader2 className="animate-spin" />}
              Redeem code
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
