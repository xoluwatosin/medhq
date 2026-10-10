-- Monthly payments for an accepted care offer.
--
-- When a family pays monthly, staff set the date care actually starts. That
-- lays out one payment per month from that date. The first is the payment
-- the family was already given a link for when they accepted. A daily job
-- makes the Paystack link for each later month five days before it is due
-- and emails it to the family with the bank details. Paystack payments mark
-- their invoice paid through the existing webhook, so a payment's state is
-- read from its invoice.

ALTER TABLE public.care_offers ADD COLUMN IF NOT EXISTS care_starts_on date;

CREATE TABLE IF NOT EXISTS public.care_offer_instalments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.care_offers(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number >= 1),
  due_on date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  invoice_id uuid REFERENCES public.paystack_invoices(id) ON DELETE SET NULL,
  pay_url text,
  issued_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, number)
);
ALTER TABLE public.care_offer_instalments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY care_offer_instalments_admin_read ON public.care_offer_instalments FOR SELECT TO authenticated
    USING (private.has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Staff set the day care starts; the monthly payments follow from it. A
-- payment already issued keeps its date and link; the rest move.
CREATE OR REPLACE FUNCTION public.care_offer_set_start(_offer_id uuid, _starts_on date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _o public.care_offers%ROWTYPE;
  _months integer;
  _monthly numeric;
  _n integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO _o FROM public.care_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF _o.status <> 'accepted' THEN RAISE EXCEPTION 'Set the start date once the offer has been accepted'; END IF;
  IF _starts_on IS NULL THEN RAISE EXCEPTION 'Choose the day care starts'; END IF;

  UPDATE public.care_offers SET care_starts_on = _starts_on WHERE id = _offer_id;

  IF _o.accepted_payment <> 'monthly' THEN RETURN 0; END IF;

  _months := COALESCE((_o.content ->> 'months')::integer, 0);
  SELECT (opt ->> 'monthly')::numeric INTO _monthly
    FROM jsonb_array_elements(_o.content -> 'options') opt
   WHERE opt ->> 'id' = _o.accepted_option;
  IF _months < 1 OR _monthly IS NULL THEN RAISE EXCEPTION 'This offer has no monthly price to bill'; END IF;

  FOR _n IN 1.._months LOOP
    INSERT INTO public.care_offer_instalments (offer_id, number, due_on, amount, invoice_id, pay_url, issued_at)
    VALUES (_offer_id, _n, (_starts_on + make_interval(months => _n - 1))::date, _monthly,
            CASE WHEN _n = 1 THEN _o.invoice_id END,
            CASE WHEN _n = 1 THEN _o.pay_url END,
            CASE WHEN _n = 1 AND _o.invoice_id IS NOT NULL THEN _o.accepted_at END)
    ON CONFLICT (offer_id, number) DO UPDATE
      SET due_on = EXCLUDED.due_on
      WHERE public.care_offer_instalments.invoice_id IS NULL;
  END LOOP;

  INSERT INTO public.care_activity (client_id, action, detail, actor_id)
  VALUES (_o.client_id, 'care_start_set',
          jsonb_build_object('offer_id', _offer_id, 'starts_on', _starts_on, 'months', _months), auth.uid());
  RETURN _months;
END;
$function$;

REVOKE ALL ON FUNCTION public.care_offer_set_start(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_offer_set_start(uuid, date) TO authenticated;

-- Each morning at about 8am Lagos time.
SELECT cron.schedule('care-offer-billing', '5 7 * * *', $$
  select net.http_post(
    url := (select value from private.app_config where key = 'functions_url') || '/care-offer-billing',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from private.app_config where key = 'cron_secret')),
    body := '{}'::jsonb
  );
$$);
