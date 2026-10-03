# Workforce, back for compliance and contracts

Bring back a Workforce area, this time only for internal staff: who they are, what documents we hold on them, and what contract they are on. Plus a clean pathway from hired candidate to internal staff member.

## 1. Staff records

New admin area at `/admin/workforce`:

- **Staff list**: name, job title, department, employment type (full time, part time, contract, locum), start date, status (pending invite, active, on notice, exited), contract state chip, documents state chip.
- **Add staff manually**: admin fills in name, work email, personal email, phone, job title, department, reporting line, start date, employment type, location (state and LGA from the controlled pickers), emergency contact, next of kin.
- **Staff record page** with tabs: Overview, Documents, Contract, Access, Activity.

One record per human. A staff member is a `mu_people` row flagged as staff, so a person who came through applications keeps one identity, one document set and one credential ladder.

## 2. Documents and compliance

Staff documents reuse the existing document machinery (`mu_documents`, `mu_document_requests`, review outcomes, expiry) so nothing is rebuilt:

- A staff document checklist separate from the candidate one: ID, right to work, licence or registration, qualifications, references, background check, signed contract, tax and bank details, emergency contact form.
- Admin can request a document; it appears in the person's own profile with a due date and a note.
- Expiry tracking already exists, so a compliance panel on the Workforce list shows expiring or missing items across all staff.

## 3. Contracts (first pass, structure only)

Since the contract template is coming later, this stage builds the container and the states, not the wording:

- `mu_contracts`: person, contract type, job title, start date, end date if fixed term, probation end, notice period, salary or rate, currency, pay frequency, working pattern, location, status (`draft` → `issued` → `signed` → `active` → `ended` | `withdrawn`), issued/signed timestamps, the stored document, and who did what.
- Admin creates a contract, attaches the document, issues it. The staff member sees it in their profile and acknowledges/signs it.
- The record page shows contract history, so renewals and amendments stack rather than overwrite.
- Signature method is left as a switch to settle when the template arrives (typed acknowledgement in-app, or uploaded countersigned copy). Both are supported by the same record.

## 4. Hired candidate → staff

Trigger is a signed contract, as agreed:

```text
role offer accepted -> contract drafted -> issued -> signed
        -> "Invite as staff" unlocks -> permissions prompt -> invite sent
        -> they set a password -> one merged profile
```

- On a person with an accepted role offer, the profile shows a Convert to staff step. It stays disabled with a plain reason ("contract not signed yet") until the contract reaches signed.
- **Invite prompt**: sending the invite always opens a permission checklist, pre-ticked with profile access only. Admin ticks anything more deliberately before the email goes out.
- Invite creates the auth user, links it to the same person record, writes an `admin_permissions` row with the chosen permissions, and grants the admin role.
- No duplicate profile is created. Their documents, credentials, application history and activity trail carry over untouched.

## 5. Access and the two doors

- **Profile-only staff** signing in land on their own staff profile: documents, contract, personal details, availability and leave. They see no admin navigation because they hold no other permissions.
- **Staff with real permissions** get the normal admin sidebar plus a "My profile" entry pointing at their own record.
- Revoking access, force sign out and the login log all keep working, since staff sit in the same `admin_permissions` table.
- Admin cannot review or approve their own documents or contract; those actions are hidden on your own record.

## Technical outline

- `mu_people` gains `is_staff`, `staff_status`, `job_title`, `department`, `employment_type`, `staff_start_date`, `staff_end_date`, `reports_to`, `work_email`.
- New `mu_staff_emergency_contacts` (name, relationship, phone, email, address) and `mu_contracts` as above. Both public schema with GRANTs to `authenticated` and `service_role`, RLS: admin write via existing admin check, the person reads their own rows via `mu_my_person_id()`.
- New `profile_only` permission key so `AdminLayout` can render the self-service shell instead of the sidebar; `ProtectedRoute` keeps gating on the admin role.
- New staff document requirement set in `mu_required_documents`, scoped by a `rule` value for staff.
- RPCs: `mu_create_contract`, `mu_issue_contract`, `mu_sign_contract`, `mu_convert_to_staff` — all security definer, all writing `mu_activity`.
- Edge function: extend `invite-admin` (or a sibling `invite-staff`) to accept a `person_id` and link the new auth user to it, keeping the super-admin-only guard or widening it to a `staff_admin` permission.
- UI: `MatchUniverseWorkforce.tsx` restored as `/admin/workforce` with list plus record page, built on the existing `MuShell` grammar (`MuRecord`, `MuTable`, `MuStatus`); permission prompt dialog reused from Control Centre; sidebar entry back in `AdminLayout`.

## Sequence

1. Data model: staff fields, contracts, emergency contacts, staff document set, RPCs.
2. Workforce list and staff record page, manual staff creation, documents tab.
3. Contract tab: create, issue, sign, history.
4. Conversion pathway: gated Convert to staff, permission prompt, linked invite, profile-only shell.

Contract wording, template fields and any generated document come after you share the template.
