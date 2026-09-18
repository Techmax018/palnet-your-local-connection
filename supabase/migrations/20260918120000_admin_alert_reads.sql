-- Create table to persist admin alert read receipts
CREATE TABLE IF NOT EXISTS public.admin_alert_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  alert_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicates per admin+alert
CREATE UNIQUE INDEX IF NOT EXISTS admin_alert_reads_admin_alert_idx ON public.admin_alert_reads (admin_id, alert_id);

ALTER TABLE public.admin_alert_reads ENABLE ROW LEVEL SECURITY;

-- Policy: allow the authenticated user to read/insert/update their own rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_alert_reads' AND policyname = 'admin_alert_reads_self'
  ) THEN
    EXECUTE 'CREATE POLICY admin_alert_reads_self ON public.admin_alert_reads
             FOR ALL TO authenticated USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid())';
  END IF;
END$$;

-- Policy: allow the service_role full access (for admin tools using service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_alert_reads' AND policyname = 'admin_alert_reads_service'
  ) THEN
    EXECUTE 'CREATE POLICY admin_alert_reads_service ON public.admin_alert_reads FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END$$;
