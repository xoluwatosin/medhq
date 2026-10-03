-- Two layers: the engagement, then the work under it.
--
-- An offer and a contract are not two halves of one hire. An engagement is the
-- relationship, established once and papered once: employment, a fixed term
-- placement, or a bank and locum agreement covering a scope for a period. Work
-- offers are the shifts and assignments handed out underneath a live
-- engagement, each with its own dates and rate, and none of them needs new
-- paper. This separates the two on the offer record and ties the contract back
-- to the engagement offer it came from.

-- 1. The layer marker on the offer.
ALTER TABLE public.mu_offers
  ADD COLUMN IF NOT EXISTS engagement_type text,
  ADD COLUMN IF NOT EXISTS parent_offer_id uuid REFERENCES public.mu_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mu_offers_parent_idx ON public.mu_offers(parent_offer_id);
CREATE INDEX IF NOT EXISTS mu_offers_engagement_type_idx ON public.mu_offers(engagement_type);

-- Existing rows: anything with dated shifts was work, everything else stood in
-- for a placement.
UPDATE public.mu_offers o
   SET engagement_type = CASE
         WHEN EXISTS (SELECT 1 FROM public.mu_offer_shifts s WHERE s.offer_id = o.id) THEN 'shift'
         ELSE 'placement'
       END
 WHERE engagement_type IS NULL;

-- 2. The contract knows which engagement it papers.
ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.mu_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mu_contracts_offer_idx ON public.mu_contracts(offer_id);

-- 3. Sending an offer carries its layer.
CREATE OR REPLACE FUNCTION public.mu_send_offer(_payload jsonb, _shifts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  oid uuid;
  who text;
  etype text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT coalesce(display_name, email) INTO who FROM public.admin_permissions WHERE user_id = auth.uid();

  etype := coalesce(NULLIF(_payload->>'engagement_type',''), 'placement');

  IF etype IN ('shift','assignment') AND NULLIF(_payload->>'parent_offer_id','') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Work can only be offered under a live engagement. Establish the engagement first.');
  END IF;

  INSERT INTO public.mu_offers (
    person_id, opportunity_id, kind, title, location, rate_note, message,
    pattern, start_date, status, expires_at, sent_at, created_by, created_by_name, terms,
    engagement_type, parent_offer_id
  ) VALUES (
    (_payload->>'person_id')::uuid,
    NULLIF(_payload->>'opportunity_id','')::uuid,
    coalesce(_payload->>'kind','shift'),
    coalesce(_payload->>'title','Work offer'),
    NULLIF(_payload->>'location',''),
    NULLIF(_payload->>'rate_note',''),
    NULLIF(_payload->>'message',''),
    NULLIF(_payload->>'pattern',''),
    NULLIF(_payload->>'start_date','')::date,
    'sent',
    NULLIF(_payload->>'expires_at','')::timestamptz,
    now(), auth.uid(), who,
    coalesce(_payload->'terms', '{}'::jsonb),
    etype,
    NULLIF(_payload->>'parent_offer_id','')::uuid
  ) RETURNING id INTO oid;

  INSERT INTO public.mu_offer_shifts (offer_id, slot_date, start_hour, end_hour, location)
  SELECT oid,
         (s->>'slot_date')::date,
         coalesce((s->>'start_hour')::int, 8),
         coalesce((s->>'end_hour')::int, 20),
         NULLIF(s->>'location','')
  FROM jsonb_array_elements(coalesce(_shifts, '[]'::jsonb)) AS s;

  INSERT INTO public.mu_activity (person_id, actor_id, actor_name, action, detail)
  VALUES ((_payload->>'person_id')::uuid, auth.uid(), who, 'offer_sent',
          jsonb_build_object('offer_id', oid, 'kind', coalesce(_payload->>'kind','shift'),
                             'engagement_type', etype,
                             'title', coalesce(_payload->>'title','Work offer')));

  RETURN jsonb_build_object('ok', true, 'offer_id', oid);
END;
$function$;

-- 4. The candidate sees which layer an offer belongs to.
DROP FUNCTION IF EXISTS public.mu_my_offers();

CREATE FUNCTION public.mu_my_offers()
RETURNS TABLE(
  id uuid, kind text, title text, location text, rate_note text, message text, pattern text,
  start_date date, status text, expires_at timestamptz, created_at timestamptz,
  responded_at timestamptz, decline_reason text, terms jsonb,
  engagement_type text, parent_offer_id uuid, shifts jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.kind, o.title, o.location, o.rate_note, o.message, o.pattern,
         o.start_date, o.status, o.expires_at, o.created_at, o.responded_at, o.decline_reason,
         coalesce(o.terms, '{}'::jsonb),
         coalesce(o.engagement_type, 'placement'), o.parent_offer_id,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('slot_date', s.slot_date, 'start_hour', s.start_hour,
                                               'end_hour', s.end_hour, 'location', s.location)
                            ORDER BY s.slot_date)
           FROM public.mu_offer_shifts s WHERE s.offer_id = o.id
         ), '[]'::jsonb)
  FROM public.mu_offers o
  WHERE o.person_id = public.mu_my_person_id() AND o.status <> 'draft'
  ORDER BY o.created_at DESC
$function$;

GRANT EXECUTE ON FUNCTION public.mu_my_offers() TO authenticated;

-- 5. A contract can name the engagement offer it came from.
CREATE OR REPLACE FUNCTION public.mu_contract_create_from_library(_person_id uuid, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _clauses jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', key, 'heading', heading, 'body', body, 'section', section, 'locked', locked
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO _clauses
  FROM public.mu_contract_clause_library WHERE active;

  INSERT INTO public.mu_contracts (
    person_id, contract_type, job_title, department, start_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses, is_clinical, created_by, created_by_name, offer_id
  ) VALUES (
    _person_id,
    COALESCE(_payload->>'contract_type', 'full_time'),
    _payload->>'job_title',
    _payload->>'department',
    NULLIF(_payload->>'start_date','')::date,
    _payload->>'notice_period',
    NULLIF(_payload->>'pay_amount','')::numeric,
    COALESCE(_payload->>'pay_currency', 'NGN'),
    COALESCE(_payload->>'pay_frequency', 'monthly'),
    _payload->>'working_pattern',
    _payload->>'location',
    'draft',
    COALESCE(_payload->'fields', '{}'::jsonb),
    _clauses,
    COALESCE((_payload->>'is_clinical')::boolean, false),
    auth.uid(),
    _payload->>'created_by_name',
    NULLIF(_payload->>'offer_id','')::uuid
  ) RETURNING id INTO _id;

  PERFORM public.mu_contract_log(_id, 'created', 'Contract drafted from the clause library', '{}'::jsonb, _payload->>'created_by_name');
  RETURN _id;
END; $function$;

-- 6. Accepting an engagement drafts its paper. Nobody starts from a blank.
CREATE OR REPLACE FUNCTION public.mu_engagement_draft_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _clauses jsonb; _t jsonb; _id uuid;
BEGIN
  IF NEW.status <> 'accepted' OR coalesce(OLD.status,'') = 'accepted' THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.engagement_type,'placement') NOT IN ('employment','placement','bank') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.mu_contracts c WHERE c.offer_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _t := coalesce(NEW.terms, '{}'::jsonb);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'key', key, 'heading', heading, 'body', body, 'section', section, 'locked', locked
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO _clauses
  FROM public.mu_contract_clause_library WHERE active;

  INSERT INTO public.mu_contracts (
    person_id, offer_id, contract_type, job_title, start_date, end_date, notice_period,
    pay_amount, pay_currency, pay_frequency, working_pattern, location,
    status, fields, clauses
  ) VALUES (
    NEW.person_id, NEW.id,
    CASE NEW.engagement_type WHEN 'employment' THEN 'full_time'
                             WHEN 'placement' THEN 'fixed_term'
                             ELSE 'locum' END,
    NEW.title,
    NEW.start_date,
    NULLIF(_t->>'end_date','')::date,
    NULLIF(_t->>'notice_period',''),
    NULLIF(regexp_replace(coalesce(_t->>'pay_amount',''), '[^0-9.]', '', 'g'), '')::numeric,
    COALESCE(NULLIF(_t->>'pay_currency',''), 'NGN'),
    COALESCE(NULLIF(_t->>'pay_frequency',''), 'monthly'),
    NEW.pattern,
    NEW.location,
    'draft',
    jsonb_strip_nulls(jsonb_build_object(
      'offer_date', to_char(coalesce(NEW.sent_at, NEW.created_at), 'YYYY-MM-DD'),
      'job_title', NEW.title,
      'employment_basis', _t->>'basis',
      'weekly_hours', _t->>'weekly_hours',
      'notice_period', _t->>'notice_period',
      'primary_place_of_work', NEW.location,
      'reports_to', _t->>'reports_to',
      'primary_responsibilities', _t->>'duties'
    )),
    _clauses
  ) RETURNING id INTO _id;

  PERFORM public.mu_contract_log(_id, 'created', 'Drafted from the engagement they accepted', '{}'::jsonb, NULL);
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS mu_offers_draft_contract ON public.mu_offers;
CREATE TRIGGER mu_offers_draft_contract
  AFTER UPDATE OF status ON public.mu_offers
  FOR EACH ROW EXECUTE FUNCTION public.mu_engagement_draft_contract();
