# Medic Connect Care: implementation execution plan

Revision 1, 12 September 2026. Approved execution plan.

This is the execution document, not a product-design document. The product contracts live in and remain authoritative at `docs/care-platform/architecture.md`, `docs/care-platform/account-model.md`, `docs/care-platform/ui-architecture.md` and `docs/care-platform/logic-review.md`. This document references them rather than repeating them. `roadmap.md` is the concise task checklist; this document explains how those tasks are grouped and executed.

---

## 1. Implementation principles

1. Bounded tranches. Each tranche is one coherent technical outcome, achievable in one Lovable build turn or explicitly split, and ends verified. The next tranche assumes it is correct.
2. Foundations are built once, only when about to be consumed: one field library, one date and phone implementation, one status vocabulary, one save and sync layer, one access-grant model, one work engine, one notification dispatcher.
3. Vertical completeness where practical: schema, server behaviour and first consuming interface together.
4. No temporary implementations. Nothing is built now that the architecture already says must be replaced immediately.
5. No repository-wide refactor. Existing duplicate screens migrate only where the architecture requires consolidation before Care can safely proceed. Console/Mu consolidation, `MuStats` retirement and design-token hygiene are deferred until after Checkpoint C.
6. Preserve functioning systems. The Candidate Portal and established Match Universe behaviour are extended through agreed primitives, never broadly rewritten.
7. Additive migrations only. Old columns or paths are retired in a later tranche, after replacement exists, data is backfilled, readers have moved and behaviour is verified.
8. Every build prompt carries the standing rules: inspect only tranche files; no re-audit; no unrelated cleanup; no temporary duplicate abstractions; record unrelated issues in the reply instead of fixing them; verify before touching the next tranche; update `roadmap.md` only after verification. "Inspect only the tranche files" means start with and remain scoped to those files and their direct implementation dependencies; an existing shared primitive directly required to implement the tranche (Calendar, Popover, Sheet, Input, Select and the like) may be inspected, but this never broadens into a repository re-audit or unrelated cleanup.
9. Schema-free tranches mean exactly that. Where a tranche makes no database change, components normalise and expose the right contract (for example a `PhoneField` exposing E.164 with a derived country) but existing consumers keep persisting the representation their current schema supports. Persisted shape changes wait for the tranche that migrates the data model.

---

## 2. Identity and access model summary

Ratified corrections, superseding the investigation-era recommendations in `account-model.md` Revision 1:

1. A care person has an **immutable internal person id**. Email is a contact method, a login identifier where appropriate, and a matching signal during claiming. No unique constraint on email; no merging on email match. Two people may legitimately share an address.
2. `auth_user_id` is the durable link between an authenticated identity and the domain-person records it may act as.
3. Professional (`mu_people`) and care-domain person records stay separate: never merged, never continuously joined by email. Professional assignment access never creates family or client access to the same client.
4. Enquiry promotion creates the care recipient, the contact and the historical fact that this person arranged the enquiry. It creates no grant.
5. Scope splits three ways and is never inferred from relationship: **journey**, **clinical/care**, **finance**.
6. **No clinical access without a recorded access basis.** `care_access_bases` covers identity as well as authority: `basis_kind` is one of `self_identity`, `guardian_authority`, `client_consent`, `authorised_representative`, `court_or_legal_instrument`, `clinical_referral_disclosure`, `finance_participant`. `self_identity` carries no implication of legal representation. A finance basis grants finance only.
7. All grants are staff-created in v1. Family may nominate; Medic Connect validates and creates the grant, recording who authorised it and why.
8. Revocation is per grant per client. It revokes any currently usable access links and invitations associated with that person's grant for that client, and ends account access to that client. It does not delete or corrupt frozen or submitted pre-assessment token provenance required for audit. The person's other client grants and the person record are untouched.

The table naming is `care_access_grants`, not `care_portal_access` as originally written in `architecture.md` §10.

## 3. Dependency graph

```text
permissions + capabilities ─┐
vocabularies + geography ───┼─> care person (internal id) ─> contacts ─> access grants
                            │        │        (journey / clinical / finance) <─ access bases
                            │        └─> auth identity link (auth_user_id, cross-domain anchor)
                            │                                   └─> portal invitations ─> notifications
shared fields (date, phone, │
select, status, save) ──────┼─> save/sync ─> offline ─> assessor capture ─> worker visits
                            │
work engine + derived stage ┴─> authoritative case progression, next action, chasing

assessments ─> clinical review ─> care plan document ─> needs/goals/tasks
   └─> may record an access basis
                                └─> package ─> staffing ─> assignments ─> roster ─> visits ─> reviews
access grants + multi-client routing ─> client/family portal ─> payments ─> Care Fund
form library (governed config) sits beside assessments, not before them
```

Rules: nothing that sends ships before the dispatcher; the work engine is the authoritative progression mechanism before the real journey is production-ready; offline ships with the first assessor capture; multi-client routing, RLS and cache keys ship with the first family screen; `care_access_bases` exists before any clinical-scope portal view.

## 4. Onboarding and access decision table

Deterministic journey trigger, applied to self-care, guardian-for-child and adult-relative alike:

```text
pre-assessment submitted -> eligible arranging contact receives journey access
                         -> portal invitation may be sent
```

Staff may grant journey access earlier or later where operationally necessary, always with an audit reason. Journey access never implies clinical access.

| Scenario | Journey grant | Clinical access | Finance | Recorded basis |
| --- | --- | --- | --- | --- |
| Care for self | On pre-assessment submitted | Yes, own record | Where payer | `self_identity`, verified |
| Parent or guardian, child or dependant | On pre-assessment submitted | Yes, once basis recorded; never from the label "mother" | Where payer | `guardian_authority` |
| Adult relative arranging for an adult | On pre-assessment submitted | Only after the client's consent or another recorded basis; assessment is a natural but not exclusive capture point | Where payer | `client_consent` or `authorised_representative` |
| Payer only | Not by default | Never by default | Yes, created when the person becomes the recorded payer or finance participant, not because they enquired | `finance_participant` |
| Professional referrer | None persistent | Never automatic; later disclosure is an explicit separate workflow | No | none |

Journey scope may expose: request received, pre-assessment state, assessment appointment, next administrative step, payment action assigned to that person. Clinical scope may expose: visits, the issued care plan, shared visit summaries, documents, clinical updates. Finance scope may expose: invoices, payments, Care Fund, contribution activity.

---

## 5. Tranche table

### Tranche 1: shared field and state foundation
Medium, low risk, deliberately narrow. Outcome: one `src/components/field/*` layer consumed by the Care path. In: `DateField`, `TimeField`, `DateTimeField`, `PhoneField` (normalises and exposes E.164 and maintains/derives its selected country as part of the component contract), `Select`, `SearchableSelect`, `Status`, `SaveState`, `useAutosave` with acknowledged saves, `formatDate`, `formatMoney`; adopted in `PreAssessment.tsx` and `CareFieldInput.tsx`, and in `Clients.tsx`/`ClientRecord.tsx` only where the Care foundation needs it. Out: Console retirement, Mu migration, `MuStats`, token hygiene, Candidate Portal, Match Universe, `FileUpload`, care-token cleanup. No database work: no new persisted columns and no alteration of existing database shapes; existing Care consumers keep persisting the representation their current schema supports, and separate persisted country data is adopted when the relevant data model is migrated. Acceptance: autosave never claims saved before acknowledgement; date picker inside the viewport at 320px; phone round-trips E.164; one status tone map in the care path. Regression: pre-assessment load and save, `/admin/clients` list and filters, client record tabs.

### Tranche 2A: care identity, access bases and grants (database)
Large, high risk (auth, RLS). Additive migration: `care_people` (immutable id, optional `auth_user_id`, email as contact with no unique constraint and no merging), `client_contacts.person_id`, `care_access_bases`, `care_access_grants` (person, client, role, scope array over journey/clinical/finance, lifecycle, granted_by, reason, basis reference for clinical or finance scope), `care_access_tokens.person_id`, `client_commercial.payer_person_id`, `care_my_person_ids()` security definer. GRANTs before RLS, then policies: existing admin policies retained, plus grant-scoped read policies whose clinical predicate requires an active grant with clinical scope backed by a live basis. Backfill: one `care_people` row per existing `client_contacts` row, **a migration-safety strategy only**. Automatic email deduplication is deliberately avoided as unsafe and is not the desired operating behaviour. Where Medic Connect has positively identified an existing care person, new client relationships must reuse that person. Historical duplicates are later reconciled through a staff-reviewed process. Out: UI, automatic grants at promotion, notifications, drops or renames.

### Tranche 2B: grant administration in the console
Medium, high risk. Access section on the client record: people with role, scope, state and basis; coordinator actions to create a grant with scope and authorisation reason, record an access basis with evidence and decider, expand scope to clinical only via a live basis, revoke with the cascade defined in section 2.8, and set the payer person. Journey access issued on pre-assessment submission, with a manual override path requiring a reason. Promotion creates person and contact and no grant. Mu record grammar and Tranche 1 fields. Out: portal screens, notification sending, schema beyond 2A.

**Tranche 2 gate — all nine verified with a real second and third identity, all server-enforced:**

1. One person holds grants on several clients and sees only those.
2. One client carries several people with independently scoped grants.
3. Two people sharing one email remain two persons.
4. A payer sees finance and no clinical data.
5. An arranging adult child holds journey access and cannot read visits, plans or clinical documents.
6. Recording a basis expands only that person's scope.
7. Revoking one client grant leaves that person's other client grants working.
8. A professional with an assignment fails every family-access policy for that client.
9. Direct table reads with each identity's token return exactly the permitted rows.

### Tranche 3: notification foundation and delivery
Medium risk. Templates, notification records, dispatcher, delivery state, retry, dedupe, visible failure; pre-assessment delivery, portal invitation and password delivery routed through it. **Delivery only: no new lifecycle mechanism.** Existing functions that mutate `clients.stage` directly are recorded as temporary legacy behaviour to be removed in Tranche 5; not designed around, not deepened.

**Checkpoint A: foundations operate.**

### Tranche 4: controlled vocabularies, geography, derived client facts
Medium risk (backfill). Vocabulary tables, languages/sex/relationships/state/LGA to codes, `date_of_birth_is_estimated`, derived age, token-authenticated address path.

### Tranche 5: work engine and derived stage
Large, medium risk. `care_work_items`, `care-rules.ts`, working hours and public holidays, `outstandingWork` ranking, `deriveCareStage`, removal of the free stage dropdown and of the legacy direct stage writes recorded in Tranche 3. Work becomes the authoritative progression mechanism.

**Checkpoint B: enquiry to callback to pre-assessment runs on real work items, no direct stage writes.**

### Tranche 6A/6B: assessment scheduling, then offline assessor workspace
High risk (offline sync). Offline is mandatory here. 6B can record an access basis captured at assessment.

### Tranche 7: clinical review and care plan document

**Checkpoint C: enquiry to accepted assessment to drafted plan.**

### Tranche 8: package, staffing, assignments, roster
### Tranche 9: care worker visits, reusing the 6B offline layer

**Checkpoint D: a worker delivers and records a visit offline and it syncs.**

### Tranche 10A/10B: client and family portal
Multi-client and scope-aware from day one: profile-scoped routing, switcher, scoped queries and cache keys, journey surfaces on journey scope, clinical surfaces on clinical scope, finance surfaces on finance scope.

**Checkpoint E: a journey-only relative, a finance-only payer and a clinically based guardian each see exactly their own scope across two clients.**

### Tranche 11: finance, invoices, Care Fund
High risk (payment allocation): idempotent Paystack webhook and reconciliation first, Fund rebuilt on Cx second.

### Tranche 12: reviews, governed Form Library, hardening

**Checkpoint F: finance operates and configuration is administrable without a developer.**

---

## 6. Checkpoints

At every checkpoint verify the journey, the roles, the permission boundaries, and what deliberately still does not exist.

- **A.** Fields, identity, grants, bases and notifications operate. Roles: admin, second and third identity. Boundaries: the nine access tests. Not yet: work engine, assessor capture, any portal surface.
- **B.** Enquiry to callback to pre-assessment runs on work items. Roles: coordinator, contact. Boundaries: staff cannot select a stage. Not yet: assessment capture.
- **C.** Enquiry to accepted assessment to drafted plan. Roles: assessor, clinical lead, coordinator. Boundaries: only `care_clinical` accepts or returns; documents immutable after freeze. Not yet: package or staffing.
- **D.** Worker delivers and records a visit offline and it syncs. Roles: worker, coordinator. Boundaries: only the assigned worker checks in; note visibility enforced. Not yet: family portal.
- **E.** Two relatives with different scopes see correctly different things across two clients. Boundaries: scope per grant, per view, no cross-client cache bleed. Not yet: finance.
- **F.** Finance operates and configuration is administrable without a developer.

---

## 7. Build prompts

### Tranche 1 (full)

> Implement Tranche 1 of `docs/care-platform/implementation-plan.md`: the shared field and state foundation. Consult `ui-architecture.md` sections 5 and 6 for the behaviour contracts and `architecture.md` section 2. Inspect only `src/components/care/CareFieldInput.tsx`, `src/pages/PreAssessment.tsx`, `src/pages/admin/Clients.tsx`, `src/pages/admin/ClientRecord.tsx`, `src/components/admin/mu/MuShell.tsx` and `src/index.css`. Do not re-audit the repository.
> Build `src/components/field/`: `DateField`, `TimeField`, `DateTimeField`, `PhoneField` (E.164 with country held separately), `Select`, `SearchableSelect`, `Status` (one tone map, based on `MuStatus`), `SaveState`, `useAutosave`, and `src/lib/format.ts` with `formatDate`, `formatPhone`, `formatMoney`. Each control follows the universal contract: fills its container, viewport-constrained popover falling back to a full-width sheet below 768px, visible focus ring, error below the control linked by `aria-describedby`, disabled states that name their reason, 44px targets, "Not recorded" rather than blank.
> `useAutosave` must clear the pending buffer only on server acknowledgement and must never display "Saved" before it. Adopt the new components in `PreAssessment.tsx` and `CareFieldInput.tsx`, and in `Clients.tsx`/`ClientRecord.tsx` only where a date, phone, select or status is already rendered.
> Not in scope: database changes, `FileUpload`, `MediaCapture`, care-token handling, retiring `src/components/admin/console/*`, `MuStats`, design-token cleanup, Match Universe, Workforce, Candidate Portal, or any file not named above. Record unrelated issues in the reply instead of fixing them.
> Acceptance: pre-assessment answers still load and save; the save indicator only reads saved after acknowledgement; the date picker stays inside the viewport at 320px; phone values round-trip as E.164; one status tone map is used across the care path; typecheck and build pass.
> Regression: pre-assessment token load and save, `/admin/clients` list and filters, client record tabs, enquiry promotion.
> Update `roadmap.md` only after verification.

### Tranche 2A (full)

> Implement Tranche 2A: care identity, access bases and grants, database only. Consult `account-model.md`, `architecture.md` sections 10 to 12, and sections 2 to 4 of the implementation plan. Inspect only the care schema, `src/lib/care.ts`, `supabase/functions/_shared/care-form.ts`, `care-token-create`, `care-form-load`, `care-form-save`, and `src/pages/admin/ClientRecord.tsx` for existing reads.
> One additive migration: `care_people` with an immutable internal id, optional `auth_user_id`, name, phone, WhatsApp, country and email as a contact field with no unique constraint and no merging on email; `client_contacts.person_id`; `care_access_bases` (person, client, `basis_kind` in `self_identity`, `guardian_authority`, `client_consent`, `authorised_representative`, `court_or_legal_instrument`, `clinical_referral_disclosure`, `finance_participant`, evidence, recorded_by, recorded_at, withdrawn_at); `care_access_grants` (person, client, role, scope array over `journey`, `clinical`, `finance`, state in invited/active/suspended/revoked, granted_by, reason, timestamps, basis reference for any clinical or finance scope); `care_access_tokens.person_id`; `client_commercial.payer_person_id`; `care_my_person_ids()` security definer. GRANT statements for every new table before enabling RLS, then policies: existing admin policies retained, plus grant-scoped read policies whose clinical predicate requires an active grant carrying `clinical` scope backed by a live basis. Backfill one `care_people` row per existing `client_contacts` row, with no email merging; this is migration safety, not operating behaviour.
> Not in scope: any UI, any automatic grant at promotion, family self-service granting, notifications, dropping or renaming anything.
> Acceptance: run all nine access tests in the plan with a real second and third identity; no clinical row is readable without an active basis-backed grant; a professional assignment satisfies no family policy; regenerate types and pass typecheck.
> Update `roadmap.md` only after verification.

### Tranche 2B (full)

> Implement Tranche 2B: grant administration in the console, on top of Tranche 2A. Inspect only `src/pages/admin/ClientRecord.tsx`, `src/pages/admin/Clients.tsx`, `src/components/admin/care/PromoteEnquiries.tsx`, `src/lib/care.ts` and the Tranche 2A migration.
> Add to the client record an access section listing people with role, scope chips, state and basis; coordinator actions to create a grant with scope and a written authorisation reason, record an access basis with evidence and decider, expand scope to clinical only where a live basis exists, revoke a grant with the cascade (revoking currently usable links and invitations while preserving submitted token provenance), and set the payer person. Issue journey access automatically when a pre-assessment is submitted, for the eligible arranging contact, with a manual earlier or later grant path that requires a reason. Promotion creates person and contact and no grant.
> Constraints: use the Mu record grammar and the Tranche 1 field components. No new status vocabulary. No portal screens, no notification sending, no schema changes beyond what 2A shipped, no Console or `MuStats` cleanup.
> Acceptance: the server refuses each action the interface hides, tested with a non-coordinator identity; journey access appears exactly once per submission; clinical scope cannot be selected without a basis; revocation removes portal and usable link access for that client only, leaving audit provenance intact.
> Regression: client record tabs, commercial data visibility, enquiry promotion, pre-assessment token flow. Update `roadmap.md` only after verification.

### Later skeletons

- **Tranche 3:** templates, records, dispatcher, retries, dedupe, failures; route pre-assessment, invitation and password delivery through it; record, do not extend, legacy direct stage writes.
- **Tranche 4:** vocabularies and geography with stable codes, derived age.
- **Tranche 5:** work items, rules, working hours, ranking, derived stage, remove legacy stage writes.
- **Tranche 6A/6B:** scheduling, then offline sectioned capture with IndexedDB and idempotent events.
- **Tranche 7:** review and plan document versioning.
- **Tranche 8:** packages, assignments, roster.
- **Tranche 9:** visits and events.
- **Tranche 10A/10B:** family portal routing and scoped surfaces.
- **Tranche 11:** invoices, idempotent Paystack, Fund on Cx.
- **Tranche 12:** reviews, Form Library, job visibility.

Every prompt carries the standing rules in section 1.8.

---

## 8. Deferred items

Console-to-Mu consolidation, `MuStats` retirement, design-token hygiene, care-token sessionStorage cleanup, cross-client dashboard, outcome analytics, richer reporting, staff-reviewed person deduplication, legacy direct stage writes (removed in Tranche 5).

## 9. Current implementation position

Planning complete. Documents ratified 12 September 2026. No tranche started.
