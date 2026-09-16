import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Wifi, WifiOff, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { saveRouter, testRouterConnection } from "@/lib/palnet.functions";

export const Route = createFileRoute("/admin/_layout/routers")({
  head: () => ({ meta: [{ title: "PalNet Admin — Routers" }] }),
  component: AdminRouters,
});

type Router = {
  id: string;
  name: string;
  ip_address: string;
  api_port: number;
  location: string | null;
  status: string;
  last_ping: string | null;
};

function useRouters() {
  return useQuery({
    queryKey: ["admin-routers"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("routers")
        .select("*")
        .order("name");
      return (data ?? []) as Router[];
    },
  });
}

const EMPTY: Omit<Router, "id" | "status" | "last_ping"> = {
  name: "",
  ip_address: "",
  api_port: 8728,
  location: "",
};

function AdminRouters() {
  const { data: routers, isLoading } = useRouters();
  const queryClient = useQueryClient();
  const save = useServerFn(saveRouter);
  const pingFn = useServerFn(testRouterConnection);
  const [editing, setEditing] = useState<Router | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(r: Router) {
    setEditing(r);
    setForm({ name: r.name, ip_address: r.ip_address, api_port: r.api_port, location: r.location ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    setBusy("save");
    try {
      const result = await save({
        data: {
          id: editing?.id ?? null,
          name: form.name,
          ip_address: form.ip_address,
          api_port: Number(form.api_port),
          location: form.location || null,
        },
      });
      toast[result.ok ? "success" : "error"](result.message);
      if (result.ok) {
        setDialogOpen(false);
        await queryClient.invalidateQueries({ queryKey: ["admin-routers"] });
      }
    } catch {
      toast.error("Failed to save router");
    } finally {
      setBusy(null);
    }
  }

  async function handlePing(routerId: string) {
    setBusy(routerId);
    try {
      const result = await pingFn({ data: { routerId } });
      toast[result.ok && result.online ? "success" : "error"](result.message);
      await queryClient.invalidateQueries({ queryKey: ["admin-routers"] });
    } catch {
      toast.error("Ping failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Routers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">MikroTik / OpenWrt access points</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs font-display" onClick={openNew}>
          <Plus className="size-3.5" /> Add Router
        </Button>
      </div>

      <Card className="surface-panel p-0 overflow-hidden gap-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">IP : Port</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Last Ping</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {routers?.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-display font-semibold">{r.name}</td>
                    <td className="px-4 py-3 font-display text-muted-foreground">
                      {r.ip_address}:{r.api_port}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "online"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      }`}>
                        {r.status === "online"
                          ? <Wifi className="size-3" />
                          : <WifiOff className="size-3" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.last_ping
                        ? new Date(r.last_ping).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={busy === r.id}
                          onClick={() => handlePing(r.id)}
                        >
                          {busy === r.id
                            ? <Loader2 className="size-3 animate-spin" />
                            : <RefreshCw className="size-3" />}
                          Ping
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-3" /> Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!routers?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No routers added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-sm">
              {editing ? "Edit Router" : "Add Router"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {(["name", "ip_address"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-xs capitalize">{field.replace("_", " ")}</Label>
                <Input
                  value={form[field] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="h-9 text-sm"
                  placeholder={field === "name" ? "PalNet-Core-01" : "192.168.88.1"}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">API Port</Label>
                <Input
                  type="number"
                  value={form.api_port}
                  onChange={(e) => setForm((f) => ({ ...f, api_port: Number(e.target.value) }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input
                  value={form.location ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="h-9 text-sm"
                  placeholder="Rooftop Mast"
                />
              </div>
            </div>
            <Button
              className="w-full font-display text-sm"
              disabled={busy === "save" || !form.name || !form.ip_address}
              onClick={handleSave}
            >
              {busy === "save" && <Loader2 className="animate-spin size-4" />}
              {editing ? "Save Changes" : "Add Router"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
