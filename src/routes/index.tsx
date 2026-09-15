import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ShieldCheck, Tv, Wifi } from "lucide-react";
import { PalNetHeader } from "@/components/PalNetHeader";
import { PlanCard } from "@/components/PlanCard";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { SessionPanel } from "@/components/SessionPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMySession, usePlans, useSession } from "@/hooks/usePalNet";
import type { Plan } from "@/lib/palnet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PalNet Wi-Fi — Buy a Hotspot Pass, Home Internet or TV Package" },
      {
        name: "description",
        content:
          "Connect to PalNet: hotspot passes from KES 5, weekly and monthly home unlimited internet, and TV streaming packages. Pay with M-Pesa or a scratch card.",
      },
      { property: "og:title", content: "PalNet Wi-Fi — Hotspot, Home Internet & TV" },
      {
        property: "og:description",
        content: "Buy a Wi-Fi pass in seconds with M-Pesa or redeem a PalNet scratch card.",
      },
    ],
  }),
  component: CaptivePortal,
});

function CaptivePortal() {
  const { user } = useSession();
  const { data: plans, isLoading } = usePlans();
  const { data: activeSession } = useMySession(user?.id);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  function openCheckout(plan: Plan | null) {
    setSelected(plan);
    setCheckoutOpen(true);
  }

  const byCategory = (category: string) =>
    (plans ?? []).filter((plan) => plan.category === category && plan.is_active);

  return (
    <div className="min-h-screen">
      <PalNetHeader />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="surface-panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-brand" />
          <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">
            <span className="text-gradient-brand">Fast local internet</span>
            <br />
            paid the easy way.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Choose a hotspot pass, home unlimited bundle or TV streaming package. Pay with M-Pesa or
            enter a scratch card code and you are online in seconds.
          </p>
          {!user && (
            <Button asChild className="mt-5 font-display">
              <Link to="/auth">Sign in to buy a package</Link>
            </Button>
          )}
        </section>

        {activeSession && (
          <section className="mt-6">
            <SessionPanel session={activeSession} onTopUp={() => openCheckout(null)} />
          </section>
        )}

        <section className="mt-8">
          <Tabs defaultValue="hotspot">
            <TabsList className="w-full">
              <TabsTrigger value="hotspot" className="flex-1">
                <Wifi className="size-4" /> Hotspot
              </TabsTrigger>
              <TabsTrigger value="home" className="flex-1">
                <Radio className="size-4" /> Home
              </TabsTrigger>
              <TabsTrigger value="tv" className="flex-1">
                <Tv className="size-4" /> TV
              </TabsTrigger>
            </TabsList>

            {(["hotspot", "home", "tv"] as const).map((category) => (
              <TabsContent key={category} value={category} className="pt-5">
                {isLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {byCategory(category).map((plan) => (
                      <PlanCard key={plan.id} plan={plan} onSelect={openCheckout} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-accent" /> Payments are processed securely through
          M-Pesa. PalNet never stores your PIN.
        </p>
      </main>

      <CheckoutDialog plan={selected} open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
