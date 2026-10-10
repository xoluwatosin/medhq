-- Publishing, unpublishing or editing a published blog post rebuilds the site,
-- so the post gets its pre-rendered page, share card, short link and sitemap
-- entry without anyone redeploying by hand.
--
-- A change only records that a rebuild is due; a job every five minutes calls
-- the Vercel deploy hook once for everything recorded since, so a burst of
-- saves becomes one build. The hook URL is a secret: it lives in Vault under
-- 'vercel_blog_deploy_hook' and is never in this file or the site's code.

create table if not exists public.site_rebuild_requests (
  id bigserial primary key,
  reason text not null,
  requested_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.site_rebuild_requests enable row level security;
-- No policies: only the trigger and the job (running as the owner) touch it.

create or replace function public.request_site_rebuild_for_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  was_live boolean := tg_op in ('UPDATE', 'DELETE') and old.status = 'published';
  is_live boolean := tg_op in ('INSERT', 'UPDATE') and new.status = 'published';
begin
  if not (was_live or is_live) then
    return coalesce(new, old);
  end if;

  -- Edits to a live post count only when they change what the public page shows.
  if tg_op = 'UPDATE' and was_live and is_live
     and new.title is not distinct from old.title
     and new.slug is not distinct from old.slug
     and new.excerpt is not distinct from old.excerpt
     and new.content is not distinct from old.content
     and new.featured_image_url is not distinct from old.featured_image_url
     and new.published_at is not distinct from old.published_at
     and new.archived is not distinct from old.archived then
    return new;
  end if;

  insert into public.site_rebuild_requests (reason)
  values (format('blog post %s %s', coalesce(new.slug, old.slug),
    case when is_live and not was_live then 'published'
         when was_live and not is_live then 'unpublished'
         else 'edited' end));
  return coalesce(new, old);
end;
$$;

create or replace trigger blog_posts_request_site_rebuild
  after insert or update or delete on public.blog_posts
  for each row execute function public.request_site_rebuild_for_post();

create or replace function public.send_due_site_rebuild()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hook text;
begin
  if not exists (select 1 from public.site_rebuild_requests where sent_at is null) then
    return;
  end if;

  select decrypted_secret into hook
  from vault.decrypted_secrets
  where name = 'vercel_blog_deploy_hook';

  if hook is null then
    return; -- not configured yet; requests wait until it is
  end if;

  -- Vercel answers the hook slowly; give it time so the log shows its reply.
  perform net.http_post(url := hook, body := '{}'::jsonb, timeout_milliseconds := 30000);

  update public.site_rebuild_requests set sent_at = now() where sent_at is null;
end;
$$;

revoke execute on function public.send_due_site_rebuild() from public, anon, authenticated;
revoke execute on function public.request_site_rebuild_for_post() from public, anon, authenticated;

-- Scheduling under an existing name replaces that job.
select cron.schedule('site-rebuild-dispatch', '*/5 * * * *', $$select public.send_due_site_rebuild();$$);
