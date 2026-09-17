import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Wifi } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/usePalNet";

export function PalNetHeader({ online = true }: { online?: boolean }) {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
            style={{ boxShadow: "0 0 14px rgba(0,243,255,0.25)" }}
          >
            <img src="/favicon.png" alt="PalNet" className="h-8 w-8 object-contain" />
          </div>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold text-gradient-brand">
              PalNet Wi-Fi
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className={`inline-block size-1.5 shrink-0 rounded-full ${
                  online ? "bg-emerald-400 pulse-live" : "bg-destructive"
                }`}
              />
              {online ? "Reliable Wifi Billing & Connectivity" : "Network unreachable"}
            </span>
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Link to="/admin">
                <ShieldCheck className="size-3.5" />
                <span className="hidden sm:inline">Control Center</span>
              </Link>
            </Button>
          )}
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={signOut}
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          ) : (
            <Button asChild size="sm" className="h-8 text-xs gap-1.5">
              <Link to="/auth">
                <Wifi className="size-3.5" /> Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
