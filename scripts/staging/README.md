# Staging database

A staging copy of the live database for testing migrations and new features. Live data is only ever read; staging gets a copy with personal data replaced.

## Steps

1. Create the staging Supabase project (same region as live).
2. Restore the latest export into it with `scripts/migration/restore.sh` and `apply-acls.sh`, pointing `DATABASE_URL` at **staging**.
3. Scrub it:

   ```sh
   STAGING_DATABASE_URL='postgresql://...staging...' scripts/staging/scrub.sh
   ```

   The script refuses the live and old Lovable projects, and asks you to type the staging project ref.
4. Do not copy storage files. Staging buckets stay empty.
5. Do not set real edge function secrets (Resend, Paystack live keys, Anthropic) on staging. Use test keys or none.

## What scrub.sql does

- Turns off every scheduled job and runs with triggers off, so nothing can message a real person.
- Replaces names, emails, phones, addresses, notes and free text with fake values. The same real email always becomes the same fake one, so records stay linked.
- Keeps option codes, ids, numbers and dates inside questionnaire answers so the app behaves as it does live; birth dates keep only their year.
- Clears passwords, sessions, tokens, IP addresses, signatures and stored secrets.
- Runs in one transaction: it either completes or changes nothing.

`scrub-check.sql` then lists any column that still holds an email outside `example.invalid`.

When a migration adds a column with personal data, add it to the list in `scrub.sql`.
