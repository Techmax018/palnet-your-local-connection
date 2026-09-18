import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Clock, Gauge, LayoutGrid, List, Loader2,
  Pencil, Plus, Search, Ticket, ToggleLeft, ToggleRight,
  Trash2, Wifi, Tv, Home, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { savePlan, deletePlan } from "@/lib/palnet.functions";
import { formatKes, planDurationLabel, type Plan } from "@/lib/palnet";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({ meta: [{ title: "PalNet Admin — Internet Plans" }] }),
  component: AdminPlans,
});

/* ─── constants ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "all",     label: "All Plans", icon: Ticket },
  { value: "hotspot", label: "Hotspot",   icon: Wifi   },
  { value: "home",    label: "Home",      icon: Home   },
  { value: "tv",      label: "TV",        icon: Tv     },
] as const;

type CatFilter = "all" | "hotspot" | "home" | "tv";
type ViewMode  = "table" | "grid";

const CAT_ACCENT: Record<string, string> = {
  hotspot: "linear-gradient(90deg,#0891b2,#06b6d4)",
  home:    "linear-gradient(90deg,#1d4ed8,#3b82f6)",
  tv:      "linear-gradient(90deg,#7c3aed,#a855f7)",
};

const CAT_CHIP: Record<string, string> = {
  hotspot: "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/20",
  home:    "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20",
  tv:      "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20",
};

const EMPTY_FORM = {
  name:             "",
  category:         "hotspot" as "hotspot" | "home" | "tv",
  duration_type:    "hours"   as "minutes" | "hours" | "days",
  duration_value:   1,
  speed_limit_mbps: 5,
  price_kes:        0,
  download_limit_mb: null as number | null,
  is_active:        true,
};

/* ─── Plan Form Modal ───────────────────────────────────────────────────── */
function PlanFormModal({
  open, onClose, editing, onSaved, defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  editing: Plan | null;
  onSaved: () => void;
  defaultCategory?: CatFilter;
}) {
  const save = useServerFn(savePlan);

  const buildForm = (p: Plan | null) =>
    p ? {
      name:             p.name,
      category:         p.category as typeof EMPTY_FORM.category,
      duration_type:    p.duration_type as typeof EMPTY_FORM.duration_type,
      duration_value:   p.duration_value,
      speed_limit_mbps: p.speed_limit_mbps,
      price_kes:        p.price_kes,
      download_limit_mb: p.download_limit_mb,
      is_active:        p.is_active,
    } : {
      ...EMPTY_FORM,
      category: (defaultCategory && defaultCategory !== "all"
        ? defaultCategory
        : "hotspot") as typeof EMPTY_FORM.category,
    };

  const [form, setForm] = useState(() => buildForm(editing));
  const [busy, setBusy] = useState(false);

  // reset form when editing target changes
  const [lastId, setLastId] = useState<string | null>(null);
  if ((editing?.id ?? null) !== lastId) {
    setLastId(editing?.id ?? null);
    setForm(buildForm(editing));
  }

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: typeof EMPTY_FORM[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Plan name is required."); return; }
    if (form.price_kes < 0) { toast.error("Price cannot be negative."); return; }
    setBusy(true);
    try {
      const r = await save({ data: { ...form, id: editing?.id ?? null } });
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) { onSaved(); onClose(); }
    } catch { toast.error("Failed to save plan"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="admin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-white">
            {editing ? "Edit Plan" : "Create New Plan"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editing
              ? "Changes apply to new purchases immediately."
              : "Add a hotspot pass, home bundle, or TV streaming plan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="admin-label">Plan Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="admin-input"
              placeholder="e.g. 24-Hour Hotspot Pass"
            />
          </div>

          {/* Category + Duration type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="admin-label">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v as typeof form.category)}
              >
                <SelectTrigger className="admin-input h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotspot">📶 Hotspot</SelectItem>
                  <SelectItem value="home">🏠 Home</SelectItem>
                  <SelectItem value="tv">📺 TV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">Duration Unit</Label>
              <Select
                value={form.duration_type}
                onValueChange={(v) => set("duration_type", v as typeof form.duration_type)}
              >
                <SelectTrigger className="admin-input h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration + Price + Speed */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="admin-label">Duration</Label>
              <Input
                type="number" min={1} value={form.duration_value}
                onChange={(e) => set("duration_value", Number(e.target.value))}
                className="admin-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">Price (KES)</Label>
              <Input
                type="number" min={0} value={form.price_kes}
                onChange={(e) => set("price_kes", Number(e.target.value))}
                className="admin-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">Speed (Mbps)</Label>
              <Input
                type="number" min={1} value={form.speed_limit_mbps}
                onChange={(e) => set("speed_limit_mbps", Number(e.target.value))}
                className="admin-input"
              />
            </div>
          </div>

          {/* Data cap */}
          <div className="space-y-1.5">
            <Label className="admin-label">
              Data Cap (MB){" "}
              <span className="text-slate-600">— leave blank for unlimited</span>
            </Label>
            <Input
              type="number" min={0}
              value={form.download_limit_mb ?? ""}
              onChange={(e) =>
                set("download_limit_mb", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Unlimited"
              className="admin-input"
            />
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 space-y-0.5">
            <p className="text-xs font-semibold text-slate-400 mb-1">Preview</p>
            <p className="text-xs">
              <span className="font-bold text-white">{form.name || "—"}</span>
              <span className="text-slate-500"> · </span>
              <span className="font-bold text-emerald-400">{formatKes(form.price_kes)}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300">
                {planDurationLabel({
                  duration_type: form.duration_type,
                  duration_value: form.duration_value,
                })}
              </span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300">{form.speed_limit_mbps} Mbps</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-300">
                {form.download_limit_mb ? `${form.download_limit_mb} MB cap` : "Unlimited"}
              </span>
            </p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-white">Active</p>
              <p className="text-xs text-slate-500">
                Visible to customers and available for purchase
              </p>
            </div>
            <button onClick={() => set("is_active", !form.is_active)}>
              {form.is_active
                ? <ToggleRight className="size-7 text-emerald-400" />
                : <ToggleLeft className="size-7 text-slate-600" />}
            </button>
          </div>

          <Button
            className="admin-btn-primary w-full"
            disabled={busy || !form.name.trim()}
            onClick={handleSave}
          >
            {busy && <Loader2 className="animate-spin size-4" />}
            {editing ? "Save Changes" : "Create Plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete Confirm Dialog ─────────────────────────────────────────────── */
function DeleteConfirmDialog({
  plan, open, onClose, onDeleted,
}: {
  plan: Plan | null; open: boolean; onClose: () => void; onDeleted: () => void;
}) {
  const remove = useServerFn(deletePlan);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await remove({ data: { id: plan.id } });
      toast[r.ok ? "success" : "error"](r.message);
      if (r.ok) { onDeleted(); onClose(); }
    } catch { toast.error("Failed to delete plan"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="admin-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-white">
            <AlertTriangle className="size-4 text-red-400" /> Delete Plan
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-sm font-semibold text-white">{plan?.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {plan ? formatKes(plan.price_kes) : ""} ·{" "}
              {plan ? planDurationLabel(plan) : ""} · {plan?.category}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Active subscriptions on this plan are not affected, but no new purchases will be
            possible after deletion.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="admin-btn-outline flex-1" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:text-red-300"
              disabled={busy} onClick={handleDelete}
            >
              {busy ? <Loader2 className="animate-spin size-4" /> : <Trash2 className="size-4" />}
              Delete Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Plan Card (grid view) ─────────────────────────────────────────────── */
function PlanCard({
  plan, onEdit, onDelete, onToggle,
}: {
  plan: Plan; onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  return (
    <div
      className={`admin-card relative overflow-hidden p-4 space-y-3 transition-opacity ${
        !plan.is_active ? "opacity-45" : ""
      }`}
    >
      {/* Category colour bar */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: CAT_ACCENT[plan.category] ?? "#4b5563" }}
      />

      {/* Category chip + toggle */}
      <div className="flex items-center justify-between pt-0.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
          CAT_CHIP[plan.category] ?? "bg-slate-700 text-slate-300"
        }`}>
          {plan.category}
        </span>
        <button
          onClick={onToggle}
          title={plan.is_active ? "Deactivate" : "Activate"}
          className="transition-opacity hover:opacity-80"
        >
          {plan.is_active
            ? <ToggleRight className="size-5 text-emerald-400" />
            : <ToggleLeft  className="size-5 text-slate-600" />}
        </button>
      </div>

      {/* Name */}
      <p className="text-sm font-bold leading-snug text-white line-clamp-2">{plan.name}</p>

      {/* Price */}
      <p
        className="text-2xl font-black tracking-tight"
        style={{ color: "#00f3ff", textShadow: "0 0 20px rgba(0,243,255,0.35)" }}
      >
        {formatKes(plan.price_kes)}
      </p>

      {/* Meta */}
      <div className="space-y-1 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3 shrink-0" />
          {planDurationLabel(plan)}
        </div>
        <div className="flex items-center gap-1.5">
          <Gauge className="size-3 shrink-0" />
          {plan.speed_limit_mbps} Mbps{" "}
          {plan.download_limit_mb
            ? `· ${plan.download_limit_mb.toLocaleString()} MB`
            : "· Unlimited"}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-slate-800/60 pt-2">
        <Button
          variant="ghost" size="sm"
          className="flex-1 h-7 gap-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={onEdit}
        >
          <Pencil className="size-3" /> Edit
        </Button>
        <Button
          variant="ghost" size="sm"
          className="flex-1 h-7 gap-1 text-xs text-red-500/60 hover:bg-red-500/10 hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="size-3" /> Delete
        </Button>
      </div>
    </div>
  );
}

/* ─── Add-new placeholder card ──────────────────────────────────────────── */
function AddNewCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="admin-card flex flex-col items-center justify-center gap-3 p-6 text-center
                 border-dashed border-slate-700 hover:border-cyan-500/40 hover:bg-cyan-500/5
                 transition-all duration-200 min-h-[13rem] group"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700
                    group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 transition-all"
      >
        <Plus className="size-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 group-hover:text-white transition-colors">
          Add New Plan
        </p>
        <p className="mt-0.5 text-xs text-slate-700">Click to create a package</p>
      </div>
    </button>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
function AdminPlans() {
  const queryClient = useQueryClient();
  const save = useServerFn(savePlan);

  const [formModal, setFormModal]   = useState<{ open: boolean; editing: Plan | null }>({ open: false, editing: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [catFilter, setCatFilter]   = useState<CatFilter>("all");
  const [search, setSearch]         = useState("");
  const [view, setView]             = useState<ViewMode>("table");

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

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    await queryClient.invalidateQueries({ queryKey: ["plans"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-plans-simple"] });
  };

  async function toggleActive(p: Plan) {
    const r = await save({
      data: {
        id: p.id, name: p.name,
        category: p.category as typeof EMPTY_FORM.category,
        duration_type: p.duration_type as typeof EMPTY_FORM.duration_type,
        duration_value: p.duration_value, speed_limit_mbps: p.speed_limit_mbps,
        price_kes: p.price_kes, download_limit_mb: p.download_limit_mb,
        is_active: !p.is_active,
      },
    });
    toast[r.ok ? "success" : "error"](r.message);
    await invalidate();
  }

  const filtered = useMemo(() => {
    let list = plans ?? [];
    if (catFilter !== "all") list = list.filter((p) => p.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || String(p.price_kes).includes(q),
      );
    }
    return list;
  }, [plans, catFilter, search]);

  const counts = useMemo(() => {
    const all = plans ?? [];
    return {
      all:     all.length,
      hotspot: all.filter((p) => p.category === "hotspot").length,
      home:    all.filter((p) => p.category === "home").length,
      tv:      all.filter((p) => p.category === "tv").length,
    };
  }, [plans]);

  const openNew  = () => setFormModal({ open: true, editing: null });
  const openEdit = (p: Plan) => setFormModal({ open: true, editing: p });
  const openDel  = (p: Plan) => setDeleteModal({ open: true, plan: p });

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-white">Internet Plans</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {plans?.length ?? 0} packages total ·{" "}
            {plans?.filter((p) => p.is_active).length ?? 0} active
          </p>
        </div>
        <Button
          size="sm"
          className="admin-btn-primary h-8 gap-1.5 text-xs"
          onClick={openNew}
        >
          <Plus className="size-3.5" /> New Plan
        </Button>
      </div>

      {/* ── Toolbar: category filter + search + view toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-[#0d1117] p-1">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setCatFilter(value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                catFilter === value ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              style={catFilter === value ? {
                background: "linear-gradient(135deg,rgba(0,243,255,0.15),rgba(0,243,255,0.05))",
                border: "1px solid rgba(0,243,255,0.2)",
              } : undefined}
            >
              <Icon className="size-3.5" />
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  catFilter === value
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-40 flex-1 max-w-56">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans…"
            className="admin-input h-8 pl-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-slate-800 bg-[#0d1117] p-0.5">
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all ${
              view === "table"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Table view"
          >
            <List className="size-3.5" /> Table
          </button>
          <button
            onClick={() => setView("grid")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all ${
              view === "grid"
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Grid view"
          >
            <LayoutGrid className="size-3.5" /> Cards
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TABLE VIEW
      ══════════════════════════════════════════════════════ */}
      {view === "table" && (
        <div className="admin-card overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 admin-skeleton rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Ticket className="size-10 text-slate-700" />
              <p className="text-sm font-semibold text-slate-500">
                {search || catFilter !== "all" ? "No plans match your filter" : "No plans yet"}
              </p>
              {!search && catFilter === "all" && (
                <Button size="sm" className="admin-btn-primary gap-1.5 text-xs" onClick={openNew}>
                  <Plus className="size-3.5" /> Create your first plan
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Plan Name</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                    <th className="px-4 py-3 text-right font-medium">Price (KES)</th>
                    <th className="px-4 py-3 text-right font-medium">Speed</th>
                    <th className="px-4 py-3 text-left font-medium">Data Cap</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        !p.is_active ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Category colour dot */}
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: CAT_ACCENT[p.category]?.split(",")[1]?.trim() ?? "#4b5563" }}
                          />
                          <span className="font-semibold text-white">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                          CAT_CHIP[p.category] ?? "bg-slate-700 text-slate-300"
                        }`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{planDurationLabel(p)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">
                        {formatKes(p.price_kes)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {p.speed_limit_mbps} Mbps
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {p.download_limit_mb
                          ? `${p.download_limit_mb.toLocaleString()} MB`
                          : "Unlimited"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(p)}
                          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                        >
                          {p.is_active ? (
                            <>
                              <ToggleRight className="size-4 text-emerald-400" />
                              <span className="text-emerald-400">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="size-4 text-slate-600" />
                              <span className="text-slate-600">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 gap-1 px-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="size-3" /> Edit
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 gap-1 px-2 text-xs text-red-500/60 hover:bg-red-500/10 hover:text-red-400"
                            onClick={() => openDel(p)}
                          >
                            <Trash2 className="size-3" /> Delete
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
      )}

      {/* ══════════════════════════════════════════════════════
          GRID / CARD VIEW — grouped by category, "Add New" card last
      ══════════════════════════════════════════════════════ */}
      {view === "grid" && (
        isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl admin-skeleton" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {(catFilter === "all"
              ? (["hotspot", "home", "tv"] as const)
              : [catFilter]
            ).map((cat) => {
              const catPlans = filtered.filter((p) => p.category === cat);
              const showAddCard = catFilter !== "all" || catPlans.length === 0;

              // Always show the section header when showing all, skip empty categories (except to show add card)
              if (catPlans.length === 0 && catFilter === "all") return null;

              const CatIcon = CATEGORIES.find((c) => c.value === cat)!.icon;

              return (
                <div key={cat}>
                  {/* Section label */}
                  <div className="mb-3 flex items-center gap-2">
                    <CatIcon className="size-3.5 text-slate-500" />
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      {cat === "hotspot"
                        ? "Hotspot Passes"
                        : cat === "home"
                        ? "Home Internet"
                        : "TV & Streaming"}
                    </p>
                    <span className="text-xs text-slate-700">({catPlans.length})</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {catPlans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        onEdit={() => openEdit(p)}
                        onDelete={() => openDel(p)}
                        onToggle={() => toggleActive(p)}
                      />
                    ))}
                    {/* Add-new placeholder card always at the end of each category */}
                    <AddNewCard
                      onClick={() =>
                        setFormModal({
                          open: true,
                          editing: null,
                          // pass the category so the form pre-selects it
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}

            {/* "All" mode with no results */}
            {catFilter === "all" && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Ticket className="size-10 text-slate-700" />
                <p className="text-sm font-semibold text-slate-500">No plans yet</p>
                <Button size="sm" className="admin-btn-primary gap-1.5 text-xs" onClick={openNew}>
                  <Plus className="size-3.5" /> Create your first plan
                </Button>
              </div>
            )}
          </div>
        )
      )}

      {/* ── Modals ── */}
      <PlanFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, editing: null })}
        editing={formModal.editing}
        onSaved={invalidate}
        defaultCategory={catFilter}
      />
      <DeleteConfirmDialog
        open={deleteModal.open}
        plan={deleteModal.plan}
        onClose={() => setDeleteModal({ open: false, plan: null })}
        onDeleted={invalidate}
      />
    </div>
  );
}
