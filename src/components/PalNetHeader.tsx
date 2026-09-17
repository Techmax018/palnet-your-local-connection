/**
 * PalNetHeader — Public customer portal header.
 *
 * Deliberately has NO sign-in/sign-out buttons.
 * The portal is 100% public. A discrete "ISP Admin" link in the footer
 * of the portal page routes admins to /admin/login.
 */
import { Link } from "@tanstack/react-router";

export function PalNetHeader({ online = true }: { online?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden"
            style={{ boxShadow: "0 0 14px rgba(0,243,255,0.25)" }}
          >
            <img src="/favicon.png" alt="PalNet" className="h-8 w-8 object-contain" />
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
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
