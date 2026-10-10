-- Care offers: what a family is offered, and what they accepted.
--
-- An offer holds one or more priced options (for example one nurse, or two),
-- what is included, how payment works and an exact copy of the terms. Staff
-- build it as a draft; once sent, its content and terms are fixed, so what the
-- family accepts is exactly what they were sent. A changed offer is a new
-- offer.
--
-- The family opens it through a link. Each send makes its own link (email,
-- WhatsApp, copied), only the hash is kept, and every link stops working when
-- the offer is withdrawn, accepted elsewhere or expires. Acceptance records
-- the option, how they will pay, the name they typed, the time, and the terms
-- version.

CREATE TABLE IF NOT EXISTS public.care_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'withdrawn')),
  content jsonb NOT NULL,
  terms_version text NOT NULL,
  terms jsonb NOT NULL,
  expires_at timestamptz,
  sent_at timestamptz,
  first_opened_at timestamptz,
  accepted_option text,
  accepted_payment text CHECK (accepted_payment IN ('monthly', 'upfront')),
  accepted_name text,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  withdrawn_at timestamptz,
  withdrawn_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_offers_client_idx ON public.care_offers (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.care_offer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.care_offers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'copied')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_opened_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS care_offer_links_offer_idx ON public.care_offer_links (offer_id);

ALTER TABLE public.care_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_offer_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY care_offers_admin ON public.care_offers FOR ALL TO authenticated
    USING (private.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY care_offer_links_admin_read ON public.care_offer_links FOR SELECT TO authenticated
    USING (private.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- What was sent is what is accepted.
CREATE OR REPLACE FUNCTION private.care_offer_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF OLD.status <> 'draft' AND (NEW.content IS DISTINCT FROM OLD.content
      OR NEW.terms IS DISTINCT FROM OLD.terms OR NEW.terms_version IS DISTINCT FROM OLD.terms_version) THEN
    RAISE EXCEPTION 'An offer that has been sent cannot be changed. Withdraw it and make a new one.';
  END IF;
  IF OLD.status = 'accepted' AND NEW.status NOT IN ('accepted') THEN
    RAISE EXCEPTION 'An accepted offer stays accepted.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER care_offer_guard BEFORE UPDATE ON public.care_offers
FOR EACH ROW EXECUTE FUNCTION private.care_offer_guard();

-- The next offer reference for a client: MC-2610-0102-O1, -O2 and so on.
CREATE OR REPLACE FUNCTION public.care_offer_create(_client_id uuid, _content jsonb, _terms_version text, _terms jsonb, _expires_at timestamptz)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _ref text; _n integer; _id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT enquiry_number INTO _ref FROM public.clients WHERE id = _client_id;
  IF _ref IS NULL THEN RAISE EXCEPTION 'That client has no reference yet'; END IF;
  SELECT count(*) + 1 INTO _n FROM public.care_offers WHERE client_id = _client_id;
  INSERT INTO public.care_offers (client_id, reference, content, terms_version, terms, expires_at, created_by)
  VALUES (_client_id, _ref || '-O' || _n, _content, _terms_version, _terms, _expires_at, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_client_id, 'offer_created', jsonb_build_object('offer_id', _id, 'reference', _ref || '-O' || _n), auth.uid());
  RETURN _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.care_offer_create(uuid, jsonb, text, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_offer_create(uuid, jsonb, text, jsonb, timestamptz) TO authenticated;
