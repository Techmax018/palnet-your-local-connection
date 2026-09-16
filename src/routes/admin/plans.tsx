import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { savePlan } from "@/lib/palnet.functions";
import { formatKes, planDurationLabel, type Plan, CATEGORY_LABELS } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/plans")({
  head: () => ({ meta: [{ title: "PalNet Admin — Plans" }] }),
  component: AdminPlans,
});

const EMPTY_PLAN = {
  name: "",
  category: "hotspot" as const,
  duration_type: "hours" as const,
  duration_value: 1,
  speed_limit_mbps: 5,
  price_kes: 0,
  download_limit_mb: null as number | null,
  is_active: true,
};

function AdminPlans() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("internet_plans")
        .select("*")
        .order("category")
        .order("price_kes");
      return (data ?? []) as Plan[];
    },
  });
  const queryClient = useQueryClient();
  const save = useServerFn(savePlan);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_PLAN);
    setDialogOpen(true);
  }

  function openEdit(p: Plan) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category as "hotspot" | "home" | "tv",
      duration_type: p.duration_type as "minutes" | "hours" | "days",
      duration_value: p.duration_value,
      speed_limit_mbps: p.speed_limit_mbps,
      price_kes: p.price_kes,
      download_limit_mb: p.download_limit_mb,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setBusy(true);
    try {
      const result = await save({
        data: { ...form, id: editing?.id ?? null },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) {
        setDialogOpen(false);
        await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
        await queryClient.invalidateQueries({ queryKey: ["plans"] });
      }
    } catch {
      toast.error("Failed to save plan");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Plan) {
    const result = await save({
      data: {
        id: p.id,
        name: p.name,
        category: p.category as "hotspot" | "home" | "tv",
        duration_type: p.duration_type as "minutes" | "hours" | "days",
        duration_value: p.duration_value,
        speed_limit_mbps: p.speed_limit_mbps,
        price_kes: p.price_kes,
        download_limit_mb: p.download_limit_mb,
        is_active: !p.is_active,
      },
    });
    toast[result.ok ? "success" : "error"](result.message);
    await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["plans"] });
  }

  const categories = ["hotspot", "home", "tv"] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Plans</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage internet & TV packages</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs font-display" onClick={openNew}>
          <Plus className="size-3.5" /> New Plan
        </Button>
      </div>

      {categories.map((cat) => {
        const catPlans = (plans ?? []).filter((p) => p.category === cat);
        if (!catPlans.length && !isLoading) return null;
        return (
          <div key={cat}>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {CATEGORY_LABELS[cat]}
            </h2>
            <Card className="surface-panel p-0 overflow-hidden gap-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/70 text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium">Name</th>
                        <th className="px-4 py-2.5 text-left font-medium">Duration</th>
                        <th className="px-4 py-2.5 text-right font-medium">Price</th>
                        <th className="px-4 py-2.5 text-right font-medium">Speed</th>
                        <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {catPlans.map((p) => (
                        <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${!p.is_active ? "opacity-50" : ""}`}>
                          <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{planDurationLabel(p)}</td>
                          <td className="px-4 py-2.5 text-right font-display text-success">{formatKes(p.price_kes)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{p.speed_limit_mbps} Mbps</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 px-2"
                                onClick={() => toggleActive(p)}
                              >
                                {p.is_active
                                  ? <ToggleRight className="size-3.5 text-success" />
                                  : <ToggleLeft className="size-3.5 text-muted-foreground" />}
                                {p.is_active ? "Active" : "Off"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1 px-2"
                                onClick={() => openEdit(p)}
                              >
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
            </Card>
          </div>
        );
      })}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-sm">
              {editing ? "Edit Plan" : "New Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9 text-sm" placeholder="24-Hour Pass" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as typeof form.category }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotspot">Hotspot</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="tv">TV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duration type</Label>
                <Select value={form.duration_type} onValueChange={(v) => setForm((f) => ({ ...f, duration_type: v as typeof form.duration_type }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
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
                <Label className="text-xs">Duration</Label>
                <Input type="number" min={1} value={form.duration_value} onChange={(e) => setForm((f) => ({ ...f, duration_value: Number(e.target.value) }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Price (KES)</Label>
                <Input type="number" min={0} value={form.price_kes} onChange={(e) => setForm((f) => ({ ...f, price_kes: Number(e.target.value) }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Speed (Mbps)</Label>
                <Input type="number" min={1} value={form.speed_limit_mbps} onChange={(e) => setForm((f) => ({ ...f, speed_limit_mbps: Number(e.target.value) }))} className="h-9 text-sm" />
              </div>
            </div>
            <Button className="w-full font-display text-sm" disabled={busy || !form.name} onClick={handleSave}>
              {busy && <Loader2 className="animate-spin size-4" />}
              {editing ? "Save Changes" : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
