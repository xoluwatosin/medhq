# Heard

Write to us, Story Swap, the Letter Room and the volunteer portal, served at
heard.medicconnect.co. Extracted from the Medic Connect codebase in October
2026; it shares no code, database or hosting with Medic Connect.

## Run it

```sh
npm install
cp .env.example .env   # Heard project's URL and anon (legacy JWT) key
npm run dev            # http://localhost:8080
```

`npm run build`, `npm run typecheck`, `npm run lint`.

## Backend

Its own Supabase project.

- `supabase/migrations/20261004000000_heard_baseline.sql`: every table,
  policy and function. Apply with `npx supabase db push` after
  `npx supabase link --project-ref <ref>`, or paste into the SQL editor.
- `supabase/functions/heard-submit`: the only public write path. Deploy with
  `npx supabase functions deploy heard-submit --project-ref <ref>`.
  Optional secret `EXTRA_ALLOWED_ORIGINS` (comma-separated) for preview or
  local origins.

### Admins

`/admin` lists volunteers, applications and the phone-line waitlist. Access
comes from `heard_admins`. After signing up on the site, grant yourself
access in the SQL editor:

```sql
insert into public.heard_admins (user_id, permissions)
select id, array['heard_content_review','heard_story_swap_manage','heard_letters_manage',
                 'heard_delivery_manage','heard_volunteers_manage']
from auth.users where email = 'you@example.com';
```

### Fonts

Figtree is self-hosted from `public/fonts` (see `src/index.css`).
