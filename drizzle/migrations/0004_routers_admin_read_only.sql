DROP POLICY IF EXISTS routers_public_read ON public.routers;
CREATE POLICY routers_admin_read ON public.routers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));