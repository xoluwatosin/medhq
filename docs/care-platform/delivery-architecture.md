# Care delivery architecture

Revision 1, 13 September 2026. Ratified in the Pass 7.5 reconciliation before Tranche 8 creates package, staffing, roster and visit tables.

One underlying care model. Service-specific behaviour is configuration, never a separate application and never a page named after a service. The same primitives must carry clinical home care, post-surgical recovery, chronic-disease support, rehabilitation, eldercare, antenatal and postnatal care, newborn care, nanny and childcare, early-years development, children with additional needs, palliative care and complex care.

## 1. Verified state at the time of writing

Checked against the live database and HEAD at migrations 0010 to 0049.

Present:

- `care_documents`: versioned documents with `kind`, `status`, `responses`, `built_from_id`, `supersedes_id`, `assessment_work_id`.
- `care_assessment_work`: scheduling, assessor, start, submit, cancel, and the clinical review fields `review_decision`, `reviewed_by`, `reviewed_at`, `review_reason`. There is no `care_clinical_reviews` table; the review lives here.
- `care_assessment_capture_events`: append-only capture with `client_event_id`, `field_id`, jsonb `value`, `captured_at`, `received_at`, `author_person_id`, `client_seq`.
- `care_plan_needs`, `care_plan_goals`, `care_plan_tasks`: the structured plan layer, keyed to a plan `document_id`.
- `care_work_items`: kinds already include `agree_package`, `staff_package`, `first_visit_check`, `review_due`, `resolve_escalation`.
- `care_flags`: severity limited to `review` and `urgent`.
- `form_definitions`: published assessment v1, pre-assessment v2, structural care plan v1.
- `care_access_bases` and `care_access_grants` with the scopes `journey`, `clinical`, `finance`.

Absent, confirmed rather than assumed: `care_packages`, `care_rosters`, `care_visits`, `care_visit_events`, `care_monitoring_plans`, `care_monitoring_items`, `care_observations`, `care_interventions`, any medication order or administration table, and `care_clinical_reviews`.

`care_assignments` holds no rows. Its `role` check allows only `assessor`, `named_caregiver` and `supervising_nurse`, it references `mu_people` and `care_documents`, and it still carries the broad `authenticated` insert, update and delete grants and the `FOR ALL` policy from migration 0010. It is read by stage and lifecycle functions in migrations 0024, 0031, 0038 and 0042.

## 2. The boundary that must not blur

An assessment answer is a response to a governed question, captured against a frozen definition version, and it lives only in `care_documents.responses` with its capture events. It is evidence used to formulate care. A weight recorded during an assessment is not an observation.

Longitudinal delivery data lives in typed tables and is never stored as a questionnaire answer. The `measurement`, `repeatable`, `matrix` and `weekly_pattern` field types belong to form capture. They may populate a typed delivery record through an explicit server function; they must never become its store.

The chain is: care recipient, care episode, care plan, monitoring plan where required, care delivery or visit, observations, interventions, functional or developmental evidence, goals and outcomes, professional review, safety and escalation.

## 3. Record classes

### Assessment answer

Versioned, immutable once sent, bound to the exact assessment work that produced it. No change in this pass.

### Monitoring plan item

Defines what should be observed during ongoing care. An item states the observation type, purpose, frequency, timing or schedule, responsible role or capability, method where relevant, unit where applicable, an individual target or range or a reference to a governed rule, start date, end or review date, family visibility, whether self-entry is permitted, and a reference to escalation configuration. No clinical threshold is written into the architecture.

### Observation

A time-specific fact, measurement, symptom report, clinical finding or observed state. It supports structured numeric values and non-numeric values equally: a blood pressure, a temperature, an oxygen saturation, a pain score, a wound observation, "more confused than usual", a new phrase used in play, a transfer completed with partial assistance.

An observation records the care recipient, care episode, visit or encounter where applicable, monitoring plan item where applicable, observation type code, observed time, recorded time, performer, the capability the performer acted under, source (manual, device, import, family self-entry), structured value or component values, unit, contextual qualifiers, visibility, status, correction provenance, any linked escalation or review, and media where permitted.

Corrections create a successor row that points at the original. Nothing is silently overwritten and nothing is deleted.

### Intervention or treatment

Something done to or for the person: a medication administration, an infusion, oxygen started or changed, a dressing, catheter care, a feed, a therapeutic exercise, a support strategy used. An intervention is separate from the observation before it and the observation after it, and the model records those links so that observation, intervention and follow-up observation form a chain rather than three sentences in a visit note.

Medication administration is a later specialisation of this record class, not a parallel system.

### Visit event

An append-only operational event during a visit or shift, following the assessment capture pattern: client-generated event identifier, monotonic client sequence, strict provenance, idempotent server processing. An event may create or reference a typed record, for example `observation_recorded` referencing an observation, `medication_administered` referencing an administration record, `goal_evidence_recorded` referencing goal evidence. The event log is never the sole clinical record.

### Goal evidence

Additive to the existing `care_plan_goals`. Evidence records the goal, episode, visit, observed time, evidence type, support level, frequency, duration, opportunity count where counted, note, performer and visibility. The same mechanism serves child development, additional needs, rehabilitation, eldercare independence and recovery goals. There is no development percentage and no generic progress score.

### Professional review

Interpretation lives in review, not in raw records. "BP 169/96" is an observation; "blood-pressure control requires review" is a review. "Used four new words" is evidence; "expressive communication is progressing" is a review.

## 4. Proposed entities

- `care_episodes`: client, service code, start and end, status, configuration snapshot. The unit an agreed service runs under.
- `care_service_configurations`: versioned module configuration resolved by service, age band, active plan, professional capability and per-client override.
- `care_delivery_assignments`: the delivery assignment model that replaces the delivery role of `care_assignments`.
- `care_monitoring_plans` and `care_monitoring_items`.
- `care_observations`, with `care_observation_components` only if multi-part values prove awkward inside jsonb.
- `care_interventions`.
- `care_goal_evidence`.
- `care_visits` and `care_visit_events`.

Every new table is created with grants limited to the roles its policies allow, row-level security on, and writes through security-definer functions only, matching the clinical hardening of migrations 0044 and 0046.

## 5. Visibility

The top-level scopes stay as they are: `journey`, `clinical`, `finance`. No new top-level scopes are created.

Each delivery record carries a visibility value from a controlled list: `family`, `care_team`, `professional`, `safeguarding`. A family reader sees a record only when it is family-visible and the reader holds the relevant grant scope. Module-level family visibility sits underneath an authorised clinical grant; it never substitutes for one. Professional assignment never implies family access.

## 6. Correcting care_assignments

The table is empty, so correcting it now is safer than carrying a known-wrong role model into production records.

1. Create `care_delivery_assignments` with capability-based roles rather than job titles, referencing the episode, with effective dates, assigning staff and status. The episode relation exists now; the package relation is added additively in Tranche 8, when packages exist.
2. Rewrite the stage and lifecycle functions from migrations 0024, 0031, 0038 and 0042 to read the new table.
3. Revoke direct `authenticated` writes on `care_assignments`, reduce its policy to select only, and mark it deprecated. It is not dropped in this pass; it is dropped only once the rewritten functions are proven.

Assessor assignment stays on `care_assessment_work.assessor_person_id`. Delivery assignment, case or work-item ownership, assessor capability and family portal access remain four separate things.

## 7. Service configuration

A resolver takes service code, age, active care plan, reader capability and client overrides, and returns the enabled module set. It keeps the module grammar of `private.care_resolve_modules` — the same module codes, the same required flag, the same shape — rather than inventing a second vocabulary; the episode resolver reads a frozen configuration array instead of questionnaire responses. Safety-required modules carry a required flag that no age, service default or client override may suppress.

A published service configuration version is never edited in place, and publishing a new version never changes an episode already activated against an earlier one. An episode carries its own frozen configuration snapshot.

## 8. Offline and audit

The assessor offline layer in `src/lib/care-offline.ts` is extracted into a shared primitive: local persistence, append-only client-generated event identifiers, monotonic sequence, strict provenance, visible sync state, corrections instead of silent overwrite, and server-authoritative validation on sync. Visit capture consumes the shared primitive; assessment behaviour is unchanged by the extraction.

The append-only stream holds operational events. Typed canonical tables hold the clinical record.

## 9. Reused unchanged

`care_documents` versioning and immutability, `care_plan_needs`, `care_plan_goals`, `care_plan_tasks`, `care_work_items` and its ranking, the access bases and grants model, `care_notifications` and its dispatcher, `care_flags`, `src/lib/care-schema.ts`, `private.care_resolve_modules` and the assessor workspace.

The care plan is not duplicated. Any support plan or clinical plan is a governed module and version of the existing Care Plan document.

## 10. Requiring correction before Tranche 8

Blocking Tranche 8:

- The `care_assignments` role model and grants. Corrected in 7.5C.

Not blocking Tranche 8, but required before any visit screen is built:

- Escalation links from delivery records to `care_flags` (7.5E).
- Extraction of the offline primitive, before a second consumer copies the assessor implementation (7.5F, before Tranche 9).

## 11. Sequence

- 7.5A: this document and the roadmap. No schema.
- 7.5B: `care_episodes`, `care_service_configurations`, the resolver, row-level security, grants, tests.
- 7.5C: `care_delivery_assignments`, rewritten stage functions, restricted `care_assignments`, tests.
- 7.5D: `care_monitoring_plans`, `care_monitoring_items`, functions, visibility, tests.
- 7.5E: `care_observations`, `care_interventions`, `care_goal_evidence`, correction provenance, escalation links, tests.
- 7.5F: the shared offline primitive.

Tranche 8 resumes after 7.5C. 7.5D and 7.5E must land before any visit screen is built, and 7.5F before Tranche 9.

## 12. Acceptance and security tests

Rollback-safe SQL in `supabase/tests/`: no `anon` or `authenticated` write privileges on any new table; writes only through functions; an observation correction creates a successor and never mutates the original; a family reader sees only family-visible records and only with the right scope; a delivery assignment grants no portal access; two episodes on one client never cross-read; visit events referencing typed records replay idempotently; safety-required modules survive an age or service default that would otherwise hide them.
