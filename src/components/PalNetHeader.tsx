import { Link } from "@tanstack/react-router";
import { LogOut, ShieldCheck, Wifi } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="PalNet logo"
            className="size-10 rounded-xl border border-border object-contain glow-neon"
          />
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold text-gradient-brand">PalNet Wi-Fi</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block size-2 shrink-0 rounded-full ${online ? "bg-success pulse-live" : "bg-destructive"}`}
              />
              {online ? "Reliable Wifi Billing & Connectivity" : "Network unreachable"}
            </span>
          </span>
        </Link>

        {/* Right-side actions — wrap on mobile so Sign In appears below */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">
                <ShieldCheck /> Control Center
              </Link>
            </Button>
          )}
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">
                <Wifi /> Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
