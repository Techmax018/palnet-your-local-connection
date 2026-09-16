/**
 * ReconnectPanel — can be embedded in the portal tab or used as a standalone page.
 *
 * Features:
 *  - Option A: Paste full Safaricom M-Pesa SMS → regex extracts the 10-char ref code
 *  - Option B: Direct code entry (M-Pesa ref or 6-char PalNet voucher)
 *  - Calls transferSession server function, shows success / error feedback
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, CheckCircle2, ClipboardPaste, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getDeviceMac, getDeviceIp } from "@/hooks/usePalNet";
import { transferSession } from "@/lib/palnet.functions";

/** Extracts a 10-character uppercase M-Pesa confirmation code from an SMS body. */
function extractMpesaCode(sms: string): string | null {
  const match = sms.match(/\b([A-Z0-9]{10})\b/);
  return match ? match[1] : null;
}

export function ReconnectPanel({ onSuccess }: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const transfer = useServerFn(transferSession);

  // Option A — SMS paste
  const [smsText, setSmsText] = useState("");
  const [extractedCode, setExtractedCode] = useState<string | null>(null);

  // Option B — direct code
  const [directCode, setDirectCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function handleSmsChange(text: string) {
    setSmsText(text);
    const code = extractMpesaCode(text);
    setExtractedCode(code);
  }

  async function handleTransfer(code: string) {
    const clean = code.toUpperCase().replace(/\s/g, "");
    if (clean.length < 6) {
      toast.error("Enter at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await transfer({
        data: {
          code: clean,
          macAddress: getDeviceMac(),
          ipAddress: getDeviceIp(),
          userAgent: navigator?.userAgent?.slice(0, 200) ?? null,
          deviceLabel: navigator?.userAgent?.slice(0, 60) ?? null,
        },
      });
      if (result.ok) {
        setDone(true);
        toast.success(result.message);
        await queryClient.invalidateQueries();
        onSuccess?.();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Transfer failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <p className="font-display text-base font-bold text-foreground">You are now online!</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Session reconnected to this device successfully. Your existing time balance is active.
        </p>
        <Button size="sm" variant="outline" className="text-xs mt-2" onClick={() => { setDone(false); setSmsText(""); setExtractedCode(null); setDirectCode(""); }}>
          <RefreshCw className="size-3.5" /> Reconnect another session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ArrowRightLeft className="size-4 text-accent" />
          Reconnect Device
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Prove ownership of your session using your M-Pesa payment reference or PalNet scratch-card
          code. Your remaining time will be reconnected to this device instantly.
        </p>
      </div>

      <Tabs defaultValue="sms">
        <TabsList className="w-full">
          <TabsTrigger value="sms" className="flex-1 gap-1.5 text-xs">
            <ClipboardPaste className="size-3.5" /> Paste M-Pesa SMS
          </TabsTrigger>
          <TabsTrigger value="code" className="flex-1 gap-1.5 text-xs">
            <Smartphone className="size-3.5" /> Enter Code
          </TabsTrigger>
        </TabsList>

        {/* ── Option A: SMS paste ── */}
        <TabsContent value="sms" className="space-y-3 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Paste your full Safaricom M-Pesa confirmation SMS</Label>
            <Textarea
              value={smsText}
              onChange={(e) => handleSmsChange(e.target.value)}
              placeholder={`e.g. "RHJ1K2L3M4 Confirmed. Ksh35.00 paid to PalNet Wi-Fi on 16/9/26 at 2:45 PM..."`}
              className="h-24 resize-none text-xs font-mono leading-relaxed"
            />
          </div>

          {/* Extraction result + Connect button */}
          {smsText && (
            <div className={`rounded-lg border p-3 ${extractedCode ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              {extractedCode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">M-Pesa code extracted</p>
                      <p className="font-display text-lg font-black tracking-[0.25em] text-foreground mt-0.5">
                        {extractedCode}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success/20">
                      Found
                    </span>
                  </div>
                  {/* Connect button — verifies code in DB then reconnects */}
                  <Button
                    className="w-full font-display text-sm gap-2"
                    disabled={busy}
                    onClick={() => handleTransfer(extractedCode)}
                  >
                    {busy
                      ? <Loader2 className="animate-spin size-4" />
                      : <ArrowRightLeft className="size-4" />}
                    {busy ? "Verifying with PalNet…" : "Connect This Device"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Verifying <span className="font-display text-foreground">{extractedCode}</span> against PalNet payment records…
                  </p>
                </div>
              ) : (
                <p className="text-xs text-destructive">
                  No 10-character M-Pesa code found in that message. Check the SMS and try again.
                </p>
              )}
            </div>
          )}

          {!smsText && (
            <p className="text-xs text-muted-foreground">
              The code is automatically extracted using the pattern{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-accent">[A-Z0-9]&#123;10&#125;</code>{" "}
              — nothing is sent to any third party.
            </p>
          )}
        </TabsContent>

        {/* ── Option B: direct code ── */}
        <TabsContent value="code" className="space-y-3 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">M-Pesa reference or PalNet voucher code</Label>
            <Input
              value={directCode}
              onChange={(e) => setDirectCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="e.g. RHJ1K2L3M4 or 4F9K2P"
              maxLength={20}
              className="h-9 font-display tracking-[0.25em] text-sm uppercase"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your 10-character M-Pesa confirmation code or 6-character scratch-card voucher.
          </p>
          <Button
            className="w-full font-display text-sm"
            disabled={busy || directCode.length < 6}
            onClick={() => handleTransfer(directCode)}
          >
            {busy ? <Loader2 className="animate-spin size-4" /> : <ArrowRightLeft className="size-4" />}
            Reconnect to This Device
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
