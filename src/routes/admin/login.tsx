import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, Activity } from "lucide-react";
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

  async function signIn() {
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      await supabase.auth.signOut();
      toast.error("Access denied. This account does not have admin privileges.");
      return;
    }
    toast.success("Welcome to PalNet Control Center");
    navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 admin-bg">
      {/* Background grid */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(0,243,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,243,255,1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="w-full max-w-sm space-y-6 relative">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <img src="/favicon.png" alt="PalNet" className="h-16 w-16 rounded-2xl object-cover mx-auto ring-2 ring-cyan-500/30" style={{ boxShadow: "0 0 40px rgba(0,243,255,0.2)" }} />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0b0f19] bg-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">PalNet Admin</h1>
            <p className="text-xs text-cyan-400/80 tracking-widest uppercase mt-1">Control Center</p>
          </div>
        </div>

        {/* Card */}
        <div className="admin-card p-6 space-y-4" style={{ boxShadow: "0 0 60px rgba(0,243,255,0.06), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="size-3.5 text-slate-500" />
            <p className="text-xs text-slate-500 uppercase tracking-widest">Authorised Access Only</p>
          </div>

          <div className="space-y-1.5">
            <Label className="admin-label">Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@palnet.local"
              className="admin-input"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="admin-label">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              onKeyDown={(e) => e.key === "Enter" && signIn()}
            />
          </div>
          <Button className="admin-btn-primary w-full h-10" disabled={busy} onClick={signIn}>
            {busy ? <Loader2 className="animate-spin size-4" /> : <Activity className="size-4" />}
            Sign in to Admin Panel
          </Button>
        </div>

        <p className="text-center text-xs text-slate-600">
          PalNet ISP Management · Restricted Access
        </p>
      </div>
    </div>
  );
}
