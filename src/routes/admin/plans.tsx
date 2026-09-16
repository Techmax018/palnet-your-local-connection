import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { savePlan } from "@/lib/palnet.functions";
import { formatKes, planDurationLabel, type Plan, CATEGORY_LABELS } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/plans")({
  head: () => ({ meta: [{ title: "PalNet Admin — Plans" }] }),
  component: AdminPlans,
});

const EMPTY = {
  name: "", category: "hotspot" as const, duration_type: "hours" as const,
  duration_value: 1, speed_limit_mbps: 5, price_kes: 0, download_limit_mb: null as number | null, is_active: true,
};

function AdminPlans() {
  const queryClient = useQueryClient();
  const save = useServerFn(savePlan);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("internet_plans").select("*").order("category").order("price_kes");
      return (data ?? []) as Plan[];
    },
  });

  function openNew() { setEditing(null); setForm(EMPTY); setDialogOpen(true); }
  function openEdit(p: Plan) {
    setEditing(p);
    setForm({ name: p.name, category: p.category as typeof EMPTY.category, duration_type: p.duration_type as typeof EMPTY.duration_type, duration_value: p.duration_value, speed_limit_mbps: p.speed_limit_mbps, price_kes: p.price_kes, download_limit_mb: p.download_limit_mb, is_active: p.is_active });
    setDialogOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    try {
      const result = await save({ data: { ...form, id: editing?.id ?? null } });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { setDialogOpen(false); await queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); await queryClient.invalidateQueries({ queryKey: ["plans"] }); }
    } catch { toast.error("Failed to save plan"); }
    finally { setBusy(false); }
  }

  async function toggleActive(p: Plan) {
    const result = await save({ data: { id: p.id, name: p.name, category: p.category as typeof EMPTY.category, duration_type: p.duration_type as typeof EMPTY.duration_type, duration_value: p.duration_value, speed_limit_mbps: p.speed_limit_mbps, price_kes: p.price_kes, download_limit_mb: p.download_limit_mb, is_active: !p.is_active } });
    toast[result.ok ? "success" : "error"](result.message);
    await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["plans"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Internet Plans</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage hotspot, home internet & TV packages</p>
        </div>
        <Button size="sm" className="admin-btn-primary h-8 gap-1.5 text-xs" onClick={openNew}>
          <Plus className="size-3.5" /> New Plan
        </Button>
      </div>

      {(["hotspot", "home", "tv"] as const).map((cat) => {
        const catPlans = (plans ?? []).filter((p) => p.category === cat);
        if (!catPlans.length && !isLoading) return null;
        return (
          <div key={cat}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{CATEGORY_LABELS[cat]}</p>
            <div className="admin-card overflow-hidden">
              {isLoading ? (
                <div className="p-4 space-y-2">{[0,1].map((i) => <Skeleton key={i} className="h-10 admin-skeleton rounded" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Duration</th>
                        <th className="px-4 py-3 text-right font-medium">Price</th>
                        <th className="px-4 py-3 text-right font-medium">Speed</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {catPlans.map((p) => (
                        <tr key={p.id} className={`hover:bg-slate-800/30 transition-colors ${!p.is_active ? "opacity-40" : ""}`}>
                          <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                          <td className="px-4 py-3 text-slate-400">{planDurationLabel(p)}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatKes(p.price_kes)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{p.speed_limit_mbps} Mbps</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 hover:bg-slate-800" onClick={() => toggleActive(p)}>
                                {p.is_active ? <ToggleRight className="size-3.5 text-emerald-400" /> : <ToggleLeft className="size-3.5 text-slate-600" />}
                                <span className={p.is_active ? "text-emerald-400" : "text-slate-600"}>{p.is_active ? "Active" : "Off"}</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => openEdit(p)}>
                                <Pencil className="size-3" /> Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="admin-dialog sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-bold">{editing ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="admin-label">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="admin-input" placeholder="24-Hour Pass" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="admin-label">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}>
                  <SelectTrigger className="admin-input h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotspot">Hotspot</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="tv">TV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="admin-label">Duration type</Label>
                <Select value={form.duration_type} onValueChange={(v) => setForm((f) => ({ ...f, duration_type: v as typeof f.duration_type }))}>
                  <SelectTrigger className="admin-input h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="admin-label">Duration</Label>
                <Input type="number" min={1} value={form.duration_value} onChange={(e) => setForm((f) => ({ ...f, duration_value: Number(e.target.value) }))} className="admin-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="admin-label">Price (KES)</Label>
                <Input type="number" min={0} value={form.price_kes} onChange={(e) => setForm((f) => ({ ...f, price_kes: Number(e.target.value) }))} className="admin-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="admin-label">Speed (Mbps)</Label>
                <Input type="number" min={1} value={form.speed_limit_mbps} onChange={(e) => setForm((f) => ({ ...f, speed_limit_mbps: Number(e.target.value) }))} className="admin-input" />
              </div>
            </div>
            <Button className="admin-btn-primary w-full" disabled={busy || !form.name} onClick={handleSave}>
              {busy && <Loader2 className="animate-spin size-4" />}
              {editing ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
