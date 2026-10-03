
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS body_captions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS subscribers_notified boolean DEFAULT false;
