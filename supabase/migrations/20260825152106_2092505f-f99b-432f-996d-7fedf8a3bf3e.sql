-- A bin for offers and contracts.
--
-- Drafts get started and abandoned: a rate that changed, a role that moved, a
-- composer opened by mistake. Withdrawn and declined offers pile up the same
-- way. None of it should be destroyed, because the record of what was proposed
-- matters, but it should not sit in the way of the live work either. So the
-- same pattern the opportunities list already uses: move it to the bin, see it
-- when you ask for it, restore it if you were wrong.

ALTER TABLE public.mu_offers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

ALTER TABLE public.mu_contracts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

CREATE INDEX IF NOT EXISTS mu_offers_deleted_idx ON public.mu_offers(deleted_at);
CREATE INDEX IF NOT EXISTS mu_contracts_deleted_idx ON public.mu_contracts(deleted_at);

-- The candidate never sees a binned offer, on top of never seeing a draft.
CREATE OR REPLACE FUNCTION public.mu_my_offers()
RETURNS TABLE(id uuid, kind text, title text, location text, rate_note text, message text, pattern text, start_date date, status text, expires_at timestamp with time zone, created_at timestamp with time zone, responded_at timestamp with time zone, decline_reason text, shifts jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.id, o.kind, o.title, o.location, o.rate_note, o.message, o.pattern,
         o.start_date, o.status, o.expires_at, o.created_at, o.responded_at, o.decline_reason,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('slot_date', s.slot_date, 'start_hour', s.start_hour,
                                               'end_hour', s.end_hour, 'location', s.location)
                            ORDER BY s.slot_date)
           FROM public.mu_offer_shifts s WHERE s.offer_id = o.id
         ), '[]'::jsonb)
  FROM public.mu_offers o
  WHERE o.person_id = public.mu_my_person_id()
    AND o.status <> 'draft'
    AND o.deleted_at IS NULL
  ORDER BY o.created_at DESC
$function$;

-- Binning an offer, with the rule that anything a candidate is currently
-- holding must be withdrawn first rather than quietly disappearing on them.
CREATE OR REPLACE FUNCTION public.mu_bin_offer(_offer_id uuid, _bin boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o public.mu_offers%ROWTYPE;
  who text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO o FROM public.mu_offers WHERE id = _offer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That offer no longer exists.');
  END IF;

  IF _bin THEN
    IF o.status IN ('sent', 'viewed') THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'They are still holding this offer. Withdraw it first, then it can go to the bin.');
    END IF;
    IF o.status = 'accepted' THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'An accepted offer is a record of what was agreed and stays on the profile.');
    END IF;

    SELECT coalesce(display_name, email) INTO who
      FROM public.admin_permissions WHERE user_id = auth.uid();

    UPDATE public.mu_offers
       SET deleted_at = now(), deleted_by = who
     WHERE id = _offer_id;
  ELSE
    UPDATE public.mu_offers
       SET deleted_at = NULL, deleted_by = NULL
     WHERE id = _offer_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Binning a contract. Anything issued, signed or live is paper that exists in
-- the world, so it can only be voided or ended, never binned.
CREATE OR REPLACE FUNCTION public.mu_bin_contract(_contract_id uuid, _bin boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.mu_contracts%ROWTYPE;
  who text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO c FROM public.mu_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That contract no longer exists.');
  END IF;

  IF _bin AND c.status NOT IN ('draft', 'withdrawn', 'void', 'voided', 'declined', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'This contract has left the office. Void or end it instead of binning it.');
  END IF;

  IF _bin THEN
    SELECT coalesce(display_name, email) INTO who
      FROM public.admin_permissions WHERE user_id = auth.uid();
    UPDATE public.mu_contracts SET deleted_at = now(), deleted_by = who WHERE id = _contract_id;
  ELSE
    UPDATE public.mu_contracts SET deleted_at = NULL, deleted_by = NULL WHERE id = _contract_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mu_bin_offer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mu_bin_contract(uuid, boolean) TO authenticated;
