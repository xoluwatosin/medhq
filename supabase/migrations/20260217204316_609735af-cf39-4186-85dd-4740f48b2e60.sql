
-- Create creator_applications table
CREATE TABLE public.creator_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  social_links TEXT NOT NULL,
  portfolio_url TEXT,
  rate_card_url TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  archived BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Public insert
CREATE POLICY "Anyone can submit creator application"
ON public.creator_applications FOR INSERT
WITH CHECK (true);

-- No public read
CREATE POLICY "No public read access to creator applications"
ON public.creator_applications FOR SELECT
USING (false);

-- Admin read
CREATE POLICY "Admins can read all creator applications"
ON public.creator_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin update
CREATE POLICY "Admins can update creator applications"
ON public.creator_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('creator-uploads', 'creator-uploads', true);

-- Anyone can upload to creator-uploads
CREATE POLICY "Anyone can upload creator files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creator-uploads');

-- Public read for creator-uploads
CREATE POLICY "Creator uploads are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'creator-uploads');
