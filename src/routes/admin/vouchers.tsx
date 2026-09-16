import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateVouchers } from "@/lib/palnet.functions";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/vouchers")({
  head: () => ({ meta: [{ title: "PalNet Admin — Vouchers" }] }),
  component: AdminVouchers,
});

function AdminVouchers() {
  const { data: plans } = useQuery({
    queryKey: ["admin-plans-simple"],
    queryFn: async () => {
      const { data } = await supabase
        .from("internet_plans")
        .select("id, name, category, duration_type, duration_value, price_kes")
        .eq("is_active", true)
        .order("price_kes");
      return (data ?? []) as Plan[];
    },
  });

  const queryClient = useQueryClient();
  const generate = useServerFn(generateVouchers);
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<string[]>([]);

  const selectedPlan = plans?.find((p) => p.id === planId);

  async function handleGenerate() {
    if (!planId) return;
    setBusy(true);
    try {
      const result = await generate({ data: { planId, quantity } });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) {
        setBatch(result.codes);
        await queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] });
      }
    } catch {
      toast.error("Failed to generate vouchers");
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  // Recent vouchers
  const { data: recent } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vouchers")
        .select("id, code, status, created_at, internet_plans(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">Voucher Generator</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Generate printable scratch-card batches</p>
      </div>

      {/* Generator form */}
      <Card className="surface-panel p-4 gap-0 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select a plan…" />
              </SelectTrigger>
              <SelectContent>
                {(plans ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name} — {formatKes(p.price_kes)} · {planDurationLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quantity (max 200)</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(200, Math.max(1, Number(e.target.value))))}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {selectedPlan && (
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-xs text-muted-foreground">
            Generating <strong className="text-foreground">{quantity}</strong> codes for{" "}
            <strong className="text-foreground">{selectedPlan.name}</strong> —{" "}
            {formatKes(selectedPlan.price_kes)} each ·{" "}
            Total face value:{" "}
            <strong className="text-success">{formatKes(quantity * selectedPlan.price_kes)}</strong>
          </div>
        )}

        <Button
          className="font-display text-sm gap-2"
          disabled={busy || !planId}
          onClick={handleGenerate}
        >
          {busy ? <Loader2 className="animate-spin size-4" /> : <Ticket className="size-4" />}
          Generate {quantity} Scratch Cards
        </Button>
      </Card>

      {/* Print batch */}
      {batch.length > 0 && (
        <Card className="surface-panel p-4 gap-0 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              {batch.length} codes generated for{" "}
              <span className="text-accent">{selectedPlan?.name}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handlePrint}
            >
              <Printer className="size-3.5" /> Print
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 print:grid-cols-4">
            {batch.map((code) => (
              <div
                key={code}
                className="flex flex-col items-center rounded-lg border border-border/70 bg-background/50 p-2 print:border-gray-400"
              >
                <p className="text-xs text-muted-foreground">PalNet</p>
                <p className="font-display text-sm font-black tracking-[0.2em] text-foreground">
                  {code}
                </p>
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatKes(selectedPlan.price_kes)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent vouchers table */}
      <div>
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
          Recent Vouchers
        </h2>
        <Card className="surface-panel p-0 overflow-hidden gap-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Code</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(recent ?? []).map((v: any) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-display tracking-[0.2em] font-bold">{v.code}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{v.internet_plans?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.status === "unused"
                          ? "bg-success/20 text-success"
                          : v.status === "active"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString("en-KE")}
                    </td>
                  </tr>
                ))}
                {!recent?.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No vouchers generated yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
