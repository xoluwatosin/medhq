-- A rejected post or campaign carries the reason, so the author sees why it
-- came back instead of a bare "rejected".
alter table public.blog_posts add column if not exists approval_note text;
alter table public.campaigns add column if not exists approval_note text;
