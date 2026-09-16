import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShieldOff, Activity } from "lucide-react";
import { toast } from "sonner";
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
  const [denied, setDenied] = useState(false);

  async function signIn() {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setDenied(false);
    setBusy(true);

    // 1. Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setBusy(false);
      // Wrong credentials — show generic denied screen so we don't leak info
      setDenied(true);
      return;
    }

    // 2. Check user_roles table — must have role = 'admin'
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();

    setBusy(false);

    if (!role) {
      // Authenticated but not an admin — sign out immediately
      await supabase.auth.signOut();
      setDenied(true);
      return;
    }

    // 3. Admin confirmed — redirect to dashboard
    toast.success("Welcome to PalNet Control Center");
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 admin-bg">
      {/* Faint grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,243,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,243,255,1) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="space-y-3 text-center">
          <div className="relative inline-block">
            <img
              src="/favicon.png"
              alt="PalNet"
              className="mx-auto h-16 w-16 rounded-2xl object-cover ring-2 ring-cyan-500/30"
              style={{ boxShadow: "0 0 40px rgba(0,243,255,0.2)" }}
            />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0b0f19] bg-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-white">
              PalNet Admin
            </h1>
            <p className="mt-1 text-xs uppercase tracking-widest text-cyan-400/80">
              Control Center
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="admin-card space-y-4 p-6"
          style={{
            boxShadow:
              "0 0 60px rgba(0,243,255,0.06), 0 1px 0 rgba(255,255,255,0.05) inset",
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <Lock className="size-3.5 text-slate-500" />
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Authorised access only
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="admin-label">Email Address</Label>
            <Input
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => { setEmail(e.target.value); setDenied(false); }}
              placeholder="admin@example.com"
              className="admin-input"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="admin-label">Password</Label>
            <Input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => { setPassword(e.target.value); setDenied(false); }}
              className="admin-input"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>

          {/* Access denied */}
          {denied && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <ShieldOff className="size-3.5 shrink-0 mt-0.5 text-red-400" />
              <p className="text-xs text-red-400">
                Access denied. Check your credentials or contact the system owner to grant admin access in Supabase.
              </p>
            </div>
          )}

          <Button
            className="admin-btn-primary h-10 w-full"
            disabled={busy}
            onClick={signIn}
          >
            {busy ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              <Activity className="size-4" />
            )}
            Sign in to Admin Panel
          </Button>
        </div>

        <p className="text-center text-xs text-slate-600">
          PalNet ISP Management · Restricted Access
          <br />
          <span className="text-slate-700">
            Admin access is granted via Supabase → user_roles table.
          </span>
        </p>
      </div>
    </div>
  );
}
