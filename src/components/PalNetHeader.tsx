/**
 * PalNetHeader — Public customer portal header.
 *
 * Deliberately has NO sign-in/sign-out buttons.
 * The portal is 100% public. A discrete "ISP Admin" link in the footer
 * of the portal page routes admins to /admin/login.
 */
import { Link } from "@tanstack/react-router";
import { Flower2, PartyPopper } from "lucide-react";
import { useNetworkSettings } from "@/hooks/useAdminAlerts";

export function PalNetHeader({ online = true }: { online?: boolean }) {
  const { data: settings } = useNetworkSettings();
  const logoTreatment = settings?.["dashboard_logo_treatment"]
    ?? (settings?.["dashboard_event_theme"] === "christmas" ? "santa-hat" : "standard");
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div className="relative size-10 shrink-0">
            <div
              className="size-full aspect-square overflow-hidden rounded-xl"
              style={{ boxShadow: "0 0 14px rgba(0,243,255,0.25)" }}
            >
              <img src="/favicon.png" alt="PalNet" className="size-full object-cover" />
            </div>
            {logoTreatment === "santa-hat" && (
              <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 z-10 h-6 w-7 rotate-[22deg]">
                <span className="absolute bottom-1 left-1 h-4 w-5 rounded-t-full bg-red-600 shadow-sm [clip-path:polygon(0_100%,100%_100%,72%_0)]" />
                <span className="absolute bottom-0 left-0 h-1.5 w-5 rounded-full bg-white shadow-sm" />
                <span className="absolute right-0 top-0 size-2 rounded-full bg-white shadow-sm" />
              </span>
            )}
            {logoTreatment === "new-year" && (
              <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 z-10 flex size-6 items-center justify-center rounded-full border border-amber-200/70 bg-amber-400 text-amber-950 shadow-md">
                <PartyPopper className="size-3.5" />
              </span>
            )}
            {logoTreatment === "easter" && (
              <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 z-10 flex size-6 items-center justify-center rounded-full border border-emerald-100/70 bg-emerald-400 text-emerald-950 shadow-md">
                <Flower2 className="size-3.5" />
              </span>
            )}
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
              {settings?.["support_phone"] ? (
                <span className="ml-2 text-xs text-slate-400">· Support {settings["support_phone"]}</span>
              ) : null}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
