import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Flower2, Palette, PartyPopper, Snowflake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNetworkSettings } from "@/hooks/useAdminAlerts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/_layout/themes")({
  component: AdminThemes,
});

const EVENT_THEMES = {
  christmas: {
    label: "Christmas Snow",
    title: "Season's greetings from PalNet",
    message: "Stay connected and share the joy this festive season.",
    icon: Snowflake,
    bannerClass: "border-sky-300/20 bg-gradient-to-r from-sky-500/15 via-cyan-300/5 to-slate-900/70",
    accentClass: "text-sky-200",
  },
  "new-year": {
    label: "New Year",
    title: "A brighter year starts connected",
    message: "Welcome to a new year of reliable PalNet connections.",
    icon: PartyPopper,
    bannerClass: "border-amber-300/20 bg-gradient-to-r from-amber-500/15 via-yellow-300/5 to-slate-900/70",
    accentClass: "text-amber-200",
  },
  easter: {
    label: "Easter",
    title: "Warm Easter wishes from PalNet",
    message: "Enjoy the season and stay close to what matters.",
    icon: Flower2,
    bannerClass: "border-emerald-300/20 bg-gradient-to-r from-emerald-500/15 via-lime-300/5 to-slate-900/70",
    accentClass: "text-emerald-200",
  },
} satisfies Record<string, {
  label: string;
  title: string;
  message: string;
  icon: LucideIcon;
  bannerClass: string;
  accentClass: string;
}>;

const EVENT_THEME_OPTIONS = ["standard", ...Object.keys(EVENT_THEMES)] as const;
const LOGO_TREATMENT_OPTIONS = ["standard", "santa-hat", "new-year", "easter"] as const;

function AdminThemes() {
  const { data: settings } = useNetworkSettings();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savedEventTheme = settings?.["dashboard_event_theme"];
  const eventTheme = EVENT_THEME_OPTIONS.find((theme) => theme === savedEventTheme) ?? "standard";
  const savedLogoTreatment = settings?.["dashboard_logo_treatment"];
  const logoTreatment = LOGO_TREATMENT_OPTIONS.find((treatment) => treatment === savedLogoTreatment)
    ?? (eventTheme === "christmas" ? "santa-hat" : "standard");
  const activeTheme = eventTheme === "standard" ? null : EVENT_THEMES[eventTheme];

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("network_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["network-settings"] });
      toast.success("Theme setting saved.");
    } catch {
      toast.error("Could not save the theme setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <Palette className="size-5 text-cyan-400" /> Themes
        </h1>
        <p className="mt-1 text-xs text-slate-500">Control seasonal styling across the customer portal.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="admin-card space-y-4 p-4">
          <div>
            <h2 className="text-sm font-bold text-white">Portal event theme</h2>
            <p className="mt-1 text-xs text-slate-500">Controls the client portal banner and seasonal backdrop.</p>
          </div>
          <Select value={eventTheme} disabled={saving} onValueChange={(value) => void saveSetting("dashboard_event_theme", value)}>
            <SelectTrigger aria-label="Portal event theme" className="border-slate-700 bg-slate-900 text-sm text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="christmas">Christmas Snow</SelectItem>
              <SelectItem value="new-year">New Year</SelectItem>
              <SelectItem value="easter">Easter</SelectItem>
            </SelectContent>
          </Select>
          <div className={`relative isolate min-h-24 overflow-hidden rounded-lg border p-4 ${activeTheme?.bannerClass ?? "border-slate-700 bg-slate-900/70"}`}>
            {activeTheme ? (
              <>
                <activeTheme.icon className={`absolute -right-2 -top-4 size-24 opacity-[0.12] ${activeTheme.accentClass}`} aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                  <activeTheme.icon className={`size-5 shrink-0 ${activeTheme.accentClass}`} aria-hidden="true" />
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${activeTheme.accentClass}`}>{activeTheme.label}</p>
                    <p className="mt-0.5 text-sm font-bold text-white">{activeTheme.title}</p>
                    <p className="text-xs text-slate-300">{activeTheme.message}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Standard portal appearance</p>
            )}
          </div>
        </section>

        <section className="admin-card space-y-4 p-4">
          <div>
            <h2 className="text-sm font-bold text-white">Client portal logo</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a festive mark to display over the PalNet logo.</p>
          </div>
          <Select value={logoTreatment} disabled={saving} onValueChange={(value) => void saveSetting("dashboard_logo_treatment", value)}>
            <SelectTrigger aria-label="Client portal logo treatment" className="border-slate-700 bg-slate-900 text-sm text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard logo</SelectItem>
              <SelectItem value="santa-hat">Santa hat</SelectItem>
              <SelectItem value="new-year">New Year</SelectItem>
              <SelectItem value="easter">Easter</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex min-h-24 items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
            <div className="relative size-14 shrink-0">
              <div className="size-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                <img src="/favicon.png" alt="PalNet logo preview" className="size-full object-cover" />
              </div>
              {logoTreatment === "santa-hat" && (
                <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 z-10 h-7 w-8 rotate-[22deg]">
                  <span className="absolute bottom-1 left-1 h-5 w-6 rounded-t-full bg-red-600 shadow-sm [clip-path:polygon(0_100%,100%_100%,72%_0)]" />
                  <span className="absolute bottom-0 left-0 h-2 w-6 rounded-full bg-white shadow-sm" />
                  <span className="absolute right-0 top-0 size-2.5 rounded-full bg-white shadow-sm" />
                </span>
              )}
              {logoTreatment === "new-year" && <PartyPopper className="absolute -right-1 -top-1 size-7 rounded-full border border-amber-200/70 bg-amber-400 p-1 text-amber-950 shadow-md" aria-hidden="true" />}
              {logoTreatment === "easter" && <Flower2 className="absolute -right-1 -top-1 size-7 rounded-full border border-emerald-100/70 bg-emerald-400 p-1 text-emerald-950 shadow-md" aria-hidden="true" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">PalNet Wi-Fi</p>
              <p className="text-xs text-slate-400">Customer portal logo preview</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}