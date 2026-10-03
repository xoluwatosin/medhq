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
  select array_agg(id) into v_ids
  from public.followup_queue
  where status = 'pending'
    and queued_at < now() - interval '12 hours';

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return 0;
  end if;

  select value into v_key from private.job_keys where name = 'followup_run_key';
  if v_key is null then
    return 0;
  end if;

  perform net.http_post(
    url := 'https://eylgffhvyuykafxydrul.supabase.co/functions/v1/send-followup-nudge',
    headers := jsonb_build_object('Content-Type','application/json','x-run-key', v_key),
    body := jsonb_build_object('ids', to_jsonb(v_ids))
  );

  return array_length(v_ids, 1);
end;
$function$;

select cron.schedule('followup-queue-dispatch', '30 9 * * *', $$select private.followup_queue_dispatch();$$);