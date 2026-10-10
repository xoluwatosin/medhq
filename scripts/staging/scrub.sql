-- Pseudonymise a restored copy of the Medic Connect database for staging.
--
-- Run ONLY against a staging copy, through scripts/staging/scrub.sh, which
-- refuses the live project. Everything runs in one transaction: it either
-- finishes completely or changes nothing.
--
-- What it does:
--   1. Stops every scheduled job, so staging never sends email, WhatsApp or
--      notifications to real people.
--   2. Replaces personal data with consistent fake values. The same real email
--      always becomes the same fake email in every table, so joins still work.
--   3. Keeps codes, ids, dates (except birth day and month), numbers and the
--      structure of questionnaire answers, so the app behaves as it does live.
--   4. Clears sessions, tokens, IP addresses, signatures and secrets.
--
-- A column listed here that does not exist in this copy is skipped, so the
-- script survives schema changes. Add new personal columns to the list below.

begin;

-- Triggers off for this transaction: an update must never queue an email,
-- WhatsApp or webhook. If the role cannot do this, the script stops here and
-- nothing changes.
set local session_replication_role = replica;

create schema if not exists staging_scrub;

-- Deterministic fakes -------------------------------------------------------

create or replace function staging_scrub.fake_email(v text) returns text
language sql immutable as $$
  select case when v is null or btrim(v) = '' then v
    else 'u' || left(md5(lower(btrim(v))), 12) || '@example.invalid' end
$$;

create or replace function staging_scrub.fake_phone(v text) returns text
language sql immutable as $$
  select case when v is null or btrim(v) = '' then v
    else '+2348' || left(regexp_replace(md5(v), '[^0-9]', '', 'g') || '000000000', 9) end
$$;

create or replace function staging_scrub.fake_name(v text) returns text
language sql immutable as $$
  select case when v is null or btrim(v) = '' then v
    else 'Test ' || upper(left(md5(v), 5)) end
$$;

create or replace function staging_scrub.fake_text(v text) returns text
language sql immutable as $$
  select case when v is null or btrim(v) = '' then v else '[redacted]' end
$$;

-- Keep option codes and dates inside answers (they drive routing); redact
-- every other string. Keys, numbers, booleans and structure stay.
create or replace function staging_scrub.scrub_json(j jsonb) returns jsonb
language plpgsql immutable as $$
declare
  t text := jsonb_typeof(j);
  s text;
begin
  if j is null then return null; end if;
  if t = 'object' then
    -- Birth dates inside answers keep only their year.
    return coalesce((select jsonb_object_agg(k,
        case when k ~* '(dob|birth)' and jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
             then to_jsonb(left(v #>> '{}', 4) || '-01-01')
             else staging_scrub.scrub_json(v) end)
      from jsonb_each(j) as e(k, v)), '{}'::jsonb);
  elsif t = 'array' then
    return coalesce((select jsonb_agg(staging_scrub.scrub_json(v) order by o) from jsonb_array_elements(j) with ordinality as a(v, o)), '[]'::jsonb);
  elsif t = 'string' then
    s := j #>> '{}';
    if s ~ '^[a-z0-9_.:-]{1,48}$' or s ~ '^\d{4}-\d{2}-\d{2}([T ][0-9:.+Z-]*)?$' then
      return j;
    end if;
    return to_jsonb('[redacted]'::text);
  end if;
  return j;
end
$$;

-- Apply one rule to one column, if the column exists ----------------------

create or replace function staging_scrub.apply(_schema text, _table text, _column text, _kind text)
returns void language plpgsql as $$
declare
  dtype text;
  expr text;
  col text := format('%I', _column);
begin
  select c.data_type into dtype
    from information_schema.columns c
   where c.table_schema = _schema and c.table_name = _table and c.column_name = _column;
  if dtype is null then
    raise notice 'skip %.%.% (not present)', _schema, _table, _column;
    return;
  end if;

  if dtype = 'USER-DEFINED' then
    raise notice 'skip %.%.% (enum or custom type)', _schema, _table, _column;
    return;
  elsif dtype = 'jsonb' or dtype = 'json' then
    expr := case _kind
      when 'null' then 'null'
      else format('staging_scrub.scrub_json(%s::jsonb)::%s', col, dtype) end;
  elsif dtype = 'ARRAY' then
    expr := case _kind
      when 'email' then format('(select array_agg(staging_scrub.fake_email(x)) from unnest(%s) x)', col)
      when 'null' then 'null'
      else format('case when %s is null then null else ''{}'' end', col) end;
  elsif dtype in ('date', 'timestamp without time zone', 'timestamp with time zone') then
    expr := case _kind
      when 'dob' then format('make_date(extract(year from %s)::int, 1, 1)', col)
      when 'null' then 'null'
      else col end;
  elsif dtype in ('integer', 'smallint', 'bigint', 'numeric') then
    expr := case _kind when 'null' then 'null' else col end;
  else
    expr := case _kind
      when 'email' then format('staging_scrub.fake_email(%s)', col)
      when 'phone' then format('staging_scrub.fake_phone(%s)', col)
      when 'name'  then format('staging_scrub.fake_name(%s)', col)
      when 'text'  then format('staging_scrub.fake_text(%s)', col)
      when 'id'    then format('case when %1$s is null then null else ''TEST-'' || upper(left(md5(%1$s), 8)) end', col)
      when 'file'  then format('case when %1$s is null then null else ''redacted/'' || md5(%1$s) end', col)
      when 'token' then format('case when %s is null then null else md5(gen_random_uuid()::text) end', col)
      when 'null'  then 'null'
      else format('staging_scrub.fake_text(%s)', col) end;
  end if;

  execute format('update %I.%I set %s = %s where %s is not null', _schema, _table, col, expr, col);
end
$$;

-- 1. Stop scheduled jobs ----------------------------------------------------

do $$
begin
  if to_regclass('cron.job') is not null then
    update cron.job set active = false;
  end if;
end $$;

-- 2. Personal data, column by column -----------------------------------------
-- kind: email | phone | name | text | json | dob | id | file | token | null

select staging_scrub.apply(s, t, c, k) from (values
  ('public','admin_access_log','actor_email','email'), ('public','admin_access_log','target_email','email'), ('public','admin_access_log','note','text'),
  ('public','admin_alerts','title','text'), ('public','admin_alerts','detail','text'),
  ('public','admin_login_log','email','email'),
  ('public','admin_permissions','display_name','name'), ('public','admin_permissions','email','email'),
  ('public','audience_members','name','name'), ('public','audience_members','email','email'),
  ('public','blog_posts','created_by_name','name'), ('public','blog_posts','last_edited_by_name','name'),
  ('public','campaign_events','recipient_email','email'), ('public','campaign_events','metadata','null'),
  ('public','campaigns','created_by_name','name'), ('public','campaigns','last_edited_by_name','name'), ('public','campaigns','manual_recipients','email'),
  ('public','care_access_bases','evidence_note','text'), ('public','care_access_bases','withdrawn_reason','text'),
  ('public','care_access_grants','grant_reason','text'), ('public','care_access_grants','revoked_reason','text'),
  ('public','care_access_log','ip','null'), ('public','care_access_log','user_agent','null'),
  ('public','care_access_tokens','token_hash','token'),
  ('public','care_activity','actor_name','name'), ('public','care_activity','detail','json'),
  ('public','care_assessment_capture_events','value','json'),
  ('public','care_assessment_events','detail','json'),
  ('public','care_assessment_reviews','decision_notes','text'), ('public','care_assessment_reviews','decision_reason','text'), ('public','care_assessment_reviews','return_instructions','text'), ('public','care_assessment_reviews','checklist','json'),
  ('public','care_assessment_visits','address_line','text'), ('public','care_assessment_visits','landmark','text'), ('public','care_assessment_visits','notes','text'),
  ('public','care_assessment_work','notes','text'), ('public','care_assessment_work','cancel_reason','text'), ('public','care_assessment_work','review_reason','text'), ('public','care_assessment_work','review_checklist','json'),
  ('public','care_client_onboarding_links','destination_email','email'), ('public','care_client_onboarding_links','token_hash','token'), ('public','care_client_onboarding_links','intake','json'), ('public','care_client_onboarding_links','duplicate_signals','null'),
  ('public','care_documents','responses','json'), ('public','care_documents','routing_facts','json'), ('public','care_documents','active_evidence','json'), ('public','care_documents','outstanding_required','json'),
  ('public','care_episodes','configuration_snapshot','json'), ('public','care_episodes','overrides','json'),
  ('public','care_finance_adjustments','reason','text'), ('public','care_finance_adjustments','reference','text'),
  ('public','care_flags','detail','text'), ('public','care_flags','clear_note','text'),
  ('public','care_form_revision_events','actor_name','name'), ('public','care_form_revision_events','changed_fields','json'), ('public','care_form_revision_events','reason','text'),
  ('public','care_group_members','notes','text'),
  ('public','care_groups','display_name','name'), ('public','care_groups','address_line','text'), ('public','care_groups','landmark','text'),
  ('public','care_notifications','destination','text'), ('public','care_notifications','subject','text'), ('public','care_notifications','provider_error','text'),
  ('public','care_people','first_name','name'), ('public','care_people','last_name','name'), ('public','care_people','full_name','name'), ('public','care_people','preferred_name','name'), ('public','care_people','email','email'), ('public','care_people','phone','phone'), ('public','care_people','whatsapp','phone'),
  ('public','care_person_relationships','other_label','text'),
  ('public','care_plan_approvals','actor_name','name'), ('public','care_plan_approvals','reason','text'),
  ('public','care_plan_goals','title','text'), ('public','care_plan_goals','detail','text'), ('public','care_plan_goals','measure','text'),
  ('public','care_plan_needs','title','text'), ('public','care_plan_needs','detail','text'),
  ('public','care_plan_tasks','title','text'), ('public','care_plan_tasks','detail','text'),
  ('public','care_portal_invitations','destination','text'), ('public','care_portal_invitations','token_hash','token'), ('public','care_portal_invitations','revoked_reason','text'),
  ('public','care_proposal_comments','body','text'),
  ('public','care_proposal_responses','comment','text'),
  ('public','care_proposals','content','json'),
  ('public','care_questionnaire_sessions','shared_responses','json'),
  ('public','care_quote_versions','notes','text'),
  ('public','care_request_recipients','address_line','text'), ('public','care_request_recipients','landmark','text'),
  ('public','care_requests','callback_phone','phone'), ('public','care_requests','enquiry_notes','text'), ('public','care_requests','attribution','null'),
  ('public','care_response_amendments','original_value','json'), ('public','care_response_amendments','corrected_value','json'), ('public','care_response_amendments','reason','text'), ('public','care_response_amendments','amended_by_name','name'),
  ('public','care_service_intention_recipients','conflict_reason','text'), ('public','care_service_intentions','reason','text'),
  ('public','care_upload_files','original_name','file'), ('public','care_upload_files','storage_path','file'),
  ('public','care_work_items','title','text'), ('public','care_work_items','detail','text'), ('public','care_work_items','outcome','text'), ('public','care_work_items','cancel_reason','text'), ('public','care_work_items','reopen_reason','text'),
  ('public','claim_invites','email','email'), ('public','claim_invites','token','token'),
  ('public','client_commercial','notes','text'), ('public','client_commercial','referral_source','text'),
  ('public','client_contacts','first_name','name'), ('public','client_contacts','last_name','name'), ('public','client_contacts','full_name','name'), ('public','client_contacts','email','email'), ('public','client_contacts','phone','phone'), ('public','client_contacts','whatsapp','phone'), ('public','client_contacts','relationship_other','text'), ('public','client_contacts','best_time_to_reach','text'), ('public','client_contacts','authority_basis','text'),
  ('public','clients','first_name','name'), ('public','clients','last_name','name'), ('public','clients','full_name','name'), ('public','clients','preferred_name','name'), ('public','clients','date_of_birth','dob'), ('public','clients','address_line','text'), ('public','clients','landmark','text'), ('public','clients','closed_reason','text'), ('public','clients','paused_reason','text'),
  ('public','contact_submissions','first_name','name'), ('public','contact_submissions','last_name','name'), ('public','contact_submissions','name','name'), ('public','contact_submissions','email','email'), ('public','contact_submissions','phone','phone'), ('public','contact_submissions','message','text'), ('public','contact_submissions','answers','json'),
  ('public','creator_applications','name','name'), ('public','creator_applications','email','email'), ('public','creator_applications','phone','phone'), ('public','creator_applications','message','text'), ('public','creator_applications','portfolio_url','file'), ('public','creator_applications','rate_card_url','file'), ('public','creator_applications','social_links','null'),
  ('public','email_suppressions','email','email'),
  ('public','enquiry_sends','email','email'), ('public','enquiry_sends','actor','name'), ('public','enquiry_sends','subject','text'), ('public','enquiry_sends','error','text'),
  ('public','followup_queue','email','email'),
  ('public','heard_consents','email','email'),
  ('public','heard_letter_recipients','email','email'), ('public','heard_letter_recipients','unsubscribe_token','token'),
  ('public','heard_letters','submitter_email','email'), ('public','heard_letters','sign_it_as','name'), ('public','heard_letters','heading','text'), ('public','heard_letters','content','text'), ('public','heard_letters','moderation_notes','text'), ('public','heard_letters','destination','text'),
  ('public','heard_stories','submitter_email','email'), ('public','heard_stories','sign_it_as','name'), ('public','heard_stories','content','text'), ('public','heard_stories','subject','text'), ('public','heard_stories','moderation_notes','text'),
  ('public','heard_submissions','email','email'), ('public','heard_submissions','content','text'), ('public','heard_submissions','subject','text'), ('public','heard_submissions','moderation_notes','text'),
  ('public','heard_volunteer_applications','answers','json'),
  ('public','heard_volunteer_profiles','first_name','name'), ('public','heard_volunteer_profiles','last_name','name'), ('public','heard_volunteer_profiles','preferred_name','name'), ('public','heard_volunteer_profiles','email','email'), ('public','heard_volunteer_profiles','phone','phone'), ('public','heard_volunteer_profiles','adjustments','text'),
  ('public','heard_volunteers','first_name','name'), ('public','heard_volunteers','last_name','name'), ('public','heard_volunteers','email','email'), ('public','heard_volunteers','motivation','text'), ('public','heard_volunteers','notes','text'),
  ('public','heard_waitlist','email','email'),
  ('public','invoices','client_name','name'), ('public','invoices','client_email','email'), ('public','invoices','client_phone','phone'), ('public','invoices','client_address','text'), ('public','invoices','notes','text'),
  ('public','job_key_audit','actor_email','email'),
  ('public','join_applications','first_name','name'), ('public','join_applications','last_name','name'), ('public','join_applications','name','name'), ('public','join_applications','email','email'), ('public','join_applications','phone','phone'), ('public','join_applications','license_number','id'), ('public','join_applications','criminal_record_details','text'), ('public','join_applications','message','text'), ('public','join_applications','experience','text'), ('public','join_applications','cv_url','file'),
  ('public','matchmaker_applications','full_name','name'), ('public','matchmaker_applications','email','email'), ('public','matchmaker_applications','phone','phone'), ('public','matchmaker_applications','cover_note','text'), ('public','matchmaker_applications','admin_notes','text'), ('public','matchmaker_applications','stage_note','text'), ('public','matchmaker_applications','question_answers','json'), ('public','matchmaker_applications','requirement_answers','json'), ('public','matchmaker_applications','documents','null'),
  ('public','matchmaker_email_log','recipient_email','email'), ('public','matchmaker_email_log','sent_by_name','name'), ('public','matchmaker_email_log','booking_link','token'), ('public','matchmaker_email_log','error','text'),
  ('public','matchmaker_opportunities','client_notes','text'),
  ('public','mu_activity','actor_name','name'), ('public','mu_activity','detail','json'),
  ('public','mu_capabilities','reason','text'),
  ('public','mu_contract_events','actor_name','name'), ('public','mu_contract_events','ip','null'), ('public','mu_contract_events','user_agent','null'), ('public','mu_contract_events','payload','json'),
  ('public','mu_contracts','signed_name','name'), ('public','mu_contracts','countersigned_name','name'), ('public','mu_contracts','created_by_name','name'), ('public','mu_contracts','issued_by_name','name'), ('public','mu_contracts','signature_image','null'), ('public','mu_contracts','countersignature_image','null'), ('public','mu_contracts','signed_ip','null'), ('public','mu_contracts','signed_user_agent','null'), ('public','mu_contracts','sign_token','token'), ('public','mu_contracts','fields','json'), ('public','mu_contracts','issued_fields','json'), ('public','mu_contracts','notes','text'), ('public','mu_contracts','document_url','file'), ('public','mu_contracts','pdf_path','file'),
  ('public','mu_credentials','reference','id'), ('public','mu_credentials','claim','text'), ('public','mu_credentials','note','text'),
  ('public','mu_cv_parses','chunks','json'), ('public','mu_cv_parses','extraction','json'), ('public','mu_cv_parses','fields','json'), ('public','mu_cv_parses','gaps','json'), ('public','mu_cv_parses','document_label','file'),
  ('public','mu_document_extractions','extraction','json'), ('public','mu_document_extractions','classification_evidence','json'),
  ('public','mu_document_requests','note','text'), ('public','mu_document_requests','requested_by_name','name'),
  ('public','mu_documents','url','file'), ('public','mu_documents','source_note','text'), ('public','mu_documents','hold_reason','text'), ('public','mu_documents','review_reason','text'), ('public','mu_documents','conditional_reason','text'), ('public','mu_documents','uploaded_by_name','name'),
  ('public','mu_engagements','notes','text'), ('public','mu_engagements','rate_note','text'), ('public','mu_engagements','created_by_name','name'),
  ('public','mu_field_conflicts','parsed_value','text'), ('public','mu_field_conflicts','stored_value','text'),
  ('public','mu_leave_requests','reason','text'), ('public','mu_leave_requests','decision_note','text'), ('public','mu_leave_requests','decided_by_name','name'),
  ('public','mu_match_rationales','rationale','text'),
  ('public','mu_merge_candidates','reason','text'),
  ('public','mu_offers','message','text'), ('public','mu_offers','decline_reason','text'), ('public','mu_offers','rate_note','text'), ('public','mu_offers','terms','json'), ('public','mu_offers','created_by_name','name'),
  ('public','mu_parsed_fields','value','text'), ('public','mu_parsed_fields','evidence','text'),
  ('public','mu_people','full_name','name'), ('public','mu_people','email','email'), ('public','mu_people','work_email','email'), ('public','mu_people','phone','phone'), ('public','mu_people','address_line','text'), ('public','mu_people','address_area','text'), ('public','mu_people','address_landmark','text'), ('public','mu_people','license_number','id'), ('public','mu_people','admin_notes','text'), ('public','mu_people','joining_statement','text'), ('public','mu_people','promotion_provenance','json'),
  ('public','mu_profile_facets','evidence','text'),
  ('public','mu_references','referee_name','name'), ('public','mu_references','email','email'), ('public','mu_references','phone','phone'), ('public','mu_references','note','text'),
  ('public','mu_shortlists','note','text'), ('public','mu_shortlists','actor_name','name'),
  ('public','mu_staff_emergency_contacts','name','name'), ('public','mu_staff_emergency_contacts','email','email'), ('public','mu_staff_emergency_contacts','phone','phone'), ('public','mu_staff_emergency_contacts','address','text'),
  ('public','mu_verifications','destination','text'), ('public','mu_verifications','code_hash','token'),
  ('public','mu_work_preferences','religion','null'), ('public','mu_work_preferences','client_religion','null'), ('public','mu_work_preferences','notes','text'), ('public','mu_work_preferences','deal_breakers','text'), ('public','mu_work_preferences','updated_by_name','name'),
  ('public','orders','customer_name','name'), ('public','orders','customer_email','email'), ('public','orders','customer_phone','phone'), ('public','orders','paystack_data','null'),
  ('public','otp_codes','email','email'), ('public','otp_codes','code','token'),
  ('public','paystack_invoices','client_name','name'), ('public','paystack_invoices','client_first_name','name'), ('public','paystack_invoices','client_last_name','name'), ('public','paystack_invoices','client_email','email'), ('public','paystack_invoices','client_phone','phone'), ('public','paystack_invoices','notes','text'), ('public','paystack_invoices','hosted_link','null'),
  ('public','profiles','display_name','name'),
  ('public','signup_failures','email','email'), ('public','signup_failures','detail','text'),
  ('private','analytics_candidate_journey','full_name','name'), ('private','analytics_candidate_journey','email','email'),
  ('private','app_config','value','token'),
  ('private','job_keys','value','token')
) as rules(s, t, c, k);

-- 3. Login accounts -----------------------------------------------------------

do $$
begin
  if to_regclass('auth.users') is not null then
    update auth.users set
      email = staging_scrub.fake_email(email),
      phone = staging_scrub.fake_phone(phone),
      raw_user_meta_data = staging_scrub.scrub_json(raw_user_meta_data),
      encrypted_password = null,
      confirmation_token = '', recovery_token = '',
      email_change = '', email_change_token_new = '', email_change_token_current = '',
      phone_change = '', phone_change_token = '', reauthentication_token = '';
  end if;
  if to_regclass('auth.identities') is not null then
    update auth.identities set identity_data = staging_scrub.scrub_json(identity_data);
    update auth.identities set provider_id = staging_scrub.fake_email(provider_id) where provider = 'email';
  end if;
  if to_regclass('auth.sessions') is not null then delete from auth.sessions; end if;
  if to_regclass('auth.refresh_tokens') is not null then delete from auth.refresh_tokens; end if;
  if to_regclass('auth.mfa_factors') is not null then delete from auth.mfa_factors; end if;
  if to_regclass('auth.one_time_tokens') is not null then delete from auth.one_time_tokens; end if;
end $$;

-- Restore readable fake emails into the identity json for email logins.
do $$
begin
  if to_regclass('auth.identities') is not null then
    update auth.identities i
       set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(u.email))
      from auth.users u
     where i.user_id = u.id and i.provider = 'email' and u.email is not null;
  end if;
end $$;

drop schema staging_scrub cascade;

commit;

-- Files in storage are NOT copied to staging. Leave storage buckets empty there.
