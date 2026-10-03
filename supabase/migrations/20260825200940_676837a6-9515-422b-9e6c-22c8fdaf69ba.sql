INSERT INTO public.campaigns (title, subject, preheader, status, audience_type, kind, manual_recipients, template_data, blocks, content)
SELECT
  'Claim your profile - candidate pool',
  'Your Medic Connect profile is ready to claim',
  'Everything we already hold for you, in one place.',
  'draft',
  'groups',
  'marketing',
  ARRAY[(SELECT id::text FROM public.audience_groups WHERE name = 'Candidate pool - claim invite' LIMIT 1)],
  jsonb_build_object(
    'audience_group_ids', jsonb_build_array((SELECT id::text FROM public.audience_groups WHERE name = 'Candidate pool - claim invite' LIMIT 1)),
    'from_email', 'hello@medicconnect.co',
    'reply_to', 'hello@medicconnect.co',
    'sender_name', 'Medic Connect'
  ),
  jsonb_build_array(
    jsonb_build_object('blockId','mh-campaign','id',gen_random_uuid()::text,'images',jsonb_build_object(),'links',jsonb_build_object(),'slots',jsonb_build_object('strapline','Home nursing and caregiving, Lagos')),
    jsonb_build_object('blockId','text-body','id',gen_random_uuid()::text,'images',jsonb_build_object(),'links',jsonb_build_object(),'slots',jsonb_build_object('body', E'Hello {{first_name}},\n\nYou are already on our books at Medic Connect, and we have built you somewhere better to live than a spreadsheet. Your profile holds your documents, your availability and the kind of work you actually want, so we can put you forward the moment something fits.\n\nThe link below is personal to you. It attaches your account to the record we already hold, so nothing you have sent us is lost or asked for twice.\n\n[[cta:Claim my profile|{{claim_url}}]]\n\n**What claiming does**')),
    jsonb_build_object('blockId','text-body','id',gen_random_uuid()::text,'images',jsonb_build_object(),'links',jsonb_build_object(),'slots',jsonb_build_object('body', E'- Keeps your documents in one place, checked by a person, never requested twice\n- Lets you say when you are free, so you only hear about work on those days\n- Confirms your state, local government area and profession as your own words, not a guess\n- Shows your applications, offers and contracts in one place\n\nIt takes a couple of minutes. If you would rather talk it through first, WhatsApp us on +234 812 698 8237.')),
    jsonb_build_object('blockId','ft-marketing','id',gen_random_uuid()::text,'images',jsonb_build_object(),'links',jsonb_build_object('instagram','https://www.instagram.com/medicconnect','linkedin','https://www.linkedin.com/company/medicconnect','preferences','https://medicconnect.co/unsubscribe','unsubscribe','https://medicconnect.co/unsubscribe','website','https://medicconnect.co'),'slots',jsonb_build_object('blurb','Home nursing and caregiving in Lagos, matched to a plan built from a nurse led assessment.'))
  ),
  ''
WHERE NOT EXISTS (SELECT 1 FROM public.campaigns WHERE title = 'Claim your profile - candidate pool');