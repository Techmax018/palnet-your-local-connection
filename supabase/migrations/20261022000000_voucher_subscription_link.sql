ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS subscription_id uuid
  REFERENCES public.user_subscriptions(id) ON DELETE SET NULL;