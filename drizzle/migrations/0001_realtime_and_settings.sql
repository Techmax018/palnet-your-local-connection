ALTER TABLE public.routers REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.user_subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.vouchers REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.routers; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vouchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

INSERT INTO public.network_settings (key, value) VALUES
  ('hotspot_ssid', 'PalNet-WiFi'),
  ('support_phone', '0700000000'),
  ('max_devices_per_session', '1'),
  ('anti_tethering_enabled', 'false'),
  ('alert_voucher_low_threshold', '10'),
  ('alert_expiry_warning_minutes', '15'),
  ('alert_router_offline_enabled', 'true'),
  ('alert_failed_payment_enabled', 'true')
ON CONFLICT (key) DO NOTHING;