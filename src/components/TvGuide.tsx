import { useState } from "react";
import { ChevronDown, Tv, Wifi, Globe, CreditCard, QrCode } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Wifi,
    title: "Connect to PalNet Wi-Fi",
    body: 'On your Smart TV or Android Box, open Settings → Network → Wi-Fi and connect to the "PalNet-WiFi" network.',
  },
  {
    icon: QrCode,
    title: "Open this portal on the TV browser",
    body: "Launch the TV's built-in web browser and navigate to the portal URL shown on the connection screen, or scan the QR code displayed with your smartphone.",
  },
  {
    icon: Globe,
    title: "Go to the TV Packages tab",
    body: 'On this page, tap the "TV" tab at the top. You will see all available Smart TV & streaming packages.',
  },
  {
    icon: CreditCard,
    title: "Select a plan and pay",
    body: "Pick your preferred TV plan, enter your TV's assigned IP address or Account Code (shown in Network settings), and enter your M-Pesa phone number to receive a payment prompt.",
  },
];

export function TvGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between gap-2 text-xs border-border/70 bg-background/40 h-8"
        >
          <span className="flex items-center gap-2">
            <Tv className="size-3.5 text-accent" />
            How to connect your Smart TV / Android Box
          </span>
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="surface-panel p-4 space-y-4">
          <p className="text-xs font-semibold text-accent uppercase tracking-widest">
            Smart TV Connection Guide
          </p>
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={i} className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-xs font-bold text-accent">
                    {i + 1}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Icon className="size-3.5 text-accent" />
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
            Need help? Ask the PalNet agent on-site or call the support number printed on your
            scratch card.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
