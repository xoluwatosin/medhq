CREATE TABLE public.claim_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'campaign',
  track text,
  person_id uuid,
  sent_at timestamptz,
  opened_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.claim_invites TO service_role;
GRANT SELECT ON public.claim_invites TO authenticated;
ALTER TABLE public.claim_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read claim invites"
ON public.claim_invites FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX claim_invites_token_idx ON public.claim_invites (token);

INSERT INTO public.claim_invites (email, token, source)
SELECT r.email, encode(gen_random_bytes(18), 'hex'), 'campaign-596'
FROM (
  SELECT DISTINCT lower(trim(unnest(manual_recipients))) AS email
  FROM public.campaigns
  WHERE total_recipients = 596
) r
WHERE r.email <> ''
  AND r.email NOT LIKE '%@medicconnect.co'
  AND r.email NOT IN (SELECT lower(email) FROM public.mu_people WHERE email IS NOT NULL)
  AND r.email NOT IN (SELECT lower(email) FROM public.email_suppressions)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.audience_groups (name, description)
VALUES ('Claim your profile - 2026 campaign', 'Past campaign recipients who are not yet in the candidate pool')
ON CONFLICT DO NOTHING;

INSERT INTO public.audience_members (email, group_id, source)
SELECT ci.email, g.id, 'claim-campaign'
FROM public.claim_invites ci
CROSS JOIN (SELECT id FROM public.audience_groups WHERE name = 'Claim your profile - 2026 campaign' LIMIT 1) g
WHERE ci.source = 'campaign-596'
ON CONFLICT DO NOTHING;