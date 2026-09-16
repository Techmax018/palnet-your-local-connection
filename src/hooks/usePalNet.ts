import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/palnet";
import { lookupGuestSession } from "@/lib/palnet.functions";
import type { GuestSession } from "@/lib/palnet.functions";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internet_plans")
        .select("*")
        .order("price_kes", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });
}

export type ActiveSession = {
  id: string;
  end_time: string;
  start_time: string;
  mac_address: string | null;
  ip_address: string | null;
  status: string;
  internet_plans: { name: string; category: string; speed_limit_mbps: number } | null;
  routers: { name: string; location: string | null } | null;
};

export function useMySession(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-session", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(
          "id, start_time, end_time, mac_address, ip_address, status, internet_plans(name, category, speed_limit_mbps), routers(name, location)",
        )
        .eq("user_id", userId!)
        .eq("status", "active")
        .gt("end_time", new Date().toISOString())
        .order("end_time", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ActiveSession | null;
    },
  });
}

/**
 * Reads MAC and IP from URL search params first (?mac=…&ip=…), then falls
 * back to a browser-local device fingerprint stored in localStorage.
 */
export function getUrlDevice(): { mac: string | null; ip: string | null } {
  if (typeof window === "undefined") return { mac: null, ip: null };
  const params = new URLSearchParams(window.location.search);
  return {
    mac: params.get("mac"),
    ip: params.get("ip"),
  };
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const key = "palnet_did";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");
    localStorage.setItem(key, id);
  }
  return id;
}

/** Returns the best MAC address: URL param → localStorage fingerprint. */
export function getDeviceMac(): string | null {
  if (typeof window === "undefined") return null;
  return getUrlDevice().mac ?? getDeviceId() ?? null;
}

/** Returns IP from URL param if present. */
export function getDeviceIp(): string | null {
  if (typeof window === "undefined") return null;
  return getUrlDevice().ip ?? null;
}

export { type GuestSession };

export function useGuestSession(enabled = true) {
  const lookup = useServerFn(lookupGuestSession);
  return useQuery({
    queryKey: ["guest-session"],
    enabled,
    refetchInterval: 30_000,
    queryFn: async (): Promise<GuestSession | null> => {
      const mac = getDeviceMac();
      if (!mac) return null;
      return lookup({ data: { macAddress: mac } });
    },
  });
}

export type NormalizedSession = GuestSession & { isGuest: boolean };

/**
 * Returns the best active session: logged-in user session takes precedence,
 * then guest device lookup.
 */
export function useActiveSession(userId: string | undefined) {
  const userSession = useMySession(userId);
  const guestSession = useGuestSession(!userId);

  if (userId) {
    return {
      data: userSession.data
        ? ({
            id: userSession.data.id,
            end_time: userSession.data.end_time,
            start_time: userSession.data.start_time,
            mac_address: userSession.data.mac_address,
            ip_address: userSession.data.ip_address,
            status: userSession.data.status,
            plan_name: userSession.data.internet_plans?.name ?? null,
            plan_category: userSession.data.internet_plans?.category ?? null,
            speed_limit_mbps: userSession.data.internet_plans?.speed_limit_mbps ?? null,
            router_name: userSession.data.routers?.name ?? null,
            device_label: null,
            isGuest: false,
          } satisfies NormalizedSession)
        : null,
      isLoading: userSession.isLoading,
    };
  }

  return {
    data: guestSession.data ? ({ ...guestSession.data, isGuest: true } satisfies NormalizedSession) : null,
    isLoading: guestSession.isLoading,
  };
}
