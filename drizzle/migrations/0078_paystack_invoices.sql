CREATE TABLE public.paystack_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  request_code text,
  offline_reference text,
  hosted_link text,
  paystack_id bigint,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_first_name text,
  client_last_name text,
  client_email text NOT NULL,
  client_phone text,
  type text NOT NULL DEFAULT 'standard',
  currency text NOT NULL DEFAULT 'NGN',
  vat_rate numeric NOT NULL DEFAULT 7.5,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX paystack_invoices_request_code_key ON public.paystack_invoices (request_code) WHERE request_code IS NOT NULL;
CREATE INDEX paystack_invoices_created_at_idx ON public.paystack_invoices (created_at DESC);

CREATE TABLE public.paystack_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.paystack_invoices(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX paystack_invoice_lines_invoice_idx ON public.paystack_invoice_lines (invoice_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paystack_invoices TO authenticated;
GRANT ALL ON public.paystack_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paystack_invoice_lines TO authenticated;
GRANT ALL ON public.paystack_invoice_lines TO service_role;

ALTER TABLE public.paystack_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystack_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage paystack invoices"
ON public.paystack_invoices FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage paystack invoice lines"
ON public.paystack_invoice_lines FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));