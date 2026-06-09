GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT, INSERT ON public.encrypted_records TO authenticated;
GRANT SELECT, INSERT ON public.encrypted_photos TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
