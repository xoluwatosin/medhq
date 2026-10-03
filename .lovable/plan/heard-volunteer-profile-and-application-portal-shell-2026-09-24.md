# HEARD volunteer profile and application portal shell

## Boundaries
- One sign-in identity (existing account and session). No second auth system.
- Volunteer data lives only in `heard_volunteer_profiles` and `heard_volunteer_applications`. No links to Medic Connect candidate, workforce or Care records. No merging by email.
- Database-enforced access: volunteers read and update only their own profile and read only their own applications. They cannot change role, status or stage. Admins need the `heard_volunteers_manage` permission.
- Styling stays inside the HEARD scope. No global style changes.

## Location and contact rules
1. Country: searchable list, stored as ISO 3166-1 alpha-2 (`NG`, `GB`, `US`...). Nigeria first, then frequent countries, then A to Z.
2. State / region: searchable list of the country's ISO 3166-2 subdivisions, stored as code plus name (`NG-FC`, `GB-ENG`, `US-CA`).
3. LGA: shown for Nigeria only, filtered by state, from the existing Nigerian locations list. Optional. Other countries: optional city/town only (no free-text subdivision).
4. Phone: no dial-code picker. Dial code follows the country; leading zero stripped; national length checked; stored as E.164 (prevents `+234234...` corruption).
5. Time zone: suggested from country and subdivision, checked against the device time zone, shown for confirmation with a fallback list.

## Data
`heard_volunteer_profiles` (extended, additive): first_name, last_name, preferred_name, email (read-only copy), phone, country_code, subdivision_code, subdivision_name, lga, city, timezone, languages (list of language + proficiency: native, fluent, conversational, basic; min 1), adjustments, adjustments_discuss_privately, role_interest (fixed at sign-up), created_at, updated_at.

`heard_volunteer_applications` (new): id, profile_id, user_id, role, status (only `application_started` in this build), answers (reserved), created_at, updated_at. History kept; earlier applications never overwritten.

Server functions:
- `heard_bootstrap_volunteer()`: finds or creates the caller's profile and one open application. Safe to repeat; never duplicates.
- `heard_update_volunteer_profile(...)`: saves personal and contact fields only. Cannot touch role, status or application.

## Applicant journey
- Role choice (existing roles: Peer listener, Social media, Mental health professional) → Apply to volunteer (first name, last name, email, password; role saved with the account) → verification email.
- Verification link and sign-in both land on `/volunteer/portal`, replacing the verification dead end.

## Portal (`/volunteer/portal`)
- Header: first name, role, "Application started", and the agreed welcome message.
- Navigation: tabs on desktop, compact picker on phone.
- My details: form with the fields above; role shown as a read-only summary; email read-only with the existing verified change process; one "Save changes" button; "Changes saved." Saving never changes the application stage.
- Application, Interview, Documents, Training: the agreed one-line messages only. No buttons, uploads, calendars or progress.
- Account settings: existing password change and sign out, HEARD styling.

## Admin (`/admin/heard`)
Three tabs:
1. Applications (account-based): Name, Email, Selected role, Application status, Date started. Search, role filter, read-only detail view.
2. Legacy interest: existing volunteer-interest list, unchanged.
3. Phone waitlist: existing list, unchanged.

## Out of scope
Application questions, interview booking, document uploads, training, clinical screening, reviewer decisions, publishing.

## Checks
- New verified volunteer reaches the portal; existing volunteer reaches the same portal on sign-in.
- Refresh or re-sign-in creates no duplicates.
- Country change updates dial code, subdivisions and time zone.
- Detail changes persist and leave status unchanged.
- One volunteer cannot read another's records; admin with permission sees new applications.
- Medic Connect candidate portal flows unchanged.

## Technical details
- Reuse: AuthContext, existing password rules and error handling, `nigeria-locations.ts`, `languages.ts`, admin Table/Badge/Dialog/ExportDropdown/ConsoleMobileList, HeardKit and HeardLayout.
- New: `src/lib/heard-portal.ts`, `src/lib/geo-iso.ts` (countries, dial codes, subdivisions via a small bundled ISO 3166-2 dataset, time zone hints), `src/pages/heard/HeardVolunteerPortal.tsx`, one migration with grants, RLS and the two functions.
- Cost note: this is a medium-large build; expect several credits.
