# Heard architecture

Heard is a distinct product that shares Medic Connect's codebase and backend. It does not share operational data.

## Shared technology, separate product

- Heard lives in the same repository and the same Lovable Cloud backend project. There is no second backend.
- Heard is a separate operational data domain. Every Heard table carries the `heard_` prefix.
- Heard never uses Care, Workforce, Candidate, `mu_*`, clinical or staffing records as its person records.
- Identities are never merged across products. A matching email address, telephone number or name does not make a Heard person and a Medic Connect person the same person. Email is contact information, not identity.
- Heard volunteer accounts use the authenticated user ID as their only identity anchor. Their Heard operational record stays distinct from every Medic Connect record.

## Host-aware routing

| Hostname | Product |
| --- | --- |
| `heard.medicconnect.co` | Heard, served at `/` |
| `medicconnect.co`, `www.medicconnect.co`, previews | Medic Connect, unchanged |

`src/lib/heard-host.ts` decides this. `src/pages/heard/HeardRoutes.tsx` is the entire Heard route set: `/`, `/write`, `/story-swap`, `/letters`, `/letters/leave`, `/talk`, `/about`, `/support`, `/privacy`, `/get-involved`, role selection and volunteer account/recovery routes, plus `/thanks`. No Medic Connect route is exposed on the Heard host.

### One route definition, two mount points

The Heard pages are defined once and mounted twice. Route paths inside `HeardRoutes` are relative, so the same component tree serves either mount. No Heard page is duplicated.

| Where | Mount | Example |
| --- | --- | --- |
| `heard.medicconnect.co` | root, base `""` | `/story-swap` |
| Preview, local, `medicconnect.co` | `/heard-preview`, base `"/heard-preview"` | `/heard-preview/story-swap` |

`HEARD_PREVIEW_BASE` in `src/lib/heard-host.ts` defines the prefix; `src/components/heard/HeardBase.tsx` carries the active base and `useHeardPath()` builds every internal Heard link and page path from it. Navigation inside the preview therefore keeps the prefix, and `/story-swap` on a Medic Connect host stays a Medic Connect address.

Deep links and direct refreshes work on every preview route: unknown paths are served the app shell and the router matches the prefix.

There is no product query parameter. `?product=heard` has been retired.

`/heard` and `/heard/thanks` remain the legacy pre-launch page on Medic Connect hosts. They are not part of the new Heard mount and are not an architectural dependency; whether to redirect, replace or retire them is a separate decision. Components rendered outside either mount default to the `/heard` base so the legacy page keeps working.

Heard pages are `noindex`, are not in the Medic Connect sitemap or AI listings, and `/heard-preview` is disallowed in `public/robots.txt`.

## Data model

| Table | Purpose |
| --- | --- |
| `heard_submissions` | Write to us: subject, content, contact email, status, moderation state |
| `heard_stories` | Story Swap: story, sign-it-as, submitter email, moderation, matching and delivery state |
| `heard_letters` | Letters: heading, content, sign-it-as, submitter email, moderation, approval, single destination |
| `heard_letter_recipients` | Opt-in list for letters by email, with consent version and unsubscribe record |
| `heard_letter_deliveries` | Delivery ledger, unique on (letter, recipient) so nobody receives the same letter twice |
| `heard_consents` | One row per consent act: `letter_use`, `letter_receipt`, `story_use`, `submission_use`, with version, timestamp and withdrawal |
| `heard_volunteers` | Volunteer interest sign-ups |
| `heard_waitlist` | Notification lists, governed by `purpose` (`phone_line` by default) |
| `heard_volunteer_profiles` | Authenticated volunteer account details: separate names, selected role and application status |


A letter's `destination` is a single value: `letter_room` or `email_distribution`. Public display and email distribution are therefore mutually exclusive.

Consent is never a single boolean. Someone may submit a letter without agreeing to receive letters, and may receive letters without ever submitting one.

## Security

- Row Level Security is on for every Heard table. There is no public read and no public insert on any Heard table, including `heard_volunteers` and `heard_waitlist`.
- Public submissions go through security-definer functions: `heard_submit_message`, `heard_submit_story`, `heard_submit_letter`, `heard_subscribe_letters`, `heard_submit_volunteer`, `heard_join_waitlist`. Execution is granted to the service role only, so the browser reaches them through the `heard-submit` edge function. Identifiers, timestamps, status, moderation and audit fields are server-derived.
- The public cannot enumerate submissions, read other people's content or email addresses, inspect moderation state or delivery history, or read recipient lists.
- Volunteer profiles allow authenticated users to read and update only their own row. Profile registration is bound to `auth.uid()` by `heard_register_volunteer_profile`; no browser-supplied user ID is accepted. Heard volunteer administrators retain separately permissioned access.
- The public Letter Room reads through `heard_public_letters`, which returns only heading, content, signature, public reference and publication date for letters approved for the Letter Room. The `heard_letters` table itself is never public.

### Volunteer interest and phone-line notifications

The volunteer form sends `volunteer_interest` and the phone-line form sends `phone_waitlist` to `heard-submit`. Neither form writes to a table from the browser.

Repeat submissions are handled deliberately:

- Phone line: one row per email address per purpose. A repeat sign-up refreshes the existing row and the person still sees the normal confirmation. Enforced by a unique index on `(lower(email), purpose)`.
- Volunteer interest: a repeat application from the same email address while the earlier sign-up is still `new` updates that sign-up. Once it has been reviewed, a later application is stored as a separate row so review history is not overwritten.

Email is used only to deduplicate within a single Heard list. It is never an identity key across Heard and Medic Connect.

`heard_waitlist.purpose` records what a row means. It defaults to `phone_line`, so any other Heard notification list added later must declare its own purpose rather than being read as a phone-line sign-up.


## Admin boundary

Heard moderation is not part of general Care access. `private.heard_can(permission)` requires an active admin who also holds the specific Heard permission:

- `heard_content_review`
- `heard_story_swap_manage`
- `heard_letters_manage`
- `heard_delivery_manage`
- `heard_volunteers_manage`

These appear as their own group in Admin access. The existing volunteer list remains at `/admin/heard`.

## Product boundaries

- Consumer listening, writing, Story Swap and Letters require no account. Volunteer applications have a separate email/password account journey. There are no public profiles, social features or direct messaging.
- Story Swap is not user-to-user. Stories are submitted to Heard, moderated, matched administratively and delivered by email. A recipient never sees the submitter's email address.
- Heard is not merged with Medic Connect Care client journeys.

## Consumer experience (built)

The finished consumer pages live in `src/pages/heard/` and use the `.heard-v2` element
library only: `src/index.css` (scoped tokens), `src/components/heard/v2/HeardKit.tsx`,
`HeardLayout.tsx`, `HeardMark.tsx`, `HeardSecretSignup.tsx` and `heardSubmit.ts`.

- Routes: `/`, `/write`, `/story-swap`, `/letters`, `/letters/leave`, `/talk`, `/about`,
  `/support`, `/privacy`, `/get-involved` and volunteer account/recovery routes, plus a Heard-styled not-found. All mount at the Heard hostname
  root and under `/heard-preview` elsewhere.
- Every write goes through `heardSubmit()` to the `heard-submit` Edge Function. The
  browser never writes to a `heard_` table.
- The Letter Room reads `heard_public_letters` only, one letter at a time, and shows no
  moderation or contact fields.
- Required letter consent and the optional "send me letters too" opt-in are separate
  records: the letter submission carries `letter_use`, and the opt-in is a separate
  `letter_subscribe` submission recording `letter_receipt`.
- The Medic Connect accessibility panel and live chat are suppressed on Heard routes.
- Heard pages are noindex and excluded from the Medic Connect sitemap and AI listings.
- Email presentation for Story Swap and Letters is in
  `supabase/functions/_shared/heard-emails.ts`. Layout only; delivery comes with admin.

## Deferred

Full Heard admin and moderation screens, the volunteer questionnaire and application workflow after account verification, real Letter Room content,
automated Story Swap and Letter delivery, the Heard Terms and Conditions page (linked as a
placeholder on the leave-a-letter consent) and the full Heard privacy notice (the privacy
page currently explains product handling only). Verified support-service listings are
pending sign-off. `heard.medicconnect.co` is connected, verified and has the correct DNS
records; the project primary-domain redirect must be unset so the hostname serves Heard
directly instead of redirecting to `www.medicconnect.co`.

## Visual layer: expanded element library (v2)

The `.heard-v2` scope now uses more of the Heard element kit, without adding a
second visual system and without changing routing, schema, RLS or submission
paths.

- `HeardLogo` is the approved Primary horizontal lockup treatment from the supplied workbook (official mark plus "Heard / by Medic Connect") and is used in the header, mobile sheet and footer. `HeardMark`
  remains the standalone infinity for watermarks, dividers and letter feet.
- `HeardWatermark` renders the infinity inside its own clipping layer, so the
  whole shape is laid out and the homepage watermark is no longer cut.
- New kit primitives: `HeardReveal` (scroll settle), `HeardSteps`,
  `HeardIndexMarker`, `HeardQuote`, `HeardLetterPaper` and
  `HeardLetterSkeleton`.
- Homepage: indexed destination blocks, a Letter Room panel that quotes a line
  from an approved public letter when one exists, and a closing mark.
- Letter Room: approved letters are readable immediately and remain presented as paper on a three-sheet stack. “One more letter” selects another approved public letter; the secure read path and letter-shaped loading state are unchanged.
- Write and Leave a letter: two-column guidance and form, character counts,
  step markers and a fuller confirmation state.

Motion is restrained and every animation is suppressed under
`prefers-reduced-motion: reduce`.

- Heard surfaces use pure white (#FFFFFF) as the Bright White token.
- `HeardSplitPanel` (half Late, half white) carries the volunteer sign-in and create-account screens; it stacks to a compact dark header above the form below 768px.
