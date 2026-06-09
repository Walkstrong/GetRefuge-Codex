CREATE TABLE IF NOT EXISTS public.encrypted_record_ai_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_check_id UUID NOT NULL UNIQUE,
  record_id UUID NOT NULL REFERENCES public.encrypted_records(record_id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  encrypted_analysis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_checks_record
  ON public.encrypted_record_ai_checks(record_id);

CREATE INDEX IF NOT EXISTS idx_ai_checks_org
  ON public.encrypted_record_ai_checks(org_id);

ALTER TABLE public.encrypted_record_ai_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own_org_ai_checks"
  ON public.encrypted_record_ai_checks FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "users_read_org_ai_checks"
  ON public.encrypted_record_ai_checks FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

GRANT SELECT, INSERT ON public.encrypted_record_ai_checks TO authenticated;
