ALTER TABLE public.user_subscriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS device_label text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS mac_address text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS device_label text;

CREATE INDEX IF NOT EXISTS user_subscriptions_mac_idx ON public.user_subscriptions (mac_address);
CREATE INDEX IF NOT EXISTS user_subscriptions_phone_idx ON public.user_subscriptions (phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_idx ON public.transactions (transaction_reference);

INSERT INTO public.internet_plans (name, category, duration_type, duration_value, download_limit_mb, speed_limit_mbps, price_kes, is_active)
SELECT v.name, v.category, v.duration_type, v.duration_value, NULL, v.speed, v.price, true
FROM (VALUES
  ('1-Hour Pass', 'hotspot', 'hours', 1, 5, 8),
  ('24-Hour Pass', 'hotspot', 'hours', 24, 8, 35),
  ('3-Day Home Pass', 'home', 'days', 3, 15, 180),
  ('2-Week Home Unlimited', 'home', 'days', 14, 20, 650),
  ('24-Hour TV Stream Pass', 'tv', 'hours', 24, 12, 50),
  ('3-Day TV Stream Pass', 'tv', 'days', 3, 15, 120)
) AS v(name, category, duration_type, duration_value, speed, price)
WHERE NOT EXISTS (SELECT 1 FROM public.internet_plans p WHERE p.name = v.name);