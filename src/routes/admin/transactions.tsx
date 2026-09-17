import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKes } from "@/lib/palnet";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({ meta: [{ title: "PalNet Admin — Transactions" }] }),
  component: AdminTransactions,
});

type Tx = {
  id: string; created_at: string; phone_number: string | null;
  amount_kes: number; payment_method: string;
  transaction_reference: string | null; status: string;
  internet_plans: { name: string } | null;
};

function AdminTransactions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, created_at, phone_number, amount_kes, payment_method, transaction_reference, status, internet_plans(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as Tx[];
    },
  });

  const filtered = (transactions ?? []).filter((tx) => {
    const matchSearch = !search ||
      tx.phone_number?.includes(search) ||
      tx.transaction_reference?.toLowerCase().includes(search.toLowerCase()) ||
      tx.internet_plans?.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (statusFilter === "all" || tx.status === statusFilter);
  });

  const revenue = filtered
    .filter((tx) => tx.status === "completed")
    .reduce((s, tx) => s + Number(tx.amount_kes), 0);

  function exportCsv() {
    const header = "Date,Phone,Plan,Amount,Method,Reference,Status\n";
    const rows = filtered.map((tx) =>
      [new Date(tx.created_at).toISOString(), tx.phone_number ?? "", tx.internet_plans?.name ?? "",
        tx.amount_kes, tx.payment_method, tx.transaction_reference ?? "", tx.status].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palnet-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">M-Pesa Transactions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {filtered.length} records · {formatKes(revenue)} confirmed revenue
          </p>
        </div>
        <Button variant="outline" size="sm" className="admin-btn-outline gap-1.5 text-xs h-8" onClick={exportCsv}>
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
          <Input
            placeholder="Phone number, M-Pesa ref, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input pl-9 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="admin-input h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-9 admin-skeleton rounded" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium">Plan Name</th>
                  <th className="px-4 py-3 text-left font-medium">Customer Phone</th>
                  <th className="px-4 py-3 text-right font-medium">Amount (KES)</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">M-Pesa Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{tx.internet_plans?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-white">{tx.phone_number ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatKes(tx.amount_kes)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                        tx.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                        "bg-red-500/15 text-red-400"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{tx.transaction_reference ?? "—"}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No transactions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
