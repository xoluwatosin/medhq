-- Heard baseline schema, extracted from the Medic Connect database (October 2026).
--
-- Same tables, columns, constraints, indexes, triggers, policies and functions
-- as the heard_* objects there, with three deliberate changes:
--   1. Admin rights come from heard_admins, not Medic Connect's user_roles and
--      admin_permissions. private.heard_can() reads it.
--   2. heard_volunteers and heard_waitlist were guarded by Medic Connect's
--      'admin' role; they now use heard_can('heard_volunteers_manage').
--   3. Privileges are explicit. anon gets no table access and may only read the
--      public Letter Room. The submit functions are callable by service_role
--      alone, so every public write goes through the heard-submit edge function.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

create table public.heard_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint heard_admins_permissions_check check (
    permissions <@ array['heard_content_review', 'heard_story_swap_manage', 'heard_letters_manage',
                         'heard_delivery_manage', 'heard_volunteers_manage']::text[]
  )
);
alter table public.heard_admins enable row level security;
create policy "Admins read their own row" on public.heard_admins
  for select to authenticated using (user_id = auth.uid());

create or replace function private.heard_can(_perm text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'private'
as $function$
  select auth.uid() is not null
     and exists (select 1 from public.heard_admins a
                  where a.user_id = auth.uid() and _perm = any (a.permissions))
$function$;

create or replace function public.heard_set_volunteer_profile_updated_at()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.heard_consents (
  id uuid default gen_random_uuid() not null,
  consent_type text not null,
  consent_version text default 'v1'::text not null,
  email text,
  subject_table text,
  subject_id uuid,
  granted_at timestamp with time zone default now() not null,
  withdrawn_at timestamp with time zone,
  source text,
  created_at timestamp with time zone default now() not null,
  constraint heard_consents_pkey primary key (id),
  constraint heard_consents_type_check check ((consent_type = any (array['letter_use'::text, 'letter_receipt'::text, 'story_use'::text, 'submission_use'::text])))
);

create table public.heard_letters (
  id uuid default gen_random_uuid() not null,
  public_ref text default encode(gen_random_bytes(8), 'hex'::text) not null,
  heading text,
  content text not null,
  sign_it_as text,
  submitter_email text,
  moderation_state text default 'pending'::text not null,
  approval_state text default 'undecided'::text not null,
  destination text default 'undecided'::text not null,
  published_at timestamp with time zone,
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  auth_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_letters_pkey primary key (id),
  constraint heard_letters_public_ref_key unique (public_ref),
  constraint heard_letters_approval_check check ((approval_state = any (array['undecided'::text, 'approved'::text, 'rejected'::text]))),
  constraint heard_letters_destination_check check ((destination = any (array['undecided'::text, 'letter_room'::text, 'email_distribution'::text])))
);

create table public.heard_letter_recipients (
  id uuid default gen_random_uuid() not null,
  email text not null,
  status text default 'subscribed'::text not null,
  consent_version text default 'v1'::text not null,
  subscribed_at timestamp with time zone default now() not null,
  unsubscribed_at timestamp with time zone,
  unsubscribe_token text default encode(gen_random_bytes(16), 'hex'::text) not null,
  auth_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_letter_recipients_pkey primary key (id),
  constraint heard_letter_recipients_email_key unique (email),
  constraint heard_letter_recipients_status_check check ((status = any (array['subscribed'::text, 'unsubscribed'::text, 'suppressed'::text])))
);

create table public.heard_letter_deliveries (
  id uuid default gen_random_uuid() not null,
  letter_id uuid not null,
  recipient_id uuid not null,
  delivery_status text default 'queued'::text not null,
  provider_message_id text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_letter_deliveries_pkey primary key (id),
  constraint heard_letter_deliveries_unique unique (letter_id, recipient_id),
  constraint heard_letter_deliveries_letter_id_fkey foreign key (letter_id) references public.heard_letters(id) on delete cascade,
  constraint heard_letter_deliveries_recipient_id_fkey foreign key (recipient_id) references public.heard_letter_recipients(id) on delete cascade
);

create table public.heard_stories (
  id uuid default gen_random_uuid() not null,
  subject text,
  content text not null,
  sign_it_as text,
  submitter_email text,
  moderation_state text default 'pending'::text not null,
  approval_state text default 'undecided'::text not null,
  matching_state text default 'unmatched'::text not null,
  delivery_state text default 'not_sent'::text not null,
  matched_with_story_id uuid,
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  auth_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_stories_pkey primary key (id),
  constraint heard_stories_matched_with_story_id_fkey foreign key (matched_with_story_id) references public.heard_stories(id)
);

create table public.heard_submissions (
  id uuid default gen_random_uuid() not null,
  subject text,
  content text not null,
  email text,
  status text default 'new'::text not null,
  moderation_state text default 'pending'::text not null,
  moderation_notes text,
  moderated_by uuid,
  moderated_at timestamp with time zone,
  auth_user_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_submissions_pkey primary key (id)
);

create table public.heard_volunteer_profiles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  first_name text not null,
  last_name text not null,
  role_interest text not null,
  application_status text default 'account_created'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  preferred_name text,
  email text,
  phone text,
  country_code character varying(2),
  subdivision_code character varying(6),
  subdivision_name text,
  lga text,
  city text,
  timezone text,
  languages jsonb default '[]'::jsonb not null,
  adjustments text,
  adjustments_discuss_privately boolean default false not null,
  constraint heard_volunteer_profiles_pkey primary key (id),
  constraint heard_volunteer_profiles_user_id_key unique (user_id),
  constraint heard_volunteer_profiles_application_status_check check ((application_status = any (array['account_created'::text, 'questionnaire_available'::text, 'submitted'::text, 'under_review'::text, 'accepted'::text, 'rejected'::text]))),
  constraint heard_volunteer_profiles_first_name_check check (((char_length(first_name) >= 1) and (char_length(first_name) <= 100))),
  constraint heard_volunteer_profiles_last_name_check check (((char_length(last_name) >= 1) and (char_length(last_name) <= 100))),
  constraint heard_volunteer_profiles_role_interest_check check ((role_interest = any (array['peer_listener'::text, 'social_media_volunteer'::text, 'professional'::text])))
);

create table public.heard_volunteer_applications (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  user_id uuid not null,
  role text not null,
  status text default 'application_started'::text not null,
  answers jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint heard_volunteer_applications_pkey primary key (id),
  constraint heard_volunteer_applications_profile_id_fkey foreign key (profile_id) references public.heard_volunteer_profiles(id) on delete cascade,
  constraint heard_volunteer_applications_role_check check ((role = any (array['peer_listener'::text, 'social_media_volunteer'::text, 'professional'::text]))),
  constraint heard_volunteer_applications_status_check check ((status = any (array['application_started'::text, 'submitted'::text, 'under_review'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text])))
);
create unique index heard_volunteer_applications_one_open on public.heard_volunteer_applications using btree (profile_id) where (status = any (array['application_started'::text, 'submitted'::text, 'under_review'::text]));
create index heard_volunteer_applications_user on public.heard_volunteer_applications using btree (user_id);

create table public.heard_volunteers (
  id uuid default gen_random_uuid() not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  state text not null,
  role_interest text not null,
  motivation text,
  time_commitment text,
  status text default 'new'::text not null,
  notes text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_path text,
  constraint heard_volunteers_pkey primary key (id)
);

create table public.heard_waitlist (
  id uuid default gen_random_uuid() not null,
  email text not null,
  source text,
  created_at timestamp with time zone default now() not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  landing_path text,
  purpose text default 'phone_line'::text not null,
  constraint heard_waitlist_pkey primary key (id),
  constraint heard_waitlist_email_key unique (email)
);
create unique index heard_waitlist_email_purpose_key on public.heard_waitlist using btree (lower(email), purpose);

create trigger heard_volunteer_applications_updated_at before update on public.heard_volunteer_applications
  for each row execute function public.heard_set_volunteer_profile_updated_at();
create trigger heard_volunteer_profiles_updated_at before update on public.heard_volunteer_profiles
  for each row execute function public.heard_set_volunteer_profile_updated_at();
create trigger heard_volunteers_updated_at before update on public.heard_volunteers
  for each row execute function public.heard_set_volunteer_profile_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.heard_consents enable row level security;
alter table public.heard_letters enable row level security;
alter table public.heard_letter_recipients enable row level security;
alter table public.heard_letter_deliveries enable row level security;
alter table public.heard_stories enable row level security;
alter table public.heard_submissions enable row level security;
alter table public.heard_volunteer_profiles enable row level security;
alter table public.heard_volunteer_applications enable row level security;
alter table public.heard_volunteers enable row level security;
alter table public.heard_waitlist enable row level security;

create policy "Heard reviewers read consents" on public.heard_consents
  for select to authenticated using (private.heard_can('heard_content_review'));
create policy "Heard delivery managers read deliveries" on public.heard_letter_deliveries
  for select to authenticated using (private.heard_can('heard_delivery_manage'));
create policy "Heard delivery managers read recipients" on public.heard_letter_recipients
  for select to authenticated using (private.heard_can('heard_delivery_manage'));
create policy "Heard delivery managers update recipients" on public.heard_letter_recipients
  for update to authenticated using (private.heard_can('heard_delivery_manage')) with check (private.heard_can('heard_delivery_manage'));
create policy "Heard reviewers read letters" on public.heard_letters
  for select to authenticated using (private.heard_can('heard_letters_manage'));
create policy "Heard reviewers update letters" on public.heard_letters
  for update to authenticated using (private.heard_can('heard_letters_manage')) with check (private.heard_can('heard_letters_manage'));
create policy "Heard reviewers read stories" on public.heard_stories
  for select to authenticated using (private.heard_can('heard_story_swap_manage'));
create policy "Heard reviewers update stories" on public.heard_stories
  for update to authenticated using (private.heard_can('heard_story_swap_manage')) with check (private.heard_can('heard_story_swap_manage'));
create policy "Heard reviewers read submissions" on public.heard_submissions
  for select to authenticated using (private.heard_can('heard_content_review'));
create policy "Heard reviewers update submissions" on public.heard_submissions
  for update to authenticated using (private.heard_can('heard_content_review')) with check (private.heard_can('heard_content_review'));
create policy "Heard admins can read volunteer applications" on public.heard_volunteer_applications
  for select to authenticated using (private.heard_can('heard_volunteers_manage'));
create policy "Volunteers can read own Heard applications" on public.heard_volunteer_applications
  for select to authenticated using (user_id = auth.uid());
create policy "Heard admins can read volunteer profiles" on public.heard_volunteer_profiles
  for select to authenticated using (private.heard_can('heard_volunteers_manage'));
create policy "Heard admins can update volunteer profiles" on public.heard_volunteer_profiles
  for update to authenticated using (private.heard_can('heard_volunteers_manage')) with check (private.heard_can('heard_volunteers_manage'));
create policy "Volunteers can read own Heard profile" on public.heard_volunteer_profiles
  for select to authenticated using (user_id = auth.uid());
create policy "Heard admins can read volunteers" on public.heard_volunteers
  for select to authenticated using (private.heard_can('heard_volunteers_manage'));
create policy "Heard admins can update volunteers" on public.heard_volunteers
  for update to authenticated using (private.heard_can('heard_volunteers_manage')) with check (private.heard_can('heard_volunteers_manage'));
create policy "Heard admins can delete volunteers" on public.heard_volunteers
  for delete to authenticated using (private.heard_can('heard_volunteers_manage'));
create policy "Heard admins can read waitlist" on public.heard_waitlist
  for select to authenticated using (private.heard_can('heard_volunteers_manage'));
create policy "Heard admins can delete waitlist entries" on public.heard_waitlist
  for delete to authenticated using (private.heard_can('heard_volunteers_manage'));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.heard_public_letters(_limit integer default 50)
 returns table(public_ref text, heading text, content text, sign_it_as text, published_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select l.public_ref, l.heading, l.content, l.sign_it_as, l.published_at
  from public.heard_letters l
  where l.approval_state = 'approved'
    and l.destination = 'letter_room'
    and l.published_at is not null
  order by l.published_at desc
  limit least(greatest(coalesce(_limit, 50), 1), 200)
$function$;

create or replace function public.heard_submit_message(_content text, _subject text default null::text, _email text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare new_id uuid;
begin
  if _content is null or length(btrim(_content)) < 2 then
    raise exception 'A message is required';
  end if;
  insert into public.heard_submissions (subject, content, email)
  values (nullif(btrim(_subject), ''), left(btrim(_content), 20000), nullif(lower(btrim(_email)), ''))
  returning id into new_id;
  return new_id;
end;
$function$;

create or replace function public.heard_submit_story(_content text, _subject text default null::text, _sign_it_as text default null::text, _email text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare new_id uuid;
begin
  if _content is null or length(btrim(_content)) < 2 then
    raise exception 'A story is required';
  end if;
  insert into public.heard_stories (subject, content, sign_it_as, submitter_email)
  values (
    nullif(btrim(_subject), ''),
    left(btrim(_content), 20000),
    nullif(btrim(_sign_it_as), ''),
    nullif(lower(btrim(_email)), '')
  )
  returning id into new_id;
  insert into public.heard_consents (consent_type, email, subject_table, subject_id, source)
  values ('story_use', nullif(lower(btrim(_email)), ''), 'heard_stories', new_id, 'story_swap_form');
  return new_id;
end;
$function$;

create or replace function public.heard_submit_letter(_content text, _heading text default null::text, _sign_it_as text default null::text, _email text default null::text, _consent_version text default 'v1'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare new_id uuid;
begin
  if _content is null or length(btrim(_content)) < 2 then
    raise exception 'A letter is required';
  end if;
  insert into public.heard_letters (heading, content, sign_it_as, submitter_email)
  values (
    nullif(btrim(_heading), ''),
    left(btrim(_content), 20000),
    nullif(btrim(_sign_it_as), ''),
    nullif(lower(btrim(_email)), '')
  )
  returning id into new_id;
  insert into public.heard_consents (consent_type, consent_version, email, subject_table, subject_id, source)
  values ('letter_use', _consent_version, nullif(lower(btrim(_email)), ''), 'heard_letters', new_id, 'letters_form');
  return new_id;
end;
$function$;

create or replace function public.heard_submit_volunteer(_first_name text, _last_name text, _email text, _state text, _role_interest text, _motivation text default null::text, _time_commitment text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := nullif(lower(btrim(_email)), '');
  v_id uuid;
begin
  if nullif(btrim(_first_name), '') is null
     or nullif(btrim(_last_name), '') is null
     or v_email is null
     or nullif(btrim(_state), '') is null
     or nullif(btrim(_role_interest), '') is null then
    raise exception 'Missing required volunteer details';
  end if;

  -- Repeat interest while the earlier sign-up is still unreviewed refreshes
  -- that sign-up. Once reviewed, a later application is recorded separately.
  update public.heard_volunteers
     set first_name = left(btrim(_first_name), 100),
         last_name = left(btrim(_last_name), 100),
         state = left(btrim(_state), 80),
         role_interest = left(btrim(_role_interest), 60),
         motivation = nullif(left(btrim(_motivation), 1000), ''),
         time_commitment = nullif(left(btrim(_time_commitment), 40), ''),
         updated_at = now()
   where lower(email) = v_email
     and status = 'new'
   returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.heard_volunteers (
    first_name, last_name, email, state, role_interest, motivation, time_commitment
  ) values (
    left(btrim(_first_name), 100),
    left(btrim(_last_name), 100),
    v_email,
    left(btrim(_state), 80),
    left(btrim(_role_interest), 60),
    nullif(left(btrim(_motivation), 1000), ''),
    nullif(left(btrim(_time_commitment), 40), '')
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.heard_join_waitlist(_email text, _source text default null::text, _purpose text default 'phone_line'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := nullif(lower(btrim(_email)), '');
  v_purpose text := coalesce(nullif(btrim(_purpose), ''), 'phone_line');
  v_id uuid;
begin
  if v_email is null then
    raise exception 'An email address is required';
  end if;

  select id into v_id
    from public.heard_waitlist
   where lower(email) = v_email and purpose = v_purpose
   limit 1;

  if v_id is not null then
    update public.heard_waitlist
       set source = coalesce(nullif(btrim(_source), ''), source)
     where id = v_id;
    return v_id;
  end if;

  insert into public.heard_waitlist (email, source, purpose)
  values (v_email, nullif(btrim(_source), ''), v_purpose)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.heard_subscribe_letters(_email text, _consent_version text default 'v1'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare rec_id uuid;
declare clean_email text := nullif(lower(btrim(_email)), '');
begin
  if clean_email is null or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required';
  end if;
  insert into public.heard_letter_recipients (email, consent_version)
  values (clean_email, _consent_version)
  on conflict (email) do update
    set status = 'subscribed',
        consent_version = excluded.consent_version,
        subscribed_at = now(),
        unsubscribed_at = null,
        updated_at = now()
  returning id into rec_id;
  insert into public.heard_consents (consent_type, consent_version, email, subject_table, subject_id, source)
  values ('letter_receipt', _consent_version, clean_email, 'heard_letter_recipients', rec_id, 'letter_room_optin');
  return rec_id;
end;
$function$;

create or replace function public.heard_register_volunteer_profile(p_first_name text, p_last_name text, p_role_interest text)
 returns heard_volunteer_profiles
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.heard_volunteer_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(p_first_name)) not between 1 and 100
     or char_length(trim(p_last_name)) not between 1 and 100 then
    raise exception 'First name and last name are required';
  end if;
  if p_role_interest not in ('peer_listener', 'social_media_volunteer', 'professional') then
    raise exception 'Invalid volunteer role';
  end if;

  insert into public.heard_volunteer_profiles (
    user_id, first_name, last_name, role_interest, application_status
  ) values (
    v_user_id, trim(p_first_name), trim(p_last_name), p_role_interest, 'account_created'
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role_interest = excluded.role_interest,
    updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$function$;

create or replace function public.heard_bootstrap_volunteer(p_role text default null::text, p_first_name text default null::text, p_last_name text default null::text)
 returns heard_volunteer_profiles
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_email text;
  v_role text;
  v_first text;
  v_last text;
  v_display text;
  v_profile public.heard_volunteer_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select raw_user_meta_data, email into v_meta, v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if not found then raise exception 'email_not_verified'; end if;

  select * into v_profile from public.heard_volunteer_profiles where user_id = v_uid;
  if not found then
    v_role := coalesce(nullif(trim(p_role),''), v_meta->>'heard_role_interest');
    if coalesce(v_role,'') not in ('peer_listener','social_media_volunteer','professional') then
      raise exception 'role_selection_required';
    end if;
    v_display := trim(coalesce(v_meta->>'display_name', v_meta->>'full_name', v_meta->>'name', ''));
    v_first := coalesce(nullif(trim(p_first_name),''), nullif(trim(v_meta->>'heard_first_name'),''), nullif(split_part(v_display,' ',1),''), 'Volunteer');
    v_last := coalesce(nullif(trim(p_last_name),''), nullif(trim(v_meta->>'heard_last_name'),''), nullif(trim(substr(v_display, length(split_part(v_display,' ',1)) + 2)),''), '-');
    insert into public.heard_volunteer_profiles (user_id, first_name, last_name, role_interest, email)
    values (v_uid, left(v_first,100), left(v_last,100), v_role, v_email)
    on conflict (user_id) do nothing;
    select * into v_profile from public.heard_volunteer_profiles where user_id = v_uid;
  elsif v_profile.email is distinct from v_email then
    update public.heard_volunteer_profiles set email = v_email where id = v_profile.id returning * into v_profile;
  end if;

  if not exists (select 1 from public.heard_volunteer_applications where profile_id = v_profile.id) then
    insert into public.heard_volunteer_applications (profile_id, user_id, role)
    values (v_profile.id, v_uid, v_profile.role_interest)
    on conflict do nothing;
  end if;
  return v_profile;
end;
$function$;

create or replace function public.heard_update_volunteer_profile(p_first_name text, p_last_name text, p_preferred_name text, p_phone text, p_country_code text, p_subdivision_code text, p_subdivision_name text, p_lga text, p_city text, p_timezone text, p_languages jsonb, p_adjustments text, p_adjustments_discuss_privately boolean)
 returns heard_volunteer_profiles
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_profile public.heard_volunteer_profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_first_name,''))) not between 1 and 100
    or char_length(trim(coalesce(p_last_name,''))) not between 1 and 100
    or char_length(coalesce(p_preferred_name,'')) > 100
    or coalesce(p_phone,'') !~ '^\+[1-9][0-9]{6,14}$'
    or coalesce(p_country_code,'') !~ '^[A-Z]{2}$'
    or coalesce(p_subdivision_code,'') !~ ('^' || p_country_code || '-[A-Z0-9]{1,3}$')
    or char_length(trim(coalesce(p_subdivision_name,''))) not between 1 and 120
    or char_length(coalesce(p_lga,'')) > 120
    or char_length(coalesce(p_city,'')) > 120
    or char_length(coalesce(p_timezone,'')) not between 3 and 64
    or jsonb_typeof(p_languages) <> 'array' or jsonb_array_length(p_languages) not between 1 and 20
    or exists (select 1 from jsonb_array_elements(p_languages) l
               where char_length(coalesce(l->>'language','')) not between 1 and 80
                  or coalesce(l->>'proficiency','') not in ('native','fluent','conversational','basic'))
    or char_length(coalesce(p_adjustments,'')) > 2000 then
    raise exception 'invalid_details';
  end if;
  update public.heard_volunteer_profiles set
    first_name = trim(p_first_name), last_name = trim(p_last_name),
    preferred_name = nullif(trim(p_preferred_name),''), phone = p_phone,
    country_code = p_country_code, subdivision_code = p_subdivision_code, subdivision_name = trim(p_subdivision_name),
    lga = case when p_country_code = 'NG' then nullif(trim(p_lga),'') end,
    city = nullif(trim(p_city),''), timezone = p_timezone, languages = p_languages,
    adjustments = nullif(trim(p_adjustments),''), adjustments_discuss_privately = coalesce(p_adjustments_discuss_privately,false)
  where user_id = auth.uid()
  returning * into v_profile;
  if not found then raise exception 'no_profile'; end if;
  return v_profile;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Privileges. Row level security still applies on top of every table grant.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant select on public.heard_admins to authenticated;
grant select, update on public.heard_letters, public.heard_stories, public.heard_submissions,
  public.heard_letter_recipients, public.heard_volunteer_profiles to authenticated;
grant select on public.heard_consents, public.heard_letter_deliveries, public.heard_volunteer_applications to authenticated;
grant select, update, delete on public.heard_volunteers to authenticated;
grant select, delete on public.heard_waitlist to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public, private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.heard_can(text) to authenticated;
grant execute on function public.heard_public_letters(integer) to anon, authenticated;
grant execute on function public.heard_bootstrap_volunteer(text, text, text),
  public.heard_update_volunteer_profile(text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean),
  public.heard_register_volunteer_profile(text, text, text)
  to authenticated;
grant execute on all functions in schema public, private to service_role;
