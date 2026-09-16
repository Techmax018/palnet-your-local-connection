-- Ensure guest-support columns exist (idempotent)
ALTER TABLE public.user_subscriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS device_label text;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS mac_address text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS device_label text;

CREATE INDEX IF NOT EXISTS user_subscriptions_mac_idx   ON public.user_subscriptions (mac_address);
CREATE INDEX IF NOT EXISTS user_subscriptions_phone_idx ON public.user_subscriptions (phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_idx ON public.transactions (transaction_reference);

-- -----------------------------------------------------------------------
-- Full canonical plan list. INSERT … WHERE NOT EXISTS keeps it idempotent.
-- -----------------------------------------------------------------------

-- Hotspot Quick Passes
INSERT INTO public.internet_plans (name, category, duration_type, duration_value, download_limit_mb, speed_limit_mbps, price_kes, is_active)
SELECT v.name, 'hotspot', v.dtype, v.dval, NULL, v.speed, v.price, true
FROM (VALUES
  ('30-Minute Pass',   'minutes', 30,  5,  5),
  ('1-Hour Pass',      'hours',    1,  5,  8),
  ('2-Hour Pass',      'hours',    2,  5, 10),
  ('4-Hour Pass',      'hours',    4,  8, 15),
  ('12-Hour Pass',     'hours',   12,  8, 20),
  ('24-Hour Pass',     'hours',   24,  8, 35)
) AS v(name, dtype, dval, speed, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.internet_plans p WHERE p.name = v.name AND p.category = 'hotspot'
);

-- Home Internet Unlimited
INSERT INTO public.internet_plans (name, category, duration_type, duration_value, download_limit_mb, speed_limit_mbps, price_kes, is_active)
SELECT v.name, 'home', v.dtype, v.dval, NULL, v.speed, v.price, true
FROM (VALUES
  ('3-Day Home Pass',       'days',  3, 15,   180),
  ('Weekly Unlimited',      'days',  7, 10,   350),
  ('2-Week Unlimited',      'days', 14, 20,   650),
  ('Monthly Unlimited',     'days', 30, 15, 1200)
) AS v(name, dtype, dval, speed, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.internet_plans p WHERE p.name = v.name AND p.category = 'home'
);

-- Smart TV & Streaming Packages
INSERT INTO public.internet_plans (name, category, duration_type, duration_value, download_limit_mb, speed_limit_mbps, price_kes, is_active)
SELECT v.name, 'tv', v.dtype, v.dval, NULL, v.speed, v.price, true
FROM (VALUES
  ('24-Hour TV Stream Pass', 'hours', 24, 12,   50),
  ('3-Day TV Stream Pass',   'days',   3, 15,  120),
  ('Weekly TV Stream Pass',  'days',   7, 12,  250),
  ('Monthly TV Stream Pass', 'days',  30, 20,  850)
) AS v(name, dtype, dval, speed, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.internet_plans p WHERE p.name = v.name AND p.category = 'tv'
);

-- RLS: allow anon/service_role to read & insert guest transactions
DROP POLICY IF EXISTS "tx_anon_insert" ON public.transactions;
CREATE POLICY "tx_anon_insert" ON public.transactions FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "tx_anon_select_own_ref" ON public.transactions;
CREATE POLICY "tx_anon_select_own_ref" ON public.transactions FOR SELECT TO anon
  USING (user_id IS NULL);

-- RLS: allow anon to read active guest subscriptions (for session lookup)
DROP POLICY IF EXISTS "subs_anon_select_guest" ON public.user_subscriptions;
CREATE POLICY "subs_anon_select_guest" ON public.user_subscriptions FOR SELECT TO anon
  USING (user_id IS NULL AND status = 'active');

DROP POLICY IF EXISTS "subs_anon_insert_guest" ON public.user_subscriptions;
CREATE POLICY "subs_anon_insert_guest" ON public.user_subscriptions FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "subs_anon_update_guest" ON public.user_subscriptions;
CREATE POLICY "subs_anon_update_guest" ON public.user_subscriptions FOR UPDATE TO anon
  USING (user_id IS NULL);
