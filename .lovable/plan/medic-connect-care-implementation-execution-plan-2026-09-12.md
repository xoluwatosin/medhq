# Medic Connect Care: implementation execution plan

Revision 3 of the plan. Planning only. On approval the first act is to write `docs/care-platform/implementation-plan.md` from section H, then wait for a separate instruction before Tranche 1.

## A. Implementation readiness

**Ready.** No blocking contradiction. The corrected identity and access model, which supersedes the Revision 1 recommendations in `account-model.md`:

1. A care person has an **immutable internal person id**. Email is a contact method, a login identifier where appropriate, and a matching signal during claiming. No unique constraint on email, no merge on email match: two people may share an address.
2. `auth_user_id` is the durable link between an authenticated identity and the domain-person records it may act as.
3. Professional (`mu_people`) and care-domain person records stay separate, never merged and never continuously joined by email. Professional assignment access never creates family or client access to the same client.
4. Enquiry promotion creates the care recipient, the contact and the historical fact that this person arranged the enquiry. It creates no grant.
5. Scope splits three ways and is never inferred from relationship: **journey**, **clinical/care**, **finance**.
6. **No clinical access without a recorded access basis.** The table is `care_access_bases`, covering identity as well as authority, with `basis_kind` one of `self_identity`, `guardian_authority`, `client_consent`, `authorised_representative`, `court_or_legal_instrument`, `clinical_referral_disclosure`. `self_identity` carries no implication of legal representation. A finance basis is recorded the same way and grants finance only.
7. All grants are staff-created in v1. Family may nominate; Medic Connect validates and creates the grant, recording who authorised it and why.

Naming resolution: `care_access_grants`, not `care_portal_access` as written in `architecture.md` §10; the architecture reference is corrected in Tranche 2.

## B. Dependency graph

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

Rules: nothing that sends ships before the dispatcher; the work engine is the authoritative progression mechanism before the journey is production-ready; offline ships with the first assessor capture; multi-client routing, RLS and cache keys ship with the first family screen; `care_access_bases` exists before any clinical-scope portal view.

## C. Onboarding and access decision table

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
| Payer only | Not by default | Never by default | Yes, created when the person becomes the recorded payer or finance participant, not because they enquired | finance basis |
| Professional referrer | None persistent | Never automatic; later disclosure is an explicit separate workflow | No | none |

Journey scope may expose: request received, pre-assessment state, assessment appointment, next administrative step, payment action assigned to that person. Clinical scope may expose: visits, the issued care plan, shared visit summaries, documents, clinical updates. Finance scope may expose: invoices, payments, Care Fund, contribution activity.

Revocation is per grant per client: it ends links, account access and pending invitations for that client only, logs to activity, and leaves the person and their other clients intact.

## D. Ordered implementation tranches

**1. Shared field and state foundation.** Medium, low risk, deliberately narrow. One `src/components/field/*` layer consumed by the Care path. In: `DateField`, `TimeField`, `DateTimeField`, `PhoneField`, `Select`/`SearchableSelect`, `Status`, `SaveState`, `useAutosave` with acknowledged saves, `formatDate`, `formatMoney`; adopted in `PreAssessment.tsx`, `CareFieldInput.tsx`, and in `Clients.tsx`/`ClientRecord.tsx` only where the Care foundation needs it. Out: Console retirement, Mu migration, `MuStats`, token hygiene, Candidate Portal, Match Universe, `FileUpload`, care-token cleanup. No database work.

**2A. Care identity, access bases and grants (database).** Large, high risk. `care_people` (immutable id, optional `auth_user_id`, email as contact only, no unique email), `client_contacts.person_id`, `care_access_bases`, `care_access_grants` (person, client, role, scope array, lifecycle, granted_by, reason), `care_access_tokens.person_id`, `client_commercial.payer_person_id`, `care_my_person_ids()` security definer, grant-scoped policies alongside the existing admin policies. Additive plus a non-merging backfill: one person per contact row; deduplication is a later staff-reviewed action.

**2B. Grant administration in the console.** Medium, high risk. Coordinator grant creation with scope and authorisation reason, access bases recorded with decider and evidence, scope expansion to clinical only via a recorded basis, revocation cascade, payer person selection, journey grant issued on pre-assessment submission with a manual override path. Promotion writes person and contact and no grant.

Tranche 2 gate, proven with a real second and third identity, all server-enforced:

1. One person holds grants on several clients and sees only those.
2. One client carries several people with independently scoped grants.
3. Two people sharing one email remain two persons.
4. A payer sees finance and no clinical data.
5. An arranging adult child holds journey access and cannot read visits, plans or clinical documents.
6. Recording a basis expands only that person's scope.
7. Revoking one client grant leaves that person's other client grants working.
8. A professional with an assignment fails every family-access policy for that client.
9. Direct table reads with each identity's token return exactly the permitted rows.

**3. Notification foundation and delivery.** Medium risk. Templates, notification records, dispatcher, delivery state, retry, dedupe, visible failure; pre-assessment delivery, portal invitation and password delivery routed through it. **Delivery only: no new lifecycle mechanism.** Existing functions that mutate `clients.stage` directly are recorded as temporary legacy behaviour to be removed in Tranche 5, not designed around or deepened.

**Checkpoint A: foundations operate.**

**4. Controlled vocabularies, geography, derived client facts.** Medium risk (backfill).

**5. Work engine and derived stage.** Large, medium risk. `care_work_items`, `care-rules.ts`, working hours and holidays, `outstandingWork` ranking, `deriveCareStage`, removal of the free stage dropdown **and of the legacy direct stage mutations recorded in Tranche 3**. Work becomes the authoritative progression mechanism.

**Checkpoint B: enquiry to callback to pre-assessment runs on real work items with no direct stage writes.**

**6A. Assessment scheduling. 6B. Offline assessor workspace.** High risk; offline is mandatory here; 6B can record an access basis captured at assessment.

**7. Clinical review and care plan document.** **Checkpoint C.**

**8. Package, staffing, assignments, roster. 9. Care worker visits.** **Checkpoint D.**

**10A/10B. Client and family portal**, multi-client and scope-aware from day one. **Checkpoint E: a journey-only relative, a finance-only payer and a clinically based guardian each see exactly their own scope across two clients.**

**11. Finance, invoices, Care Fund. 12. Reviews, Form Library, hardening.** **Checkpoint F.**

## E. Credit-risk commentary

Saves credits: fields with their first Care consumers; schema with its first admin surface; offline with the first offline capture; multi-client and scope routing with the first family screen. Costs credits: UI beyond grant administration inside Tranche 2; cleanup during a functional tranche; the Form Library before assessments settle; the family portal before the nine access tests pass.

## F. Roadmap corrections proposed

Work engine and offline move to Critical before real care. Notifications precede pre-assessment sending. Multi-client data model, routing and RLS move into the family portal tranche; only the cross-client dashboard stays Later. Console/Mu consolidation, token retirement and token hygiene move after Checkpoint C. `roadmap.md` is edited only after each tranche verifies.

## G. Build prompts

**Tranche 1, full prompt**

> Implement Tranche 1 of `docs/care-platform/implementation-plan.md`: the shared field and state foundation. Consult `ui-architecture.md` sections 5 and 6 for the behaviour contracts and `architecture.md` section 2. Inspect only `src/components/care/CareFieldInput.tsx`, `src/pages/PreAssessment.tsx`, `src/pages/admin/Clients.tsx`, `src/pages/admin/ClientRecord.tsx`, `src/components/admin/mu/MuShell.tsx` and `src/index.css`. Do not re-audit the repository.
> Build `src/components/field/`: `DateField`, `TimeField`, `DateTimeField`, `PhoneField` (E.164 with country held separately), `Select`, `SearchableSelect`, `Status` (one tone map, based on `MuStatus`), `SaveState`, `useAutosave`, and `src/lib/format.ts` with `formatDate`, `formatPhone`, `formatMoney`. Each control follows the universal contract: fills its container, viewport-constrained popover falling back to a full-width sheet below 768px, visible focus ring, error below the control linked by `aria-describedby`, disabled states that name their reason, 44px targets, "Not recorded" rather than blank.
> `useAutosave` must clear the pending buffer only on server acknowledgement and must never display "Saved" before it. Adopt the new components in `PreAssessment.tsx` and `CareFieldInput.tsx`, and in `Clients.tsx`/`ClientRecord.tsx` only where a date, phone, select or status is already rendered.
> Not in scope: database changes, `FileUpload`, `MediaCapture`, care-token handling, retiring `src/components/admin/console/*`, `MuStats`, design-token cleanup, Match Universe, Workforce, Candidate Portal, or any file not named above. Record unrelated issues in the reply instead of fixing them.
> Acceptance: pre-assessment answers still load and save; the save indicator only reads saved after acknowledgement; the date picker stays inside the viewport at 320px; phone values round-trip as E.164; one status tone map is used across the care path; typecheck and build pass.
> Regression: pre-assessment token load and save, `/admin/clients` list and filters, client record tabs, enquiry promotion.
> Update `roadmap.md` only after verification.

**Tranche 2A, full prompt**

> Implement Tranche 2A: care identity, access bases and grants, database only. Consult `account-model.md`, `architecture.md` sections 10 to 12, and the corrected identity model in the implementation plan. Inspect only the care schema, `src/lib/care.ts`, `supabase/functions/_shared/care-form.ts`, `care-token-create`, `care-form-load`, `care-form-save`, and `src/pages/admin/ClientRecord.tsx` for existing reads.
> One additive migration: `care_people` with an immutable internal id, optional `auth_user_id`, name, phone, WhatsApp, country and email as a contact field with **no unique constraint and no merging on email**; `client_contacts.person_id`; `care_access_bases` (person, client, `basis_kind` in `self_identity`, `guardian_authority`, `client_consent`, `authorised_representative`, `court_or_legal_instrument`, `clinical_referral_disclosure`, `finance_participant`, evidence, recorded_by, recorded_at, withdrawn_at); `care_access_grants` (person, client, role, scope array over `journey`, `clinical`, `finance`, state in invited/active/suspended/revoked, granted_by, reason, timestamps, basis reference for any clinical or finance scope); `care_access_tokens.person_id`; `client_commercial.payer_person_id`; `care_my_person_ids()` security definer. GRANT statements for every new table before enabling RLS, then policies: existing admin policies retained, plus grant-scoped read policies whose clinical predicate requires an active grant carrying `clinical` scope backed by a live basis. Backfill one `care_people` row per existing `client_contacts` row, never merging by email.
> Not in scope: any UI, any automatic grant at promotion, family self-service granting, notifications, dropping or renaming anything.
> Acceptance: run all nine access tests in the plan with a real second and third identity; no clinical row is readable without an active basis-backed grant; a professional assignment satisfies no family policy; regenerate types and pass typecheck.
> Update `roadmap.md` only after verification.

**Tranche 2B, full prompt**

> Implement Tranche 2B: grant administration in the console, on top of Tranche 2A. Inspect only `src/pages/admin/ClientRecord.tsx`, `src/pages/admin/Clients.tsx`, `src/components/admin/care/PromoteEnquiries.tsx`, `src/lib/care.ts` and the Tranche 2A migration.
> Add to the client record an access section listing people with role, scope chips, state and basis; coordinator actions to create a grant with scope and a written authorisation reason, record an access basis with evidence and decider, expand scope to clinical only where a live basis exists, revoke a grant with the cascade, and set the payer person. Issue journey access automatically when a pre-assessment is submitted, for the eligible arranging contact, with a manual earlier or later grant path that requires a reason. Promotion creates person and contact and no grant.
> Constraints: use the Mu record grammar and the Tranche 1 field components. No new status vocabulary. No portal screens, no notification sending, no schema changes beyond what 2A shipped, no Console or `MuStats` cleanup.
> Acceptance: the server refuses each action the interface hides, tested with a non-coordinator identity; journey access appears exactly once per submission; clinical scope cannot be selected without a basis; revocation removes portal and link access for that client only.
> Regression: client record tabs, commercial data visibility, enquiry promotion, pre-assessment token flow. Update `roadmap.md` only after verification.

**Later skeletons.** Tranche 3: templates, records, dispatcher, retries, dedupe, failures; route pre-assessment, invitation and password delivery through it; record, do not extend, legacy direct stage writes. Tranche 4: vocabularies and geography with stable codes, derived age. Tranche 5: work items, rules, working hours, ranking, derived stage, remove legacy stage writes. Tranche 6A/6B: scheduling, then offline sectioned capture with IndexedDB and idempotent events. Tranche 7: review and plan document versioning. Tranche 8: packages, assignments, roster. Tranche 9: visits and events. Tranche 10A/10B: family portal routing and scoped surfaces. Tranche 11: invoices, idempotent Paystack, Fund on Cx. Tranche 12: reviews, Form Library, job visibility. Every prompt carries the standing rules: inspect only tranche files, no re-audit, no unrelated cleanup, no temporary abstractions, no Candidate Portal or Match Universe redesign, record unrelated issues, verify before moving on.

## H. `docs/care-platform/implementation-plan.md` contents

Sections: purpose and relationship to the four contract documents (reference, never duplicate); implementation principles including the credit-efficiency rules; the corrected identity and access model summary; the dependency graph; the onboarding and access decision table; the tranche table with outcome, why now, included, not included, database, backend, frontend, reuse, acceptance, regression, evidence, turn size and risk; the Tranche 2 nine-test gate; checkpoints A to F with journeys, roles, permission boundaries and what must still not exist; deferred items including console/Mu consolidation, token hygiene, cross-client dashboard and legacy stage writes; and a current implementation position line kept up to date after each verified tranche.
