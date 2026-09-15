import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/palnet";

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
