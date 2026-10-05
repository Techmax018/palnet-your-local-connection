export type PlanCategory = "hotspot" | "home" | "tv";

export type Plan = {
  id: string;
  name: string;
  category: string;
  duration_type: string;
  duration_value: number;
  download_limit_mb: number | null;
  speed_limit_mbps: number;
  price_kes: number;
  is_active: boolean;
};

export function planMinutes(plan: Pick<Plan, "duration_type" | "duration_value">): number {
  if (plan.duration_type === "minutes") return plan.duration_value;
  if (plan.duration_type === "hours") return plan.duration_value * 60;
  return plan.duration_value * 60 * 24;
}

export function planDurationLabel(plan: Pick<Plan, "duration_type" | "duration_value">): string {
  const unit =
    plan.duration_type === "minutes" ? "Minute" : plan.duration_type === "hours" ? "Hour" : "Day";
  return `${plan.duration_value} ${unit}${plan.duration_value === 1 ? "" : "s"}`;
}

export function formatKes(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  hotspot: "Hotspot Passes",
  home: "Home Unlimited",
  tv: "TV & Streaming",
};

/** Hotspot credentials derived from a subscription id (synced to routers). */
export function hotspotCredentials(subscriptionId: string) {
  const hex = subscriptionId.replace(/-/g, "");
  return { username: `pn${hex.slice(0, 10)}`, password: hex.slice(-12) };
}

const fp = (id: string, name: string, category: string, duration_type: string, duration_value: number, speed: number, price: number): Plan => ({
  id, name, category, duration_type, duration_value, download_limit_mb: null, speed_limit_mbps: speed, price_kes: price, is_active: true,
});

/** Shown when the live package list can't be reached (e.g. blocked by the hotspot). */
export const FALLBACK_PLANS: Plan[] = [
  fp("b641f759-8b96-4835-8193-7ba1b242a963", "30-Minute Pass", "hotspot", "minutes", 30, 5, 5),
  fp("621c6e79-5802-4ba3-abd7-7df4cf70febc", "2-Hour Pass", "hotspot", "hours", 2, 5, 10),
  fp("c05742bf-f5ac-491c-90dd-01f72ba68c78", "4-Hour Pass", "hotspot", "hours", 4, 8, 15),
  fp("d7f6ce6b-487a-439e-9f5e-a63f7c22edef", "12-Hour Pass", "hotspot", "hours", 12, 8, 20),
  fp("4d3f0a07-5696-41d7-ac4c-b197eabb943f", "24-Hour Pass", "hotspot", "hours", 24, 8, 35),
  fp("2622082f-403f-424d-9f05-6bbb247ad1d6", "3-day pass", "hotspot", "days", 3, 5, 50),
  fp("af7445b3-9048-472f-b235-aacedf2012af", "3-Day Home Pass", "home", "days", 3, 15, 180),
  fp("c042b155-05a2-4385-9900-860e88f4945c", "Weekly Home Unlimited", "home", "days", 7, 10, 350),
  fp("9b71cfc0-d830-4fe7-976b-7bf61e307835", "2-Week Home Unlimited", "home", "days", 14, 20, 650),
  fp("d579204c-785d-48d1-9981-51725f3af47f", "Monthly Home Unlimited", "home", "days", 30, 15, 1200),
  fp("0ab81049-c266-49fd-9873-c9fc026dfbdd", "24-Hour TV Stream Pass", "tv", "hours", 24, 12, 50),
  fp("f985618a-1474-41da-9d03-91843645d1eb", "3-Day TV Stream Pass", "tv", "days", 3, 15, 120),
  fp("bb3a7f4d-af17-4073-8edd-de2a2e1949c1", "Weekly TV Stream Pass", "tv", "days", 7, 12, 250),
  fp("f8f77bc7-1d93-40ae-aa18-365a1c8fc191", "Monthly TV Stream Pass", "tv", "days", 30, 20, 850),
];
