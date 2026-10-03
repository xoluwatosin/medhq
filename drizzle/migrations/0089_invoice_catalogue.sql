CREATE TABLE IF NOT EXISTS public.invoice_service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.invoice_service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_services_category_idx ON public.invoice_services(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_service_categories TO authenticated;
GRANT ALL ON public.invoice_service_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_services TO authenticated;
GRANT ALL ON public.invoice_services TO service_role;

ALTER TABLE public.invoice_service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invoice service categories"
ON public.invoice_service_categories FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage invoice services"
ON public.invoice_services FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));