INSERT INTO public.campaigns (title, subject, preheader, content, status, audience_type, template, kind, template_data)
SELECT
  'Claim your Medic Connect profile',
  'Your Medic Connect profile is waiting',
  'One profile, and the right work finds you.',
  'Hello {{first_name}},

You heard from us a while ago about work with Medic Connect. Since then we have built something better than a mailing list: a profile that holds your documents, your availability and the kind of work you actually want, so we can put you forward the moment something fits.

We are inviting you to claim yours. It takes a couple of minutes and the link below is personal to you, so there is nothing to look up or remember.

[[cta:Claim my profile|{{claim_url}}]]

**What you get**

- Your documents held once, checked by a person, never asked for twice
- Say when you are free, and only hear about work that fits those days
- Choose your ground: clinical, support and care, non-clinical, or student
- Applications, offers and contracts all in one place

Whether you are a nurse, a doctor, a caregiver, a student on placement or working outside clinical care, there is a route for you. The link asks which one and shapes the rest around your answer.

If you would rather talk it through first, WhatsApp us on +234 812 698 8237.',
  'draft',
  'groups',
  'plain',
  'marketing',
  jsonb_build_object(
    'audience_group_ids', jsonb_build_array(g.id),
    'sender_name', 'Medic Connect',
    'reply_to', 'hello@medicconnect.co'
  )
FROM public.audience_groups g
WHERE g.name = 'Claim your profile - 2026 campaign';