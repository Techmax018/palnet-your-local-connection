CREATE TABLE public.installation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  house_number text NOT NULL,
  preferred_plan_id uuid REFERENCES public.internet_plans(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_requests TO authenticated;
GRANT ALL ON public.installation_requests TO service_role;

ALTER TABLE public.installation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY install_admin_all ON public.installation_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.network_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.network_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_settings TO authenticated;
GRANT ALL ON public.network_settings TO service_role;

ALTER TABLE public.network_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY netsettings_public_read ON public.network_settings
  FOR SELECT USING (true);

CREATE POLICY netsettings_admin_write ON public.network_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.user_subscriptions
  ADD COLUMN previous_mac_address text,
  ADD COLUMN user_agent text,
  ADD COLUMN last_reconnect_at timestamptz,
  ADD COLUMN suspicious_tethering boolean NOT NULL DEFAULT false,
  ADD COLUMN tether_attempts_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.vouchers
  ADD COLUMN subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL;

INSERT INTO public.network_settings (key, value) VALUES
  ('anti_tethering_enabled', 'false'),
  ('max_devices_per_session', '1'),
  ('hotspot_ssid', 'PalNet-WiFi')
ON CONFLICT (key) DO NOTHING;