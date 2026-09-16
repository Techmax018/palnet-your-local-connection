import { useEffect } from "react";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Router,
  Package,
  Ticket,
  Users,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/usePalNet";

export const Route = createFileRoute("/admin/_layout")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/routers", label: "Routers", icon: Router },
  { to: "/admin/plans", label: "Plans", icon: Package },
  { to: "/admin/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/admin/sessions", label: "Sessions", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: CreditCard },
];

function AdminLayout() {
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !adminLoading) {
      if (!user) {
        navigate({ to: "/admin/login", replace: true });
      } else if (isAdmin === false) {
        navigate({ to: "/admin/login", replace: true });
      }
    }
  }, [user, isAdmin, loading, adminLoading, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (loading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-display text-gradient-brand animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  function NavItems({ onClick }: { onClick?: () => void }) {
    return (
      <nav className="space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to) && to !== "/admin";
          const exactActive = pathname === to && exact;
          const isActive = exact ? exactActive : active;
          return (
            <Link
              key={to}
              to={to}
              onClick={onClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-border/70 bg-sidebar px-3 py-4">
        <div className="flex items-center gap-2 px-1 mb-6">
          <img src="/favicon.png" alt="PalNet" className="h-7 w-7 rounded-lg object-cover border border-border/70" />
          <span className="font-display text-sm font-bold text-gradient-brand">PalNet Admin</span>
        </div>
        <NavItems />
        <div className="mt-auto pt-4 border-t border-border/50">
          <p className="px-3 text-xs text-muted-foreground mb-2 truncate">{user.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={signOut}>
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 flex flex-col border-r border-border/70 bg-sidebar px-3 py-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 px-1">
                <img src="/favicon.png" alt="PalNet" className="h-7 w-7 rounded-lg object-cover border border-border/70" />
                <span className="font-display text-sm font-bold text-gradient-brand">PalNet Admin</span>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSidebarOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <NavItems onClick={() => setSidebarOpen(false)} />
            <div className="mt-auto pt-4 border-t border-border/50">
              <p className="px-3 text-xs text-muted-foreground mb-2 truncate">{user.email}</p>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={signOut}>
                <LogOut className="size-3.5" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex lg:hidden items-center gap-3 border-b border-border/70 bg-background/85 backdrop-blur px-4 py-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <img src="/favicon.png" alt="PalNet" className="h-5 w-5 rounded object-cover border border-border/70" />
          <span className="font-display text-sm font-bold text-gradient-brand">PalNet Admin</span>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
