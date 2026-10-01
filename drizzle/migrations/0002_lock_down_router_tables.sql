DROP POLICY IF EXISTS "Allow service/public read tokens" ON public.provision_tokens;
DROP POLICY IF EXISTS "Allow service/public write tokens" ON public.provision_tokens;
CREATE POLICY provision_tokens_admin_all ON public.provision_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow service/public write heartbeats" ON public.router_heartbeats;
CREATE POLICY heartbeats_admin_read ON public.router_heartbeats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow service/public read routers" ON public.routers;
DROP POLICY IF EXISTS "Allow service/public write routers" ON public.routers;

DROP POLICY IF EXISTS policy_admin_manage_system_settings ON public.system_settings;
CREATE POLICY system_settings_admin_all ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));