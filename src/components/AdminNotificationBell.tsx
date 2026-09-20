/**
 * Admin notification bell — live alert feed.
 * Fed by useAdminAlerts (realtime + 30s poll).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, CreditCard, Router as RouterIcon, Ticket, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { useAdminAlerts, type AdminAlert } from "@/hooks/useAdminAlerts";

const KIND_ICON = {
  router: RouterIcon,
  payment: CreditCard,
  expiry: Timer,
  voucher: Ticket,
} as const;

const SEVERITY_STYLE = {
  critical: "bg-red-500/15 text-red-400 ring-red-500/20",
  warning: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  info: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/20",
} as const;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "upcoming";
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function AlertRow({ alert, onDismiss }: { alert: AdminAlert; onDismiss: (id: string) => void }) {
  const Icon = KIND_ICON[alert.kind];
  return (
    <div className="group flex gap-2.5 border-b border-slate-800/60 px-3 py-2.5 last:border-0 hover:bg-slate-800/30">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${
          SEVERITY_STYLE[alert.severity]
        }`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">{alert.title}</p>
        <p className="truncate text-xs text-slate-500">{alert.detail}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-slate-600">{timeAgo(alert.at)}</span>
          {alert.to && (
            <Link to={alert.to} className="text-xs font-medium text-cyan-400 hover:underline">
              View
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        title="Dismiss"
        className="self-start rounded p-1 text-slate-600 opacity-0 transition-opacity hover:text-slate-300 group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function AdminNotificationBell() {
  const { alerts, unread, unreadCount, markAllRead, dismiss, isLoading } = useAdminAlerts();
  const [open, setOpen] = useState(false);
  const toasted = useRef<Set<string>>(new Set());

  /* Toast each newly arriving critical/warning alert once per session */
  useEffect(() => {
    for (const a of unread) {
      if (toasted.current.has(a.id)) continue;
      toasted.current.add(a.id);
      if (a.severity === "critical") toast.error(a.title, { description: a.detail });
      else if (a.severity === "warning") toast.warning(a.title, { description: a.detail });
    }
  }, [unread]);

  const visible = alerts.filter((a) => unread.some((u) => u.id === a.id) || open);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-slate-900"
            style={{ background: "#00f3ff", boxShadow: "0 0 6px #00f3ff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-700/80 bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
              <div>
                <p className="text-xs font-bold text-white">Network Alerts</p>
                <p className="text-xs text-slate-500">
                  {unreadCount} new · {alerts.length} active
                </p>
              </div>
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-cyan-400"
              >
                <CheckCheck className="size-3" /> Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <p className="px-3 py-8 text-center text-xs text-slate-600">Checking network…</p>
              ) : visible.length ? (
                visible.map((a) => <AlertRow key={a.id} alert={a} onDismiss={dismiss} />)
              ) : (
                <p className="px-3 py-8 text-center text-xs text-slate-600">
                  All clear — no outages, failed payments or low stock.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
