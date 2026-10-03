create or replace function private.followup_queue_dispatch()
returns integer
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_ids uuid[];
  v_key text;
begin
  -- never dispatch a nudge that reality has already answered
  perform private.followup_queue_reconcile();

  select array_agg(id) into v_ids from (
    select id from public.followup_queue
    where status = 'pending'
      and queued_at < now() - interval '12 hours'
    order by queued_at
    limit 200
  ) q;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return 0;
  end if;

  select value into v_key from private.job_keys where name = 'followup_run_key';
  if v_key is null then return 0; end if;

  perform net.http_post(
    url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/send-followup-nudge',
    headers := jsonb_build_object('Content-Type','application/json','x-run-key', v_key),
    body := jsonb_build_object('ids', to_jsonb(v_ids))
  );

  return array_length(v_ids, 1);
end;
$function$;

revoke all on function private.followup_queue_dispatch() from public, anon, authenticated;

-- Public entry point so the edge function can re-check a single person at send time
create or replace function public.mu_person_gaps(_person uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(public.mu_candidate_gaps_row(p)))
       from public.mu_people p where p.id = _person),
    '{}'::text[])
$$;

revoke all on function public.mu_person_gaps(uuid) from public, anon;
grant execute on function public.mu_person_gaps(uuid) to service_role;
