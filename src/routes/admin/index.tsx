import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Tv, Router, TrendingUp, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatKes } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/")({
  head: () => ({ meta: [{ title: "PalNet Admin — Overview" }] }),
  component: AdminOverview,
});

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const now = new Date().toISOString();

      const [revResult, hotspotResult, tvResult, routerResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("amount_kes")
          .eq("status", "completed"),
        supabase
          .from("user_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("end_time", now)
          .in("plan_id",
            (await supabase.from("internet_plans").select("id").in("category", ["hotspot", "home"]))
              .data?.map((p: { id: string }) => p.id) ?? []
          ),
        supabase
          .from("user_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("end_time", now)
          .in("plan_id",
            (await supabase.from("internet_plans").select("id").eq("category", "tv"))
              .data?.map((p: { id: string }) => p.id) ?? []
          ),
        supabase
          .from("routers")
          .select("id", { count: "exact", head: true })
          .eq("status", "online"),
      ]);

      const totalRevenue = (revResult.data ?? []).reduce(
        (sum: number, t: { amount_kes: number }) => sum + Number(t.amount_kes),
        0,
      );

      return {
        totalRevenue,
        activeHotspot: hotspotResult.count ?? 0,
        activeTv: tvResult.count ?? 0,
        onlineRouters: routerResult.count ?? 0,
      };
    },
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card className="surface-panel p-4 gap-0">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
        <Icon className={`size-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <p className="mt-2 font-display text-2xl font-black text-foreground">{value}</p>
    </Card>
  );
}

function AdminOverview() {
  const { data: stats, isLoading, refetch, isFetching } = useAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Live network snapshot</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={formatKes(stats?.totalRevenue ?? 0)}
            icon={TrendingUp}
            accent="text-success"
          />
          <StatCard
            label="Active Users"
            value={stats?.activeHotspot ?? 0}
            icon={Users}
            accent="text-primary"
          />
          <StatCard
            label="TV Accounts"
            value={stats?.activeTv ?? 0}
            icon={Tv}
            accent="text-accent"
          />
          <StatCard
            label="Online Routers"
            value={stats?.onlineRouters ?? 0}
            icon={Router}
            accent="text-success"
          />
        </div>
      )}

      <RecentTransactions />
    </div>
  );
}

function RecentTransactions() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-recent-tx"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, created_at, amount_kes, status, payment_method, phone_number, internet_plans(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div>
      <h2 className="font-display text-sm font-bold text-foreground mb-3">Recent Transactions</h2>
      <Card className="surface-panel p-0 overflow-hidden gap-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-left font-medium">Method</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(data ?? []).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-display">{tx.phone_number ?? "—"}</td>
                    <td className="px-4 py-2.5">{tx.internet_plans?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-display text-success">
                      {formatKes(tx.amount_kes)}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{tx.payment_method}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(tx.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-success/20 text-success",
    pending: "bg-warning/20 text-warning",
    failed: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}
