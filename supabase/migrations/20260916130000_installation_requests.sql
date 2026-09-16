-- installation_requests table
CREATE TABLE IF NOT EXISTS public.installation_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        text NOT NULL,
  phone_number     text NOT NULL,
  house_number     text NOT NULL,
  preferred_plan_id uuid REFERENCES public.internet_plans(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','contacted','installed','cancelled')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.installation_requests ENABLE ROW LEVEL SECURITY;

-- Anon can insert (guest form submission)
CREATE POLICY "installs_anon_insert" ON public.installation_requests
  FOR INSERT TO anon WITH CHECK (true);

-- Only service role / admin can read
CREATE POLICY "installs_service_select" ON public.installation_requests
  FOR SELECT TO service_role USING (true);

CREATE INDEX IF NOT EXISTS installation_requests_status_idx
  ON public.installation_requests (status);
CREATE INDEX IF NOT EXISTS installation_requests_phone_idx
  ON public.installation_requests (phone_number);
