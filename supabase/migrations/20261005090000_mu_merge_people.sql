-- Merge two Talent Pool profiles in one transaction.
--
-- The Merges screen used to re-point four tables from the browser, one request
-- at a time, with no error checks, then delete the duplicate. Every other table
-- that points at mu_people (offers, engagements, contracts, references,
-- credentials, availability, shortlists, care assignments and more) lost its
-- rows through cascade or blocked the delete. This function does the whole
-- merge server side, for every foreign key that references mu_people, and
-- either all of it happens or none of it does.
--
-- Rules:
--   * admins only;
--   * two sign-ins cannot be merged: if both profiles have an auth user the
--     call is refused, the admin decides which account goes first;
--   * rows move to the survivor; where a table is unique per person (one
--     credential of each type, one availability row per day, one work
--     preferences row) the survivor's row wins and the duplicate's is dropped;
--   * blank fields on the survivor are filled from the duplicate;
--   * the duplicate is deleted and the merge is written to the survivor's trail.
create or replace function public.mu_merge_people(_keep uuid, _drop uuid, _candidate uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  keep_row public.mu_people%rowtype;
  drop_row public.mu_people%rowtype;
  actor text;
  fk record;
  uq record;
  match_sql text;
  moved int;
  dropped int;
  moved_total int := 0;
  dropped_total int := 0;
  tables jsonb := '{}'::jsonb;
begin
  if not private.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Admins only';
  end if;
  if _keep is null or _drop is null or _keep = _drop then
    raise exception 'Pick two different profiles';
  end if;

  select * into keep_row from public.mu_people where id = _keep for update;
  if not found then raise exception 'The profile to keep no longer exists'; end if;
  select * into drop_row from public.mu_people where id = _drop for update;
  if not found then raise exception 'The profile to merge away no longer exists'; end if;

  if keep_row.auth_user_id is not null and drop_row.auth_user_id is not null
     and keep_row.auth_user_id <> drop_row.auth_user_id then
    raise exception 'Both profiles have their own sign-in. Remove one sign-in first, then merge.';
  end if;

  select coalesce(display_name, email) into actor
  from public.admin_permissions where user_id = auth.uid() limit 1;

  -- Every column in the schema that points at mu_people, except the merge
  -- queue itself, which is handled below.
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'public.mu_people'::regclass
      and c.conrelid <> 'public.mu_merge_candidates'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    -- Unique keys on this table that include the person column: a row only
    -- moves when the survivor does not already hold the same key.
    match_sql := '';
    for uq in
      select array_agg(a2.attname::text) filter (where a2.attname <> fk.col) as others
      from pg_constraint u
      join pg_attribute a2 on a2.attrelid = u.conrelid and a2.attnum = any (u.conkey)
      where u.conrelid = fk.tbl and u.contype in ('p', 'u')
        and (select a3.attnum from pg_attribute a3 where a3.attrelid = fk.tbl and a3.attname = fk.col) = any (u.conkey)
      group by u.oid
    loop
      match_sql := match_sql || format(
        ' and not exists (select 1 from %s k where k.%I = $1%s)',
        fk.tbl, fk.col,
        coalesce((select string_agg(format(' and k.%I = d.%I', o, o), '') from unnest(uq.others) o), '')
      );
    end loop;

    execute format('update %s d set %I = $1 where d.%I = $2%s', fk.tbl, fk.col, fk.col, match_sql)
      using _keep, _drop;
    get diagnostics moved = row_count;
    moved_total := moved_total + moved;

    -- Whatever is left on the duplicate collided with the survivor's own row.
    execute format('delete from %s where %I = $1', fk.tbl, fk.col) using _drop;
    get diagnostics dropped = row_count;
    dropped_total := dropped_total + dropped;

    if moved > 0 or dropped > 0 then
      tables := tables || jsonb_build_object(fk.tbl::text, jsonb_build_object('moved', moved, 'dropped', dropped));
    end if;
  end loop;

  -- The merge queue: this pair is done; other pairs that named the duplicate
  -- now name the survivor, unless that pairs the survivor with itself.
  if _candidate is not null then
    update public.mu_merge_candidates
    set status = 'merged', resolved_by = auth.uid(), resolved_at = now()
    where id = _candidate;
  end if;
  delete from public.mu_merge_candidates
  where (person_a = _drop and person_b = _keep) or (person_a = _keep and person_b = _drop);
  update public.mu_merge_candidates set person_a = _keep where person_a = _drop;
  update public.mu_merge_candidates set person_b = _keep where person_b = _drop;

  delete from public.mu_people where id = _drop;

  -- Fill the survivor's blanks from the duplicate, after the delete so unique
  -- contact keys cannot collide.
  update public.mu_people set
    email = coalesce(keep_row.email, drop_row.email),
    phone = coalesce(keep_row.phone, drop_row.phone),
    auth_user_id = coalesce(keep_row.auth_user_id, drop_row.auth_user_id),
    current_position = coalesce(keep_row.current_position, drop_row.current_position),
    years_experience = coalesce(keep_row.years_experience, drop_row.years_experience),
    state = coalesce(keep_row.state, drop_row.state),
    lga = coalesce(keep_row.lga, drop_row.lga),
    sex = coalesce(keep_row.sex, drop_row.sex),
    profession = coalesce(keep_row.profession, drop_row.profession),
    track = coalesce(keep_row.track, drop_row.track),
    licensing_body = coalesce(keep_row.licensing_body, drop_row.licensing_body),
    license_number = coalesce(keep_row.license_number, drop_row.license_number),
    license_expiry = coalesce(keep_row.license_expiry, drop_row.license_expiry),
    languages = case when keep_row.languages is null or keep_row.languages = '[]'::jsonb then drop_row.languages else keep_row.languages end,
    admin_notes = case
      when keep_row.admin_notes is null or btrim(keep_row.admin_notes) = '' then drop_row.admin_notes
      when drop_row.admin_notes is null or btrim(drop_row.admin_notes) = '' then keep_row.admin_notes
      else keep_row.admin_notes || E'\n\n' || drop_row.admin_notes end,
    claimed_at = coalesce(keep_row.claimed_at, drop_row.claimed_at),
    invited_at = coalesce(keep_row.invited_at, drop_row.invited_at),
    last_activity_at = greatest(keep_row.last_activity_at, drop_row.last_activity_at),
    updated_at = now()
  where id = _keep;

  insert into public.mu_activity (person_id, actor_id, actor_name, action, detail)
  values (_keep, auth.uid(), actor, 'profiles_merged', jsonb_build_object(
    'merged_id', _drop,
    'merged_name', drop_row.full_name,
    'merged_email', drop_row.email,
    'merged_phone', drop_row.phone,
    'rows_moved', moved_total,
    'duplicate_rows_dropped', dropped_total
  ));

  return jsonb_build_object('kept', _keep, 'merged', _drop, 'rows_moved', moved_total, 'duplicate_rows_dropped', dropped_total, 'tables', tables);
end;
$$;

revoke execute on function public.mu_merge_people(uuid, uuid, uuid) from public, anon;
grant execute on function public.mu_merge_people(uuid, uuid, uuid) to authenticated, service_role;
