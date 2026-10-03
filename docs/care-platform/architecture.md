# Medic Connect Care: Architecture Contract

Revision 4, 12 September 2026. Ratifies the corrected identity and access model in `docs/care-platform/account-model.md` Revision 2: immutable internal care person ids, email as contact rather than identity, no email-based merging, `auth_user_id` as the durable cross-domain anchor, access split into journey, clinical and finance scopes, a recorded access basis required for any clinical or finance access, staff-created grants, and no automatic grant at enquiry promotion. Execution order lives in `docs/care-platform/implementation-plan.md`.

This document is the agreed architecture for the single Medic Connect Care system. It incorporates the ten structural corrections and the four sign-off corrections made during review, and folds in the twenty changes required by the Logic Architecture Review (`docs/care-platform/logic-review.md`).

A note on provenance, recorded honestly. Revisions 1 and 2 existed only inside the transient plan file. This document is a reconstruction of Revision 3 from the reviewed record rather than a byte copy. Read it once before treating it as signed off.

---

## 0. The grand model

```text
Enquiry
  -> work item: callback
  -> proceed
  -> pre-assessment (family, token link)
  -> assessment work + assessment document (assessor, in home)
  -> clinical review (Clinical Lead / Operations Nurse)
  -> care plan draft + package proposal
  -> package agreed
  -> staffing
  -> final clinical refinement
  -> care plan issued
  -> roster
  -> visits
  -> review
  -> next assessment / next plan version
```

Running alongside that chain, and not inside it: work items, finance, family access, activity and audit.

Every label in the software has a reason to exist.

| Label | Source |
|---|---|
| Enquiry about | What the family asked for, from the enquiry. Never overwritten by what we later supply |
| Care package | What Medic Connect agrees to supply: service, frequency, hours, rate, start date |
| Care plan | The issued clinical plan derived from the assessment, saying how care must be delivered |
| Case stage | **Derived** by `deriveCareStage(clientId)`, cached on `clients.stage` |
| Next action | **Derived**, the first row of ranked `outstandingWork(clientId)` |
| Age | **Derived** from `date_of_birth`. Never stored, never typed |
| Overdue | **Derived** from the work item due date against working hours |
| Owner | The assignee of the outstanding work item, or the delivery assignment |
| Due date | From the task, appointment, review or invoice. Never typed into a status |

Three separate things that are routinely confused and must never be merged: what they requested, what we supply, and how it must clinically be delivered.

---

## 1. Controlled vocabularies and geography

Records store **stable codes**. Screens resolve labels at render. Renaming a term never rewrites history; retiring hides it from new pickers only; a code is never reused.

```text
vocabularies       key, name, description, admin_managed
vocabulary_terms   id, vocabulary_key, code, label, sort_order,
                   is_active, retired_at, retired_reason, parent_code
```

Vocabularies at minimum: languages, sex, relationships, need domains, service models, escalation categories, closure reasons, work outcomes.

Geography layering:

```text
Google Places  ->  suggestion text + place_id        (convenience, never authority)
Place details  ->  address components + lat/lng
                   |
                   v  best-effort mapping, always shown as Confirm or change
State (vocabulary)  ->  LGA (vocabulary, constrained by parent_code)
                   +
Area, landmark (free text)   Coordinates (stored when returned)
```

Google never writes state or LGA directly. Coordinates are corroboration for visit check-in and worker travel, never a requirement. When Google is unavailable, or the user is on a public token link, the field degrades to plain text plus the two local pickers and says so in one sentence. The public pre-assessment must reach suggestions through a token-authenticated path or fall back cleanly.

---

## 2. The shared field component library

One implementation each, no exceptions.

`DateField`, `TimeField`, `DateTimeField` with `min` and `max` per use, date of birth capped at today, tested at 320 pixels. `PhoneField` storing E.164 with the country held separately. `AddressField` built on the layering above. `StateLgaField`, consolidated on `LocationSelect` and pointed at the database. `LanguagePicker` and the general `VocabularyField`. `MoneyField` with one naira formatter. `PersonPicker` with assessor and worker variants filtered by capability. `SaveState` and `SyncState` indicators with one shared `useAutosave`. `ConfirmAmendBlock`. `WorkStatus` and `DocumentStatus` on the `MuStatus` base. `ActivityHistory`, extracted. `FileUpload` and `MediaCapture` with one queue and retry. One shared `PERMISSION_OPTIONS` module.

---

## 3. Save and sync

Seven states, never collapsed: entered, saved locally, saved to server, submitted, reviewed, verified, accepted. Six user-visible save states: entered; saved on this device; waiting to sync; synced; sync failed with retry; newer version available. Never a bare spinner.

Rules. Per-field autosave locally on change, batched to the server. The pending buffer is cleared **only on acknowledgement**. Append-only events carry client-generated idempotency keys. Media queues separately with its own retry and a visible pending state. A stale plan snapshot warns and offers a refresh rather than silently using old instructions. Concurrent edits on one assessment section warn rather than overwrite.

Offline classification: the care worker visit flow and the assessor assessment must work offline, submit excepted; the family pre-assessment must never lose a typed answer; the admin console is online.

Storage. IndexedDB for operational and clinical data, scoped to the signed-in person, cleared on sign out, expiring after a configured number of days. localStorage holds non-sensitive device preferences only, never clinical data and never a bearer token.

---

## 4. The work engine

```text
care_work_items   id, client_id, kind, priority, assigned_to_user_id,
                  assigned_queue, due_at, blocking, blocked_by_id,
                  status, created_from_event, created_from_id,
                  completed_at, outcome, outcome_reason
```

Work is created by rules, never typed. Kinds include `callback`, `send_pre_assessment`, `chase_pre_assessment`, `book_assessment`, `assign_assessor`, `conduct_assessment`, `clinical_review`, `prepare_care_plan`, `agree_package`, `staff_package`, `refine_care_plan`, `first_visit_check`, `resolve_escalation`, `review_due`, `chase_payment`.

Engine requirements: rule-named ownership, falling back to a team queue and never to nobody; duplicate prevention, unique on `(client_id, kind, created_from_id)` while open; due dates computed in **working hours** against an administrator-managed working-hours calendar and Nigerian public-holiday table; declared dependencies, where blocked work is visible but not overdue; blocking versus non-blocking, where only blocking work holds the stage back; reassignment, cancellation and reopening, each with a reason and an activity entry; outcomes from a controlled vocabulary per kind; chained creation on outcomes as well as events; and overdue behaviour that surfaces once and escalates to a named person rather than nagging.

`outstandingWork(clientId)` ranks deterministically:

1. Safety and clinical blockers
2. Urgent priority
3. Overdue
4. Due within two working days
5. Everything else, earliest due date first, then creation order

Next action is the first row returned, and the interface states the reason in a sentence.

---

## 5. Derived stage

`deriveCareStage(clientId)` is a server function reading real records: enquiry, tokens, documents, assessment work, review decisions, packages, assignments, issued plans and visits. It returns awaiting pre-assessment, pre-assessment received, assessment booked, assessment in progress, clinical review, care-plan preparation, care setup, care running, paused or closed.

`clients.stage` remains a cached projection for list filtering, refreshed on write and reconciled nightly with drift reported. Staff never select a stage. Only `paused` and `closed` are settable, both requiring a reason. The record carries a "Why this stage" affordance that replays the derivation.

---

## 6. Assessments: one clinical source of truth

`care_documents` is the immutable clinical record: `kind`, `version`, `responses`, `built_from_id`, `supersedes_id`, `content_hash`, authorship, token and outstanding required data. It is never mutated after freeze.

`care_assessment_work` holds everything that is scheduling rather than clinical: `assessor_person_id`, requested, assigned, scheduled, in progress, submitted, returned, `appointment_at`, review decision, decider and reason. Rescheduling never touches the clinical document.

Two presentation modes over one form definition and one renderer:

- **Sequential**, one question per screen, for families on the token link.
- **Sectioned**, for the assessor: persistent section navigation, structured controls, key information kept visible, and every carried pre-assessment response rendered as **Confirm or Amend**. Prior responses are evidence requiring a decision, never pre-filled boxes.

Clinical authority: a coordinator may schedule, chase, receive and administratively close. Only `care_clinical` (Clinical Lead / Operations Nurse) may accept or return an assessment. Acceptance generates the care-plan draft.

### Raw answers versus active evidence

Family answers are stored exactly as the form saved them. No derived values are ever written into `responses`, so nothing downstream may read `derived_service`, `derived_recipient_group` or `derived_age_band` from a stored document. Routing and evidence are recomputed from the raw answers of the **exact source pre-assessment** named by the assessment work, using the one shared condition and derived-facts contract that the browser also uses, and then frozen onto the assessment document as `routing_facts`, `resolved_modules` and `active_evidence`.

An answer that a later route hides stays on the record and is excluded from active evidence. Raw answers are never rewritten.

### Carry classifications

Every field in a definition declares what it is: `clinical_evidence`, `context`, `operational`, `authority_consent` or `not_carried`. Only active `clinical_evidence` requires Confirm or Amend, enforced identically in the browser and on the server. The assessor sees three separate areas: clinical evidence to verify, context from the family (read only) and authority and consent. Operational fields never become clinical evidence.

### Three meanings of service

- **Enquiry service** — what the family first asked for. Historical, never rewritten.
- **Confirmed intake service** — resolved from the submitted pre-assessment. This is the routing truth for the professional assessment.
- **Episode service** — recorded later, on the episode.

A Nanny enquiry that resolves at intake to children with additional needs opens the additional-needs module while the enquiry service stays as it was.

### Document-bound review

One review belongs to exactly one submitted assessment version. The checklist, decision, reviewer and reason live on `care_assessment_reviews`; the columns on `care_assessment_work` are a current-state projection only. Returning freezes that review and the successor submission opens a fresh one, so a version 1 checklist can never accept version 2. A return carries a controlled category, a reason, instructions and a priority. A check marked not met requires a note, acceptance requires all twelve decided with none unmet, and self-review stays blocked.

### Rerouting

Routing frozen on a document is not silently changed. A controlled reclassification records the old snapshot, the new snapshot, the reason, the actor and the time. Before clinical capture the draft snapshot may be updated in place; once capture exists, or the change materially alters applicable sections, a new draft version is created and the prior document is preserved. A submitted assessment is never mutated.

---

## 7. The care plan

The canonical fourteen sections, unchanged:

1. Front sheet, including allergies and emergency information
2. What we are trying to achieve (**client goals; never removed**)
3. The day
4. The week
5. Personal care
6. Moving about
7. Skin, food and continence
8. Medicines
9. How to be with this person
10. Risks and what we do about them
11. Boundaries
12. Who is coming
13. Review
14. Agreement

Review and Agreement are separate sections. Beneath the human document sits the structured operational layer of needs, goals and tasks, which drives visits and outcome tracking. `care_documents` remains the canonical versioned clinical document; the structured layer never replaces it.

Copy on write: a change creates a new version through `supersedes_id`. Visits snapshot the plan version they were delivered against.

### Lineage, proposals and the issue gate

The chain is always reconstructable: source pre-assessment → assessment work → submitted assessment document → document-bound review → care-plan document → proposal version. One accepted assessment maps to exactly one plan, resolved by `built_from_id`. Drafting a proposal never falls back to the latest plan for a client and never repoints an existing draft at a different plan; when no linked plan exists it fails with a clear error.

Reading proposal content requires an active client-scoped clinical grant **and** that exact version having been sent to that person. Journey-only people read a metadata-only status projection carrying no content. A client responds to one exact version with Agree, Request changes (comment required) or Need a call (comment optional). Agreement applies to that version alone, is not inherited by a new version, and never issues a plan, starts care or records payment. Direct inserts, updates and deletes on the proposal and review tables are revoked from `anon` and `authenticated`; every write goes through a SECURITY DEFINER function with an explicit `search_path` and a server-derived actor.

`private.care_plan_issue_ready` returns false deliberately. The package, staffing, cover, medicines, equipment and Clinical Lead approval layers that would open it do not exist yet, and no placeholder flag stands in for them.

---

## 8. Care package

```text
care_packages   id, client_id, service_id, model, hours, pattern,
                rate, effective_from, effective_to, status,
                supersedes_id, agreed_by, agreed_at
```

Sequence: assessment accepted, then care-plan draft and package proposal in parallel, then package agreed, then staffing, then final clinical refinement, then plan issued, then roster, then care starts. The clinical lead may begin the plan immediately after accepting the assessment; a generated draft and an issued plan are different things, because the plan states planned attendance, hours and who is coming.

---

## 9. Staffing, roster and visits

`care_assignments` means **people assigned to deliver the agreed package**. Roles are delivery roles only: `care_worker`, `nurse`, and further care-delivery professions as needed. Assessor assignment lives on `care_assessment_work.assessor_person_id`; coordinator ownership lives on `care_work_items.assigned_to_user_id`. This matters because an active assignment row grants the care-worker portal capability.

Visits are generated from the roster and snapshot their plan version. Visit state is a projection of append-only `care_visit_events` carrying idempotency keys, which is what makes offline delivery safe. Verification is three-tier and every tier is optional: QR scan first, GPS corroboration second, staff attestation third. A refusal or a failure falls through to the next method and never blocks care.

Visit notes carry a visibility state of `internal`, `care_team` or `client`. Not internal does not mean publishable. Only a coordinator may promote a note to client visibility.

---

## 10. Portals: one shell, resolved capabilities

One morphing portal on the existing candidate shell. `PortalCapability` is resolved deterministically from real records: an active `care_assignments` row grants care worker; an assigned `care_assessment_work` row grants assessor, scoped to that assessment only; a candidate profile grants candidate. One `mu_people` identity may hold all three and sees one navigation, not three applications.

Family and client access is scoped per person through `care_access_grants` and security-definer functions, created by staff. Scope splits three ways and is never inferred from relationship: journey, clinical and finance. Clinical and finance scope additionally require a recorded `care_access_bases` row. The plain-language summary is kept, and in addition a family or client view of the **issued** care plan is rendered according to that person's scope and consent: an authorised representative may receive the agreed plan, a more distant relative a restricted view. Nothing is published to a relative that the office has not scoped.

Client and family access is link first, password later.

---

## 11. Capability versus permission

**Capabilities** are professional grants attached to `mu_people`: assessor, care worker. They grant access to specifically assigned work, nothing more, and each grant carries an audit record.

**Permissions** are staff-console grants: `care_coordinator`, `care_clinical`, `care_finance`. They are managed in the admin centre.

Being an assessor is not an admin permission and never confers console access.

---

## 12. Permissions by action

Server-enforced per action, with the interface hiding what the server would refuse. Only `care_clinical` may accept, return or issue. Only `care_coordinator` may assign, schedule, grant portal access, agree a package or promote a note to client visibility. Only `care_finance` may issue an invoice or allocate fund money. Only the assigned assessor may submit their own assessment. Only the assigned worker may check in to their own visit. Only a super admin may change permissions or publish a form definition.

---

## 13. Notifications

```text
notification_templates   key, channel, subject, body, admin_editable, is_clinical
notifications            id, event, recipient_kind, recipient_id, channel,
                         template_key, payload, status, sent_at, failed_reason,
                         read_at, dedupe_key
```

One dispatcher, driven by the event map. Recipient rules live with the rule, not in a component. Dedupe keys make retries safe. Delivery records, retries, visible failures and read state are required. Administrators may edit non-clinical wording; clinical and safety notifications are release-controlled and marked as such.

---

## 14. Validation and contradiction

Every rule takes exactly one of four behaviours: **block**, **warn with a recorded reason**, **create a work item**, or **create a clinical flag**. Required answers remain a flag, never a block, as `outstandingRequired` already implements. Consent stays the only hard block.

---

## 15. Integrations as fallible systems

No clinical workflow fails because an external service is down. Every integration degrades to a usable path, and every one gains retry, visible failure state and manual resend: Google Places, Paystack with an idempotent webhook and a reconciliation screen, email, WhatsApp with automatic email fallback, storage uploads with a queue, and optional QR, camera and GPS. Scheduled jobs write to a `job_runs` log with a last-success timestamp per job, an alert when a job misses its window, safe re-execution, and every schedule declared in a migration.

---

## 16. Configuration history

Nothing configurable is physically deleted while a record references it. Stable immutable codes on vocabulary terms. Version and `published_at` on every form definition and document. `effective_from` and `effective_to` on prices, fees, SLAs and review intervals. `is_active` and `retired_at` rather than deletion. Snapshotting where a value must survive independently: an issued document snapshots its labels, an invoice line its rate, a visit its plan version. An audit record for every configuration change.

---

## 17. Derived versus stored

**Derived, never stored:** age; next action; overdue; form and plan completion; the active plan version; the active package; the current assignment; visit verification where events determine it; outstanding required items.

**Cached projection with reconciliation:** `clients.stage`.

**Genuinely stored:** everything a human asserted or a document froze.

If two fields can disagree and nothing reconciles them, one of them is a bug.

---

## 18. Database changes required

All additive: `care_people`, `care_access_bases`, `care_access_grants`, `care_work_items`, `care_packages`, `care_assessment_work`, `care_plan_needs`, `care_plan_goals`, `care_plan_tasks`, `care_visits`, `care_visit_events`, `care_escalations`, `care_reviews`, `vocabularies`, `vocabulary_terms`, `working_hours`, `public_holidays`, `configuration_settings` with effective dates, `notification_templates`, `notifications`, `job_runs`, plus `client_contacts.person_id`, `care_access_tokens.person_id`, `client_commercial.payer_person_id`, `date_of_birth_is_estimated` on `clients` and a backfill of `age_years` into `date_of_birth` where possible.

## 19. Code changes required

The shared field library; `deriveCareStage`; `outstandingWork`; `care-rules.ts`; the IndexedDB layer and sync queue; the vocabulary resolver; the notification dispatcher; a token-authenticated address path; and the removal of the free stage dropdown and the age input.

---

## Appendix A. Admin management matrix

| Thing | Should be |
|---|---|
| Clients, contacts, packages, assignments | Admin UI |
| Services catalogue, pricing, fees, budget bands | Governed configuration, finance permission on money |
| Languages, geography, categories, reason codes | Governed configuration, vocabularies |
| Assessment and form definitions | Governed configuration, Form Library, versioned publishing |
| Care-plan templates and task libraries | Governed configuration |
| Clinical need domains | Governed configuration, clinical permission |
| SLAs, review intervals, payment terms | Governed configuration: the number is a setting, the rule is not |
| Working hours and public holidays | Admin UI |
| Assessor and care-worker capabilities | Admin UI, audited per grant |
| Staff permissions | Admin UI, one shared definition |
| Portal access and family scopes | Admin UI, coordinator only |
| Invoices and care fund | Admin UI, finance permission |
| Notification wording, non-clinical | Governed configuration |
| Stage, next action, age, overdue, active plan version | Derived, never managed |

## Appendix B. Explicitly outside admin control

Medication safety rules. Automatic clinical-level gating. Clinical delegation gates. Emergency and same-day routing thresholds. The `blocking` flag on consent. Immutable audit behaviour. Permission policy and RLS. The list of supported field types. The definition of any work-item kind. Anything that decides who may act.

The line: **an administrator may change what we ask and how we ask it. Only a release may change what the answer makes the system do.**

---

## Appendix C. Build order

1. Foundations: migrations, permissions, capabilities
2. Client record completion, derived stage, age from date of birth
3. Assessor workspace and sectioned mode
4. Care plans and the structured layer
5. Packages, assignments and rosters
6. Care worker visits, offline
7. Client and family portal
8. Finance and the care fund
9. Reviews and hardening
