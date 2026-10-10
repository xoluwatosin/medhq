-- A document decision is the credential decision. Safe to run twice.
--
-- Until now staff judged a licence twice: they accepted the licence document
-- in Document review (which said "Accepting verifies the linked credential",
-- though it did not), then opened the profile and passed the licence
-- credential by hand. Each document type already lists what it proves
-- (mu_document_types.evidences), so the decision on the document now settles
-- those credentials, whichever screen or job made it:
--   - accepted (including accepted for now): each credential the type proves
--     takes this document as its evidence and passes document review, with
--     the document's expiry;
--   - returned, or put back to pending, after being accepted: any credential
--     this document was the evidence for loses it and goes back to waiting.
-- Register checks and employer references (other verification methods) are
-- left alone.

create or replace function private.mu_document_settles_credentials()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _types text[];
begin
  if new.review_outcome is not distinct from old.review_outcome
     and new.expires_at is not distinct from old.expires_at then
    return new;
  end if;

  select coalesce(array_agg(t), '{}') into _types
    from public.mu_document_types dt, unnest(dt.evidences) t
   where dt.code = new.doc_type
     and t in ('licence', 'right_to_work', 'nysc', 'qualification', 'id');

  if new.review_outcome = 'accepted' and cardinality(_types) > 0 then
    insert into public.mu_credentials as c
      (person_id, credential_type, evidence_document_id, evidence_at, expires_at,
       verified_by, verified_at, verification_method, verification_outcome)
    select new.person_id, t, new.id, now(), new.expires_at,
           new.reviewed_by, coalesce(new.reviewed_at, now()), 'document_review', 'pass'
      from unnest(_types) t
    on conflict (person_id, credential_type) do update set
      evidence_document_id = excluded.evidence_document_id,
      evidence_at = excluded.evidence_at,
      expires_at = coalesce(excluded.expires_at, c.expires_at),
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      verification_method = 'document_review',
      verification_outcome = 'pass',
      updated_at = now()
    where c.verification_method is null or c.verification_method = 'document_review';
  elsif old.review_outcome = 'accepted' and new.review_outcome <> 'accepted' then
    update public.mu_credentials
       set evidence_document_id = null, evidence_at = null,
           verified_by = null, verified_at = null,
           verification_method = null, verification_outcome = null,
           updated_at = now()
     where person_id = new.person_id
       and evidence_document_id = new.id
       and (verification_method is null or verification_method = 'document_review');
  end if;
  return new;
end;
$$;

drop trigger if exists mu_document_settles_credentials on public.mu_documents;
create trigger mu_document_settles_credentials
after update of review_outcome, expires_at on public.mu_documents
for each row execute function private.mu_document_settles_credentials();

-- Documents accepted before today: settle the credentials they prove where
-- nobody has decided the credential yet. The newest accepted document wins.
do $$
declare _n integer;
begin
  with best as (
    select distinct on (d.person_id, t)
           d.person_id, t as credential_type, d.id as document_id, d.expires_at,
           d.reviewed_by, coalesce(d.reviewed_at, d.updated_at, d.created_at) as at
      from public.mu_documents d
      join public.mu_document_types dt on dt.code = d.doc_type
      cross join lateral unnest(dt.evidences) t
     where d.review_outcome = 'accepted'
       and t in ('licence', 'right_to_work', 'nysc', 'qualification', 'id')
     order by d.person_id, t, coalesce(d.reviewed_at, d.updated_at, d.created_at) desc
  ), done as (
    insert into public.mu_credentials as c
      (person_id, credential_type, evidence_document_id, evidence_at, expires_at,
       verified_by, verified_at, verification_method, verification_outcome)
    select person_id, credential_type, document_id, at, expires_at,
           reviewed_by, at, 'document_review', 'pass'
      from best
    on conflict (person_id, credential_type) do update set
      evidence_document_id = excluded.evidence_document_id,
      evidence_at = excluded.evidence_at,
      expires_at = coalesce(excluded.expires_at, c.expires_at),
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      verification_method = 'document_review',
      verification_outcome = 'pass',
      updated_at = now()
    where c.verification_outcome is null
    returning 1
  )
  select count(*) into _n from done;
  raise notice 'Credentials settled from accepted documents: %', _n;
end $$;
