DROP INDEX IF EXISTS public.service_fees_sku_unique;
ALTER TABLE public.service_fees DROP CONSTRAINT IF EXISTS service_fees_sku_key;
ALTER TABLE public.service_fees ADD CONSTRAINT service_fees_sku_key UNIQUE (sku);