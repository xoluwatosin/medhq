# Heard security hardening: volunteer sign-ups and phone-line waitlist

Bring the two original Heard lists behind the same controlled server-side submission path used by the new Heard tables, without changing what anyone sees on the page and without touching existing records.

## What is true today

- The Heard volunteer form writes straight from the browser into `heard_volunteers`.
- The Heard phone-line form writes straight from the browser into `heard_waitlist`.
- Both tables allow public inserts (`Anyone can sign up as a Heard volunteer`, `Anyone can join Heard waitlist`). Reading, updating and deleting are already restricted to admins.
- `heard_waitlist` has a free-text `source` field only, no governed purpose. It currently holds no rows. `heard_volunteers` holds two rows, both with distinct email addresses.
- Both tables carry campaign and referrer fields the browser could set freely today.

## What will change

### 1. Controlled submission path

Extend the existing `heard-submit` server route with two further submission types: volunteer interest and phone-line notification. Each validates the fields and calls a database function that derives the identifier, timestamps and status. The browser no longer writes to either table.

Validation mirrors the current form rules: first name, last name, email, state and role are required for volunteers; a valid email is required for the phone line. Values are trimmed and length-capped.

### 2. Security

Remove the public insert permission on both tables and remove public insert grants, so anonymous visitors can no longer insert, select, update, delete or enumerate email addresses. Admin reading and management stay exactly as they are, so the Heard applications screen is unaffected.

### 3. Repeated submissions

Documented behaviour:

- Phone-line list: one row per email address per purpose. A repeat sign-up updates the existing row rather than creating a duplicate, and the person still sees the normal confirmation.
- Volunteer interest: if the same email address applies again while the earlier sign-up is still unreviewed, that sign-up is refreshed with the new answers. Once a sign-up has been reviewed, a later application is recorded as a new row so the history is not overwritten.

### 4. Waitlist purpose

Add a `purpose` field to `heard_waitlist`, defaulting to the phone-line launch notification, with the existing `source` field preserved for campaign attribution. Uniqueness is per email and purpose, so the table can safely hold other Heard lists later without them being read as phone-line sign-ups.

### 5. Visible behaviour

Both forms keep their current wording, fields, confirmation and thank-you page. The existing notification emails continue to be sent. No existing record is altered or removed.

## Technical notes

- Migration (additive, rollback-safe): add `heard_waitlist.purpose text not null default 'phone_line'`; add a unique index on `(lower(email), purpose)` for the waitlist; drop the two public INSERT policies and revoke `anon` insert; add security-definer functions `heard_submit_volunteer` and `heard_join_waitlist`, executable by the service role only.
- Edge function: add `volunteer_interest` and `phone_waitlist` kinds to `supabase/functions/heard-submit/index.ts`.
- Frontend: `HeardSignupForm.tsx` and `HeardWaitlistForm.tsx` swap their direct inserts for `heard-submit`; the notification email call is unchanged.
- No other Medic Connect table, function or flow is touched.
- `docs/heard/architecture.md` records the final write path, the duplicate rules and the waitlist purpose field.

## Verification

Typecheck, test suite and build; browser check that both Heard forms still submit and confirm; confirm an anonymous insert into either table is now rejected; confirm the two existing volunteer rows are unchanged.

Work stops after this pass.
