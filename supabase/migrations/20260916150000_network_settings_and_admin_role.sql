-- ─────────────────────────────────────────────────────────────────────────
-- network_settings table (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.network_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read (client needs to check anti_tethering_enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'network_settings' AND policyname = 'settings_anon_read'
  ) THEN
    EXECUTE 'CREATE POLICY settings_anon_read ON public.network_settings
             FOR SELECT TO anon, authenticated USING (true)';
  END IF;
END$$;

-- Only service_role can write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'network_settings' AND policyname = 'settings_service_write'
  ) THEN
    EXECUTE 'CREATE POLICY settings_service_write ON public.network_settings
             FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END$$;

-- Seed default values
INSERT INTO public.network_settings (key, value)
VALUES ('anti_tethering_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- Grant admin role to maxnjuguna18@gmail.com
-- Runs only if the auth user already exists (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'maxnjuguna18@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END$$;
