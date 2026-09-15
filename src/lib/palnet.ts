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
