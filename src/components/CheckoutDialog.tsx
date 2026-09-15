import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { payWithMpesa, redeemVoucher } from "@/lib/palnet.functions";
import { useSession } from "@/hooks/usePalNet";

export function CheckoutDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pay = useServerFn(payWithMpesa);
  const redeem = useServerFn(redeemVoucher);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePay() {
    if (!plan) return;
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      const result = await pay({ data: { planId: plan.id, phone } });
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
    if (!user) {
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      const result = await redeem({ data: { code } });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {plan ? plan.name : "PalNet Checkout"}
          </DialogTitle>
          <DialogDescription>
            {plan
              ? `${formatKes(plan.price_kes)} · ${planDurationLabel(plan)} · up to ${plan.speed_limit_mbps} Mbps`
              : "Pay with M-Pesa or redeem a scratch card."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mpesa">
          <TabsList className="w-full">
            <TabsTrigger value="mpesa" className="flex-1">
              <Smartphone className="size-4" /> M-Pesa
            </TabsTrigger>
            <TabsTrigger value="voucher" className="flex-1">
              <Ticket className="size-4" /> Scratch card
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mpesa" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">M-Pesa phone number</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="0712345678"
                value={phone}
                maxLength={15}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A payment request is sent to your phone. Enter your M-Pesa PIN to go online instantly.
            </p>
            <Button className="w-full font-display" disabled={busy || !plan} onClick={handlePay}>
              {busy && <Loader2 className="animate-spin" />}
              Send payment request
            </Button>
          </TabsContent>

          <TabsContent value="voucher" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="code">Scratch card code</Label>
              <Input
                id="code"
                placeholder="e.g. 4F9K2P"
                value={code}
                maxLength={20}
                className="font-display tracking-[0.3em] uppercase"
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Scratch off the card and enter the 6-character code printed on it.
            </p>
            <Button
              className="w-full font-display"
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
