ALTER TABLE public.blog_posts ALTER COLUMN published_at DROP DEFAULT;
ALTER TABLE public.blog_posts ALTER COLUMN published_at DROP NOT NULL;
UPDATE public.blog_posts SET published_at = NULL WHERE status <> 'published' AND status <> 'scheduled';