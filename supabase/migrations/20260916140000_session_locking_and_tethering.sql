-- ───────────────────────────────────────────────────
-- Session locking, reconnect tracking, anti-tethering
-- ───────────────────────────────────────────────────

-- user_subscriptions additions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS previous_mac_address    text,
  ADD COLUMN IF NOT EXISTS last_reconnect_at        timestamptz,
  ADD COLUMN IF NOT EXISTS user_agent               text,
  ADD COLUMN IF NOT EXISTS suspicious_tethering     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tether_attempts_count    integer NOT NULL DEFAULT 0;

-- Index for fast suspicious-session queries in admin panel
CREATE INDEX IF NOT EXISTS subs_suspicious_idx
  ON public.user_subscriptions (suspicious_tethering)
  WHERE suspicious_tethering = true;

-- ─── network_settings table (stores global toggles such as anti-tethering) ───
CREATE TABLE IF NOT EXISTS public.network_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the anti-tethering toggle (off by default)
INSERT INTO public.network_settings (key, value)
VALUES ('anti_tethering_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.network_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_service_all" ON public.network_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon/authenticated can read (needed to show the tethering screen client-side)
CREATE POLICY "settings_anon_read" ON public.network_settings
  FOR SELECT TO anon, authenticated USING (true);
