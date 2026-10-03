# Heard as a separate product, same codebase

Foundation work only: routing boundary, data model, security, admin permissions and documentation. No redesign of Medic Connect, no rewrite of Heard copy, no full Heard admin.

## What already exists

- Pages: `src/pages/Heard.tsx`, `src/pages/HeardThanks.tsx`, components in `src/components/heard/`, styles under `.heard-scope` in `src/index.css`.
- Routes: `/heard`, `/heard/thanks`, admin `/admin/heard` (volunteer list).
- Tables: `heard_volunteers` and `heard_waitlist`, both live with data and admin-only read. Both currently allow direct public inserts from the browser, which is the pattern the new tables must not copy.
- Email: the `send-heard-signup` function already handles volunteer and waitlist notifications.
- No hostname awareness anywhere in the app today.

Nothing existing is renamed, dropped or rewritten.

## Host-aware routing

A small host helper decides, at start-up, which product the current hostname serves.

- `heard.medicconnect.co` serves Heard at `/`, with the nine Heard routes directly under the root.
- Every other host keeps Medic Connect exactly as it is today.
- `/heard` stays as a working fallback on Medic Connect hosts and continues to open the existing Heard page.
- In Lovable preview and local development the Heard experience is opened either at `/heard` or by adding `?product=heard` to any address, which pins the Heard product for that browser session. This keeps preview fully usable before the domain exists.
- Heard pages are rendered inside the existing `.heard-scope` shell only, so no Care or clinical styling leaks in.

New Heard consumer routes are created as shells using the existing Heard shell and typography: `/`, `/write`, `/story-swap`, `/letters`, `/letters/leave`, `/talk`, `/about`, `/support`, `/privacy`. They are placeholders with headings and the intake forms wired later, not finished copy.

Heard pages are excluded from the Medic Connect sitemap and AI listings and marked noindex for now.

## Data model (additive migration)

New tables, all prefixed `heard_`, none linked to Care, Workforce, Candidate or `mu_*` records:

- `heard_submissions` — Write to us. Subject, body, contact email, status, moderation state, timestamps.
- `heard_stories` — Story Swap. Subject, story, sign-it-as, submitter email, moderation status, matching and delivery state, timestamps. No public exposure, no matching in the interface.
- `heard_letters` — heading, body, sign-it-as, submitter email, moderation state, approval state, and a single destination field that is either public Letter Room or email distribution, never both.
- `heard_letter_recipients` — email, subscription status, consent version, subscribed and unsubscribed timestamps.
- `heard_letter_deliveries` — letter, recipient, delivery status, sent time, provider message reference, with a uniqueness constraint so the same recipient can never receive the same letter twice.
- `heard_consents` — one row per consent act: consent type (letter use, or receiving letters), version, timestamp, withdrawal timestamp. No generic boolean.

`heard_waitlist` is reused for phone-line notifications; no second waitlist table.

Identity rule written into the schema and the document: no foreign keys or matching logic tie a Heard record to a Medic Connect person by email, name or phone. An `auth_user_id` column is present only where an authenticated Heard account might later anchor a record.

## Security

- Row Level Security on every new table, with no public read and no public insert.
- Public submissions go through security-definer database functions called by an edge function, following the pattern already used elsewhere in the project. IDs, timestamps, status and moderation fields are set server side and cannot be supplied by the caller.
- The public cannot read submissions, emails, moderation state, matches, recipients or delivery history.
- The public Letter Room reads through a dedicated function that returns only heading, body, signature and public identifier for letters explicitly approved for public display. The letters table itself is never public.
- Existing public insert on `heard_volunteers` and `heard_waitlist` is left alone in this pass and noted as a follow-up.

## Heard admin boundary

Heard permission keys are added to the existing access model so they appear as tick boxes in Admin access: `heard_content_review`, `heard_story_swap_manage`, `heard_letters_manage`, `heard_delivery_manage`, `heard_volunteers_manage`. General Care access grants none of them. A minimal `/admin/heard` domain shell is established; the existing volunteer list stays where it is. Full moderation screens are deferred.

## Documentation

`docs/heard/architecture.md` records the shared codebase and backend, the separate data domain, the `heard_` namespace, the no-merge identity rule, host-aware routing and the preview fallback, the security and admin boundaries, the no-account consumer model, moderated email-only Story Swap, the two letter destinations, and what is deferred.

## Deliberately deferred

Full Heard admin and moderation screens, volunteer product, real Letter Room content, final Heard copy, DNS and domain connection, and changing the existing public insert paths on the two live Heard tables.

## Manual step afterwards

`heard.medicconnect.co` must be added as a domain in project settings and pointed at the app. Until then the preview fallback is the way in.
