import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/usePalNet";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to PalNet — Wi-Fi, Home Internet & TV" },
      {
        name: "description",
        content:
          "Sign in or create a PalNet account to buy hotspot passes and manage your sessions.",
      },
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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back to PalNet");
    navigate({ to: "/", replace: true });
  }

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone_number: phone },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Account created — check your email to confirm it, then sign in.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="surface-panel w-full max-w-md gap-0 p-6 glow-primary">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #0b1622, #0d1f2d)",
              boxShadow: "0 0 0 2px rgba(0,243,255,0.2), 0 0 30px rgba(0,243,255,0.15)",
            }}
          >
            <img src="/favicon.png" alt="PalNet logo" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-black text-gradient-brand">PalNet</h1>
          <p className="text-sm text-muted-foreground">Local Wi-Fi, Home ISP & TV billing portal</p>
        </div>

        <Tabs defaultValue="signin" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="signin" className="flex-1">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">Create account</TabsTrigger>
          </TabsList>

          {/* Sign in */}
          <TabsContent value="signin" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
            </div>
            <Button className="w-full font-display" disabled={busy} onClick={signIn}>
              {busy && <Loader2 className="animate-spin" />} Sign in
            </Button>
          </TabsContent>

          {/* Create account */}
          <TabsContent value="signup" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone number</Label>
              <Input
                id="signup-phone"
                inputMode="tel"
                placeholder="0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full font-display" disabled={busy} onClick={signUp}>
              {busy && <Loader2 className="animate-spin" />} Create account
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
