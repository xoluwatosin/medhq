# Medic Connect Care: account, client profile and family access model

Revision 2, 12 September 2026. Ratified model. Revision 1 was investigation only; this revision supersedes its recommended model in section 2 and its answers in section 3, keeping the findings in section 1.

Implementation order and tranches live in `docs/care-platform/implementation-plan.md`. System-wide contract lives in `docs/care-platform/architecture.md`.

---

## 1. What exists today (findings, carried from Revision 1)

### 1.1 One auth instance, two doors

Staff sign in at `/auth` with password plus a mandatory six digit code (`admin-otp`, codes in `otp_codes`). Candidates sign in at `/portal/login` with password or a mailed link. Both use the same Supabase auth user pool. Authority is decided after sign-in: `user_roles` plus `admin_permissions` for staff, `mu_people.auth_user_id` for candidates.

### 1.2 Candidate identity is a solved pattern worth reusing

- A person record (`mu_people`) exists before any account.
- `mu_claim_my_person()` (security definer) links `auth.uid()` to an unlinked person row. It trusts only `auth.uid()` and the confirmed address on `auth.users`, never a client-supplied id.
- `mu_my_person_id()` is the single read helper behind every candidate RLS policy.
- Pre-account invitations live in `claim_invites` (email, random token, `person_id`, `sent_at`, `opened_at`, `claimed_at`). Account creation goes through normal sign-up.
- Password creation and reset use `generateLink` with `token_hash` handed to `/portal/set-password`, deliberately not Supabase's own redirect, because mail scanners prefetch and burn single-use links.
- Contact verification is separate from authentication: `mu_verifications` holds a hashed six digit code proving the person can actually be reached.

### 1.3 The care client model has no account concept

`clients` holds the care recipient only. All reachable humans live in `client_contacts` (`relationship`, `is_primary`, `is_enquirer`, `may_act_for_client`, `authority_basis`, `authority_evidence_sighted`, phone, WhatsApp, email, country, best time). It has no link to an auth user, no access scope, no payer flag, and no record of when or by whom authority was recorded. Access today is link-only through hashed, expiring, per-client `care_access_tokens`, and every open and save is written to `care_access_log`. RLS on every care table is admin only, with `client_commercial` additionally requiring the `care_coordinator` permission.

### 1.4 How an enquiry becomes a client

`PromoteEnquiries.tsx` creates the `clients` row, creates one `client_contacts` row from the enquirer with `is_primary` and `is_enquirer` true, sets `contact_submissions.care_client_id`, and logs `promoted_from_enquiry`. The enquiry is preserved and linked, never merged away. Gaps recorded in Revision 1: `created_from_submission_id` is never written, and authority fields are left unset.

---

## 2. The ratified model

```text
Person            a human being, one row, an immutable internal person id
  |
Auth identity     a Supabase auth user, optional; auth_user_id is the durable
                  cross-domain anchor once it exists
  |
Access basis      a recorded event stating why a person may see what they see
  |
Access grant      Person -> Client, with role, scope and lifecycle, staff-created
  |
Care recipient    the client record, which may or may not be a Person with an account
```

### 2.1 A person has an immutable internal id; email is not identity

A care person row has an immutable internal person id. Email is a contact method, a login identifier where appropriate, and an identity-matching **signal** during claiming. It is never the identity of the human. There is no unique constraint on email and no merging on email match: spouses, elderly parents and households legitimately share one address.

Once an account exists, `auth_user_id` is the durable link between that authenticated identity and the domain-person records it may act as.

### 2.2 Professional and care-domain records stay separate

The same auth identity may legitimately correspond to a professional `mu_people` record, a care person record, personal client access and family representative access. The records are never merged and never continuously joined by email. Professional capability grants and personal or family access grants stay separate. **Professional assignment access to a client never creates personal or family access to that client.**

### 2.3 Relationship, enquiry ownership and authority are separate facts

Relationship is descriptive. Enquiry ownership is historical. Access basis is a recorded decision. Enquiry promotion creates the care recipient, the contact and the historical fact that this person arranged the enquiry. **It creates no grant.**

### 2.4 Scope splits three ways, never inferred from relationship

- **Journey:** request received, pre-assessment state, assessment appointment, next administrative step, payment action assigned to that person.
- **Clinical/care:** visits, the issued care plan, shared visit summaries, documents, clinical updates.
- **Finance:** invoices, payments, Care Fund, contribution activity.

### 2.5 No clinical access without a recorded basis

Every clinical or care grant requires a recorded **access basis**. `basis_kind` is one of:

| Basis | Example |
| --- | --- |
| `self_identity` | The verified client accessing their own record; no implication of legal representation |
| `guardian_authority` | Recorded guardian authority for a child or dependant |
| `client_consent` | An adult client's recorded consent for a relative |
| `authorised_representative` | Another recorded authority basis |
| `court_or_legal_instrument` | Court order or equivalent |
| `clinical_referral_disclosure` | Explicit, separately authorised professional disclosure |
| `finance_participant` | Grants finance only; never clinical |

A finance grant is backed by a `finance_participant` basis. The assessment is a natural point to capture a basis but not the only valid one.

### 2.6 The deterministic journey trigger

For self-care, guardian-for-child and adult-relative journeys alike:

```text
pre-assessment submitted -> eligible arranging contact receives journey access
                         -> portal invitation may be sent
```

Journey access never implies clinical access. Staff may grant journey access earlier or later where operationally necessary, always with an audit reason. Professional referrers receive no persistent portal grant automatically. Payer access is created when the person becomes the recorded payer or finance participant, not because they made the enquiry.

### 2.7 All grants are staff-created in v1

Family may nominate or request another person. Medic Connect validates and creates the actual grant, recording who authorised it and why. This can be revisited later.

### 2.8 Onboarding by scenario

| Scenario | Journey grant | Clinical access | Finance | Recorded basis |
| --- | --- | --- | --- | --- |
| Care for self | On pre-assessment submitted | Yes, own record, on account creation | Where payer | `self_identity`, verified |
| Parent or guardian, child or dependant | On pre-assessment submitted | Once guardian basis recorded; never from the label "mother" | Where payer | `guardian_authority` |
| Adult relative arranging for an adult | On pre-assessment submitted | After client consent or another recorded basis | Where payer | `client_consent` or `authorised_representative` |
| Payer only | Not by default | Never by default | When recorded as payer | `finance_participant` |
| Professional referrer | None persistent | Never automatic; later disclosure is a separate workflow | No | none |

The child or dependant never needs a login. One adult account may manage several children. An account never grants access by itself: signing in resolves to the person, and the person's grants decide what is visible.

### 2.9 Link first, password later

The progression stays one path: hashed link for the pre-assessment and single views; a six digit code to the same phone or email before clinical detail or money, reusing the `mu_verifications` pattern; a real account offered at the point of repeated return, created by the existing `generateLink` plus `token_hash` route.

### 2.10 Revocation

Revoking a grant is per client. It revokes any currently usable access links and invitations associated with that person's grant for that client, and ends account access to that client, all logged to `care_activity`. It does not delete or corrupt frozen or submitted pre-assessment token provenance required for audit. The person's other client grants and the person record are untouched. A shared family address remains valid: one person per address, several grants.

---

## 3. The five awkward cases, answered

1. **Self-care.** The client is the person. `self_identity` basis, journey then clinical on account creation.
2. **Child or dependant.** The client never holds an account. Guardians hold grants with a recorded `guardian_authority` basis.
3. **Adult parent with a capable adult child.** Both are people. The arranging child gets journey access; clinical access follows only a recorded basis.
4. **One person, several clients.** One person row, several grants, a client switcher; scope resolved per grant on every view.
5. **One client, several relatives.** Several grants, exactly one primary contact; primary is an operational fact, not an authority fact.

---

## 4. Technical changes this implies

Additive only.

- `care_people`: immutable internal id, optional `auth_user_id`, name, phone, WhatsApp, country, email as contact. **No unique email constraint.**
- `client_contacts.person_id`, keeping per-client flags.
- `care_access_bases`: person, client, `basis_kind`, evidence, recorded_by, recorded_at, withdrawn_at.
- `care_access_grants`: person, client, role, scope array over `journey`/`clinical`/`finance`, state (invited/active/suspended/revoked), granted_by, reason, timestamps, basis reference for any clinical or finance scope.
- `care_access_tokens.person_id`, so a link is traceable to a human.
- `client_commercial.payer_person_id`.
- `care_my_person_ids()` security definer returning every care person for the signed-in auth user.
- Grant-scoped read policies added alongside the existing admin policies; the clinical predicate requires an active grant with clinical scope backed by a live basis.
- Backfill one `care_people` row per existing `client_contacts` row: **a migration-safety strategy only**, deliberately avoiding unsafe automatic deduplication by email. Where Medic Connect has positively identified an existing care person, new client relationships must reuse that person. Historical duplicates are later reconciled through a staff-reviewed process.
- Write `created_from_submission_id` at promotion.

## 5. What must not change

The pre-assessment stays account-free. Email stays required in the care request journey. Tokens stay hashed, expiring and per client. Candidate identity, its RPCs and its RLS stay exactly as they are; the care model copies the pattern rather than extending `mu_people`.
