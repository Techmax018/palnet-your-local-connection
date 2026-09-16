import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ShieldCheck, Tv, Wifi } from "lucide-react";
import { PalNetHeader } from "@/components/PalNetHeader";
import { PlanCard } from "@/components/PlanCard";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { SessionPanel } from "@/components/SessionPanel";
import { TvGuide } from "@/components/TvGuide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSession, useSession, usePlans } from "@/hooks/usePalNet";
import type { Plan } from "@/lib/palnet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PalNet Wi-Fi — Hotspot, Home Internet & TV Packages" },
      {
        name: "description",
        content:
          "Buy a PalNet Wi-Fi pass in seconds — hotspot passes from KES 5, home unlimited bundles, and Smart TV streaming packages. Pay with M-Pesa, no account needed.",
      },
      { property: "og:title", content: "PalNet Wi-Fi — Hotspot, Home Internet & TV" },
      {
        property: "og:description",
        content: "Buy a Wi-Fi pass with M-Pesa or redeem a PalNet scratch card. No login required.",
      },
    ],
  }),
  component: CaptivePortal,
});

function CaptivePortal() {
  const { user } = useSession();
  const { data: plans, isLoading } = usePlans();
  const { data: activeSession } = useActiveSession(user?.id);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function openCheckout(plan: Plan | null) {
    setSelected(plan);
    setCheckoutOpen(true);
  }

  const byCategory = (category: string) =>
    (plans ?? []).filter((p) => p.category === category && p.is_active);

  return (
    <div className="min-h-screen">
      <PalNetHeader />

      <main className="mx-auto max-w-lg px-3 pb-16 pt-4">

        {/* Hero */}
        <section className="surface-panel relative overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
          <h1 className="font-display text-2xl font-black leading-tight">
            <span className="text-gradient-brand">Fast local internet</span>
            <br />
            paid the easy way.
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Hotspot passes, home unlimited bundles or Smart TV packages. Pay with M-Pesa — no
            account needed.
          </p>
          {!user && (
            <p className="mt-2 text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth" className="text-accent underline underline-offset-2">
                Sign in
              </Link>
            </p>
          )}
        </section>

        {/* Active session */}
        {activeSession && (
          <section className="mt-3">
            <SessionPanel session={activeSession} onTopUp={() => openCheckout(null)} />
          </section>
        )}

        {/* Plans */}
        <section className="mt-4">
          <Tabs defaultValue="hotspot">
            <TabsList className="w-full">
              <TabsTrigger value="hotspot" className="flex-1 gap-1.5 text-xs">
                <Wifi className="size-3.5" /> Hotspot
              </TabsTrigger>
              <TabsTrigger value="home" className="flex-1 gap-1.5 text-xs">
                <Radio className="size-3.5" /> Home
              </TabsTrigger>
              <TabsTrigger value="tv" className="flex-1 gap-1.5 text-xs">
                <Tv className="size-3.5" /> TV
              </TabsTrigger>
            </TabsList>

            {/* Hotspot — 3-col micro grid */}
            <TabsContent value="hotspot" className="pt-3">
              {isLoading ? (
                <LoadingGrid cols={3} />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {byCategory("hotspot").map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onSelect={openCheckout} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Home — 2-col grid */}
            <TabsContent value="home" className="pt-3">
              {isLoading ? (
                <LoadingGrid cols={2} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {byCategory("home").map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onSelect={openCheckout} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TV — 2-col grid + guide */}
            <TabsContent value="tv" className="pt-3 space-y-3">
              <TvGuide />
              {isLoading ? (
                <LoadingGrid cols={2} />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {byCategory("tv").map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onSelect={openCheckout} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-accent" />
          Payments processed securely via M-Pesa. PalNet never stores your PIN.
        </p>
      </main>

      <CheckoutDialog plan={selected} open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}

function LoadingGrid({ cols }: { cols: number }) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {Array.from({ length: cols * 2 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
