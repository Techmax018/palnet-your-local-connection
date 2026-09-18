import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, RefreshCw, Pencil, Circle, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { saveRouter, testRouterConnection } from "@/lib/palnet.functions";

export const Route = createFileRoute("/admin/routers")({
  head: () => ({ meta: [{ title: "PalNet Admin — Routers" }] }),
  component: AdminRouters,
});

type Router = {
  id: string; name: string; ip_address: string; api_port: number;
  location: string | null; status: string; last_ping: string | null;
};

const EMPTY = { name: "", ip_address: "", api_port: 8728, location: "" };

function AdminRouters() {
  const queryClient = useQueryClient();
  const save = useServerFn(saveRouter);
  const pingFn = useServerFn(testRouterConnection);
  const [editing, setEditing] = useState<Router | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: routers, isLoading } = useQuery({
    queryKey: ["admin-routers"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.from("routers").select("*").order("name");
      return (data ?? []) as Router[];
    },
  });

  function openNew() {
    setEditing(null); setForm(EMPTY); setDialogOpen(true);
  }
  function openEdit(r: Router) {
    setEditing(r);
    setForm({ name: r.name, ip_address: r.ip_address, api_port: r.api_port, location: r.location ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    setBusy("save");
    try {
      const result = await save({ data: { id: editing?.id ?? null, name: form.name, ip_address: form.ip_address, api_port: Number(form.api_port), location: form.location || null } });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) { setDialogOpen(false); await queryClient.invalidateQueries({ queryKey: ["admin-routers"] }); }
    } catch { toast.error("Failed to save router"); }
    finally { setBusy(null); }
  }

  async function handlePing(routerId: string) {
    setBusy(routerId);
    try {
      const result = await pingFn({ data: { routerId } });
      toast[result.ok && result.online ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-routers"] });
    } catch { toast.error("Ping failed"); }
    finally { setBusy(null); }
  }

  const online = (routers ?? []).filter((r) => r.status === "online").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Routers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {online} online / {(routers ?? []).length} total · MikroTik / OpenWrt nodes
          </p>
        </div>
        <Button size="sm" className="admin-btn-primary h-8 gap-1.5 text-xs" onClick={openNew}>
          <Plus className="size-3.5" /> Add Router
        </Button>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-12 admin-skeleton rounded-lg" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">IP : Port</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last Ping</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {routers?.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{r.ip_address}:{r.api_port}</td>
                    <td className="px-4 py-3 text-slate-400">{r.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.status === "online"
                          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                          : "bg-red-500/15 text-red-400 ring-1 ring-red-500/20"
                      }`}>
                        <Circle className={`size-1.5 ${r.status === "online" ? "fill-emerald-400" : "fill-red-400"}`} />
                        {r.status === "online" ? "Online" : "Offline"}
                        {r.status === "offline" && r.last_ping && (
                          <span className="text-red-500/60 ml-0.5">
                            · Last ping {Math.round((Date.now() - new Date(r.last_ping).getTime()) / 60000)}m ago
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {r.last_ping
                        ? new Date(r.last_ping).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs" disabled={busy === r.id} onClick={() => handlePing(r.id)}>
                          {busy === r.id ? <Loader2 className="size-3 animate-spin" /> : <Activity className="size-3" />}
                          Ping
                        </Button>
                        <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs">
                          <Activity className="size-3" /> Logs
                        </Button>
                        <Button variant="outline" size="sm" className="admin-btn-outline h-7 gap-1 text-xs" onClick={() => openEdit(r)}>
                          <Pencil className="size-3" /> Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!routers?.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No routers added yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="admin-dialog sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-bold">
              {editing ? "Edit Router" : "Add Router Node"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="admin-label">Router Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="admin-input" placeholder="PalNet-Core-01" />
            </div>
            <div className="space-y-1.5">
              <Label className="admin-label">IP Address</Label>
              <Input value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} className="admin-input" placeholder="192.168.88.1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="admin-label">API Port</Label>
                <Input type="number" value={form.api_port} onChange={(e) => setForm((f) => ({ ...f, api_port: Number(e.target.value) }))} className="admin-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="admin-label">Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="admin-input" placeholder="Rooftop Mast" />
              </div>
            </div>
            <Button className="admin-btn-primary w-full" disabled={busy === "save" || !form.name || !form.ip_address} onClick={handleSave}>
              {busy === "save" && <Loader2 className="animate-spin size-4" />}
              {editing ? "Save Changes" : "Add Router"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
