ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS provider_reference text;
CREATE INDEX IF NOT EXISTS transactions_provider_reference_idx ON public.transactions (provider_reference);