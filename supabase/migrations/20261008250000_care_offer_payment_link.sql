-- When a family accepts an offer, a Paystack invoice is made for exactly what
-- they chose (the first month, or every month upfront with the discount), and
-- its payment link is kept with the offer for the family's page and emails.
ALTER TABLE public.care_offers ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.paystack_invoices(id) ON DELETE SET NULL;
ALTER TABLE public.care_offers ADD COLUMN IF NOT EXISTS pay_url text;
