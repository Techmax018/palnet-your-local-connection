import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatKes } from "@/lib/palnet";

export const Route = createFileRoute("/admin/_layout/transactions")({
  head: () => ({ meta: [{ title: "PalNet Admin — Transactions" }] }),
  component: AdminTransactions,
});

type Tx = {
  id: string;
  created_at: string;
  phone_number: string | null;
  amount_kes: number;
  payment_method: string;
  transaction_reference: string | null;
  status: string;
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
    const matchSearch =
      !search ||
      tx.phone_number?.includes(search) ||
      tx.transaction_reference?.toLowerCase().includes(search.toLowerCase()) ||
      tx.internet_plans?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totals = filtered.reduce(
    (acc, tx) => {
      if (tx.status === "completed") acc.revenue += Number(tx.amount_kes);
      acc.count += 1;
      return acc;
    },
    { revenue: 0, count: 0 },
  );

  function exportCsv() {
    const header = "Date,Phone,Plan,Amount,Method,Reference,Status\n";
    const rows = filtered
      .map((tx) =>
        [
          new Date(tx.created_at).toISOString(),
          tx.phone_number ?? "",
          tx.internet_plans?.name ?? "",
          tx.amount_kes,
          tx.payment_method,
          tx.transaction_reference ?? "",
          tx.status,
        ].join(","),
      )
      .join("\n");
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
          <h1 className="font-display text-xl font-bold text-foreground">Transactions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totals.count} records · {formatKes(totals.revenue)} revenue shown
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCsv}>
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Phone, reference, plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-36">
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

      <Card className="surface-panel p-0 overflow-hidden gap-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 rounded" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Date / Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-left font-medium">Method</th>
                  <th className="px-4 py-2.5 text-left font-medium">Reference</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {new Date(tx.created_at).toLocaleString("en-KE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-display">{tx.phone_number ?? "—"}</td>
                    <td className="px-4 py-2.5">{tx.internet_plans?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-display font-semibold text-success">
                      {formatKes(tx.amount_kes)}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{tx.payment_method}</td>
                    <td className="px-4 py-2.5 font-display text-muted-foreground tracking-wide">
                      {tx.transaction_reference ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.status === "completed"
                          ? "bg-success/20 text-success"
                          : tx.status === "pending"
                          ? "bg-warning/20 text-warning"
                          : "bg-destructive/20 text-destructive"
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No transactions found
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
