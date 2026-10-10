-- Heard has moved to its own project, and its domain no longer points at this
-- deployment. Its 9 rows were exported on 5 October 2026 before this ran.
-- Nothing outside Heard references these objects (checked: no foreign keys,
-- policies, triggers, views or other functions depend on them).

-- The access key leaves the two admins who held it.
update public.admin_permissions
set permissions = (
  select coalesce(jsonb_agg(p), '[]'::jsonb)
  from jsonb_array_elements(permissions) p
  where p #>> '{}' not ilike 'heard%'
)
where permissions::text ilike '%heard%';

drop function if exists public.heard_bootstrap_volunteer(text, text, text);
drop function if exists public.heard_join_waitlist(text, text, text);
drop function if exists public.heard_public_letters(integer);
drop function if exists public.heard_register_volunteer_profile(text, text, text);
drop function if exists public.heard_submit_letter(text, text, text, text, text);
drop function if exists public.heard_submit_message(text, text, text);
drop function if exists public.heard_submit_story(text, text, text, text);
drop function if exists public.heard_submit_volunteer(text, text, text, text, text, text, text);
drop function if exists public.heard_subscribe_letters(text, text);
drop function if exists public.heard_update_volunteer_profile(text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean);

drop table if exists public.heard_letter_deliveries;
drop table if exists public.heard_letter_recipients;
drop table if exists public.heard_letters;
drop table if exists public.heard_consents;
drop table if exists public.heard_stories;
drop table if exists public.heard_submissions;
drop table if exists public.heard_waitlist;
drop table if exists public.heard_volunteer_applications;
drop table if exists public.heard_volunteer_profiles;
drop table if exists public.heard_volunteers;

-- Trigger function used only by the profile table above.
drop function if exists public.heard_set_volunteer_profile_updated_at();
drop function if exists private.heard_can(text);
