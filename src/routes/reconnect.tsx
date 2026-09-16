import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ReconnectPanel } from "@/components/ReconnectPanel";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reconnect")({
  head: () => ({
    meta: [
      { title: "PalNet — Reconnect / Transfer Session" },
      { name: "description", content: "Transfer your active PalNet session to a new device using your M-Pesa code or voucher." },
    ],
  }),
  component: ReconnectPage,
});

function ReconnectPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0b0f19" }}>
      {/* Minimal header */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Portal
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <img src="/favicon.png" alt="PalNet" className="h-6 w-6 rounded-lg object-cover border border-border/70" />
          <span className="font-display text-sm font-bold text-gradient-brand">PalNet Wi-Fi</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="font-display text-xl font-black text-gradient-brand">
              Reconnect Device
            </h1>
            <p className="text-xs text-muted-foreground">
              Transfer your active session to this device using your payment proof.
            </p>
          </div>

          <div className="surface-panel p-4">
            <ReconnectPanel onSuccess={() => navigate({ to: "/", replace: true })} />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Changed your TV or Android Box?{" "}
            <Link to="/" search={{ tab: "tv" } as any} className="text-accent underline underline-offset-2">
              Go to TV Packages →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
