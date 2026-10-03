-- Part A: a service can serve several client groups, and a line can carry a
-- note explaining why it does not take a pre-assessment of its own.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS client_groups text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS notes text;

-- Part C: a readable client reference. Sequential, so the reference alone is
-- guessable, which is why the link carries a secret alongside it.
CREATE SEQUENCE IF NOT EXISTS public.client_reference_seq;

CREATE OR REPLACE FUNCTION public.clients_set_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.enquiry_number IS NULL OR btrim(NEW.enquiry_number) = '' THEN
    NEW.enquiry_number :=
      'MC-' || to_char(now(), 'YYMM') || '-' ||
      lpad(nextval('public.client_reference_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_set_reference_trg ON public.clients;
CREATE TRIGGER clients_set_reference_trg
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_set_reference();

-- Backfill every client that predates the reference.
UPDATE public.clients
SET enquiry_number = 'MC-' || to_char(created_at, 'YYMM') || '-' ||
                     lpad(nextval('public.client_reference_seq')::text, 4, '0')
WHERE enquiry_number IS NULL OR btrim(enquiry_number) = '';

-- Part D: the client activity stream, mirroring mu_activity.
CREATE TABLE IF NOT EXISTS public.care_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_activity_client_id_idx ON public.care_activity (client_id, created_at DESC);
GRANT SELECT, INSERT ON public.care_activity TO authenticated;
GRANT ALL ON public.care_activity TO service_role;
ALTER TABLE public.care_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care activity" ON public.care_activity FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write care activity" ON public.care_activity FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Part D: an amendment sits beside the original answer, it never replaces it,
-- because the nurse needs to know what the family actually said.
CREATE TABLE IF NOT EXISTS public.care_response_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.care_documents(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  original_value jsonb,
  corrected_value jsonb,
  reason text NOT NULL,
  amended_by uuid,
  amended_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_response_amendments_document_idx
  ON public.care_response_amendments (document_id, created_at DESC);
GRANT SELECT, INSERT ON public.care_response_amendments TO authenticated;
GRANT ALL ON public.care_response_amendments TO service_role;
ALTER TABLE public.care_response_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read care amendments" ON public.care_response_amendments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins write care amendments" ON public.care_response_amendments FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Part D: realtime, so a returned form lands on the open record.
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.client_contacts REPLICA IDENTITY FULL;
ALTER TABLE public.client_commercial REPLICA IDENTITY FULL;
ALTER TABLE public.care_documents REPLICA IDENTITY FULL;
ALTER TABLE public.care_access_tokens REPLICA IDENTITY FULL;
ALTER TABLE public.care_flags REPLICA IDENTITY FULL;
ALTER TABLE public.care_activity REPLICA IDENTITY FULL;
