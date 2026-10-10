-- Care payments through Paystack checkout, so the family comes back to their
-- offer page once they have paid, and is thanked by email.
--
-- A care payment is still filed as an invoice. Paying it opens a Paystack
-- checkout made on the spot; its reference is kept here so the payment can be
-- confirmed with Paystack directly (on return, by the webhook, or by the daily
-- job) rather than relying on any one of them. The thank-you is sent once.

ALTER TABLE public.paystack_invoices ADD COLUMN IF NOT EXISTS paystack_reference text;
ALTER TABLE public.paystack_invoices ADD COLUMN IF NOT EXISTS care_thanked_at timestamptz;
CREATE INDEX IF NOT EXISTS paystack_invoices_paystack_reference_idx
  ON public.paystack_invoices (paystack_reference) WHERE paystack_reference IS NOT NULL;
