-- Personal claim tokens for people already in the candidate pool
INSERT INTO public.claim_invites (email, token, source, person_id, track)
SELECT lower(trim(p.email)), encode(gen_random_bytes(18), 'hex'), 'candidate-pool', p.id, NULL
FROM public.mu_people p
WHERE p.email IS NOT NULL
  AND trim(p.email) <> ''
  AND p.auth_user_id IS NULL
  AND lower(p.email) NOT LIKE '%@medicconnect.co'
  AND lower(trim(p.email)) NOT IN (SELECT lower(email) FROM public.email_suppressions)
ON CONFLICT (email) DO NOTHING;

-- Attach person_id to any pool invite that already existed without one
UPDATE public.claim_invites c
SET person_id = p.id
FROM public.mu_people p
WHERE c.person_id IS NULL AND lower(p.email) = lower(c.email);

INSERT INTO public.audience_groups (name, description)
VALUES ('Candidate pool - claim invite', 'People already in the candidate pool who have not linked an account yet')
ON CONFLICT DO NOTHING;

INSERT INTO public.audience_members (email, name, group_id, source)
SELECT lower(trim(p.email)),
       nullif(trim(coalesce(p.full_name, '')), ''),
       (SELECT id FROM public.audience_groups WHERE name = 'Candidate pool - claim invite' LIMIT 1),
       'candidate-pool'
FROM public.mu_people p
WHERE p.email IS NOT NULL
  AND trim(p.email) <> ''
  AND p.auth_user_id IS NULL
  AND lower(p.email) NOT LIKE '%@medicconnect.co'
  AND lower(trim(p.email)) NOT IN (SELECT lower(email) FROM public.email_suppressions)
  AND lower(trim(p.email)) NOT IN (
    SELECT lower(email) FROM public.audience_members
    WHERE group_id = (SELECT id FROM public.audience_groups WHERE name = 'Candidate pool - claim invite' LIMIT 1)
  );