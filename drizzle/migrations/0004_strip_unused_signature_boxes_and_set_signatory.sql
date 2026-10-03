-- 1. Remove the unused printed signature boxes from the annex library HTML
create or replace function public.mu_strip_sig_boxes(_html text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     regexp_replace(coalesce(_html,''),
                       '\s*<table>\s*<tr><td>Name</td><td></td></tr>\s*<tr><td>Role / cadre</td>.*?</table>', '', 'gs'),
                     '\s*<table>\s*<tr><td>Name</td><td></td></tr>\s*<tr><td>Cadre</td>.*?</table>', '', 'gs'),
                   '\s*<table>\s*<tr>\s*<td>\s*<div>Personnel</div>.*?</table>', '', 'gs'),
                 '\s*<table>\s*<tr><td>Postholder signature</td>.*?</table>', '', 'gs'),
               '<p>(Personnel|Full name and position|Full name|Signature|Date|For Medic Connect|Role|Position)</p>', '', 'g'),
             '<p>(Name Role / cadre|Name Cadre|Postholder signature)[^<]*</p>', '', 'g'),
           'Where the Contract Annexes and Acknowledgement schedule has been signed, this block may be left blank\.\s*|Signed in two copies\. One is retained on your personnel file, one is yours to keep\.\s*', '', 'g')
$$;

update public.mu_contract_annex_library
set body = public.mu_strip_sig_boxes(body), updated_at = now()
where body <> public.mu_strip_sig_boxes(body);

-- 2. Same clean-up on annexes already copied onto contracts that are not yet completed
update public.mu_contracts c
set annexes = (
  select jsonb_agg(
    case when a ? 'body'
      then jsonb_set(a, '{body}', to_jsonb(public.mu_strip_sig_boxes(a->>'body')))
      else a end
    order by ord)
  from jsonb_array_elements(c.annexes) with ordinality t(a, ord)
)
where jsonb_typeof(annexes) = 'array'
  and jsonb_array_length(annexes) > 0
  and status in ('draft','issued');

-- 3. Company signatory for Ayamke Joyce's contracts
update public.mu_contracts
set fields = jsonb_set(fields, '{signatory_name}', to_jsonb('Francisca Abosede, Chief Executive Officer'::text)),
    issued_fields = case when issued_fields is null then null
      else jsonb_set(issued_fields, '{signatory_name}', to_jsonb('Francisca Abosede, Chief Executive Officer'::text)) end
where person_id in (select id from public.mu_people where full_name ilike '%ayamke%joyce%')
  and status in ('draft','issued');

drop function public.mu_strip_sig_boxes(text);