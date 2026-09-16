import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/usePalNet";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to PalNet" },
      { name: "description", content: "Sign in to PalNet Wi-Fi billing portal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If already signed in, redirect to the right place
  useEffect(() => {
    if (loading || !user) return;
    redirectAfterLogin(user.id);
  }, [user, loading]);

  async function redirectAfterLogin(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    navigate({ to: data ? "/admin" : "/", replace: true });
  }

  async function signIn() {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid email or password. Please try again.");
      return;
    }
    toast.success("Welcome to PalNet!");
    await redirectAfterLogin(data.user.id);
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background: "#0b0f19",
        backgroundImage:
          "radial-gradient(600px circle at 30% 20%, rgba(0,243,255,0.04), transparent 55%)",
      }}
    >
      <Card className="surface-panel w-full max-w-sm gap-0 p-6 glow-primary">
        {/* Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0b1622, #0d1f2d)",
              boxShadow: "0 0 0 2px rgba(0,243,255,0.25), 0 0 40px rgba(0,243,255,0.2)",
            }}
          >
            <img src="/favicon.png" alt="PalNet logo" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-black text-gradient-brand">PalNet</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reliable Wi-Fi Billing & Connectivity
          </p>
        </div>

        {/* Sign-in form */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="size-3.5 text-muted-foreground" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>

          <Button
            className="w-full font-display text-sm"
            disabled={busy}
            onClick={signIn}
          >
            {busy ? <Loader2 className="animate-spin size-4" /> : <Activity className="size-4" />}
            Sign in
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Admin accounts are managed by the system owner.
        </p>
      </Card>
    </div>
  );
}
