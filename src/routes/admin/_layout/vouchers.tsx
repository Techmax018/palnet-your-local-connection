import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateVouchers, deleteVoucher } from "@/lib/palnet.functions";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/vouchers")({
  head: () => ({ meta: [{ title: "PalNet Admin — Vouchers" }] }),
  component: AdminVouchers,
});

function AdminVouchers() {
  const queryClient = useQueryClient();
  const generate = useServerFn(generateVouchers);
  const delFn = useServerFn(deleteVoucher);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<string[]>([]);

  const { data: plans } = useQuery({
    queryKey: ["admin-plans-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("internet_plans").select("id, name, category, duration_type, duration_value, price_kes").eq("is_active", true).order("price_kes");
      return (data ?? []) as Plan[];
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data } = await supabase.from("vouchers").select("id, code, status, created_at, internet_plans(name)").order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });

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
    } catch { toast.error("Failed to generate vouchers"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Voucher Generator</h1>
        <p className="text-xs text-slate-500 mt-0.5">Generate printable scratch-card batches for any plan</p>
      </div>

      {/* Generator */}
      <div className="admin-card p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="admin-label">Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="admin-input h-9 text-xs"><SelectValue placeholder="Select a plan…" /></SelectTrigger>
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
            <Label className="admin-label">Quantity (max 200)</Label>
            <Input type="number" min={1} max={200} value={quantity} onChange={(e) => setQuantity(Math.min(200, Math.max(1, Number(e.target.value))))} className="admin-input" />
          </div>
        </div>

        {selectedPlan && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-xs text-slate-400">
            Generating <strong className="text-white">{quantity}</strong> codes for{" "}
            <strong className="text-cyan-400">{selectedPlan.name}</strong> — {formatKes(selectedPlan.price_kes)} each ·{" "}
            Total face value: <strong className="text-emerald-400">{formatKes(quantity * selectedPlan.price_kes)}</strong>
          </div>
        )}

        <Button className="admin-btn-primary gap-2" disabled={busy || !planId} onClick={handleGenerate}>
          {busy ? <Loader2 className="animate-spin size-4" /> : <Ticket className="size-4" />}
          Generate {quantity} Scratch Cards
        </Button>
      </div>

      {/* Print batch */}
      {batch.length > 0 && (
        <div className="admin-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              {batch.length} codes · <span className="text-cyan-400">{selectedPlan?.name}</span>
            </p>
            <Button variant="outline" size="sm" className="admin-btn-outline gap-1.5 text-xs h-8" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print All
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 print:grid-cols-4">
            {batch.map((code) => (
                <div key={code} className="flex flex-col items-center rounded-lg border border-slate-700/60 bg-slate-900/80 p-2.5 print:border-gray-300">
                  <div className="w-full flex items-start justify-end">
                    <button className="text-red-400 hover:text-red-300 text-xs" disabled={busyDelete === code} onClick={async () => {
                      if (!confirm(`Delete voucher ${code}? This cannot be undone.`)) return;
                      setBusyDelete(code);
                      try {
                        const res = await delFn({ data: { code } });
                        toast[res.ok ? "success" : "error"](res.message);
                        if (res.ok) setBatch((b) => b.filter((c) => c !== code));
                        await queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] });
                      } catch { toast.error("Failed to delete voucher"); }
                      finally { setBusyDelete(null); }
                    }}>Delete</button>
                  </div>
                  <p className="text-xs text-slate-500 mb-0.5">PalNet</p>
                  <p className="font-mono text-sm font-bold tracking-[0.25em] text-white">{code}</p>
                  {selectedPlan && <p className="text-xs text-emerald-400 mt-0.5">{formatKes(selectedPlan.price_kes)}</p>}
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent vouchers */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Recent Vouchers</p>
        <div className="admin-card overflow-hidden">
          {!recent ? (
            <div className="p-4 space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(recent ?? []).map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold tracking-[0.25em] text-white">{v.code}</td>
                          <td className="px-4 py-3 text-slate-400">{v.internet_plans?.name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              v.status === "unused" ? "bg-emerald-500/15 text-emerald-400" :
                              v.status === "active" ? "bg-cyan-500/15 text-cyan-400" :
                              "bg-slate-700 text-slate-400"
                            }`}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{new Date(v.created_at).toLocaleDateString("en-KE")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={busyDelete === v.id} onClick={async () => {
                                if (!confirm(`Delete voucher ${v.code}? This cannot be undone.`)) return;
                                setBusyDelete(v.id);
                                try {
                                  const res = await delFn({ data: { id: v.id } });
                                  toast[res.ok ? "success" : "error"](res.message);
                                  if (res.ok) await queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] });
                                } catch { toast.error("Failed to delete voucher"); }
                                finally { setBusyDelete(null); }
                              }}>
                                <Trash2 className="size-3" /> Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                  ))}
                  {!recent?.length && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">No vouchers generated yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
