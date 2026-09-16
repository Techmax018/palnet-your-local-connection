import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "PalNet Admin — Sign In" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Verify admin role
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      await supabase.auth.signOut();
      toast.error("Access denied. This account does not have admin privileges.");
      return;
    }
    toast.success("Welcome to PalNet Control Center");
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 bg-background">
      <Card className="surface-panel w-full max-w-sm gap-0 p-6 glow-primary">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 mb-3">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <h1 className="font-display text-xl font-black text-gradient-brand">PalNet Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">Control Center — Authorised Access Only</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@palnet.local"
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>
          <Button className="w-full font-display text-sm mt-1" disabled={busy} onClick={signIn}>
            {busy && <Loader2 className="animate-spin size-4" />}
            Sign in to Admin
          </Button>
        </div>
      </Card>
    </div>
  );
}
