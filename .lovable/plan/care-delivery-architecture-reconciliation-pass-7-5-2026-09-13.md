# Care delivery architecture reconciliation (Pass 7.5)

Ratifies the longitudinal care-delivery model before Tranche 8 creates package, staffing, roster and visit tables. Nothing is built in this pass beyond the primitives listed under 7.5A–7.5E.

## 1. Verified current state

Checked against the live database and current HEAD (migrations 0010–0049).

Exists:
- `care_documents` (19 cols, versioned, `kind`, `status`, `responses`, `built_from_id`, `supersedes_id`, `assessment_work_id`) — 4 rows.
- `care_assessment_work` (23 cols) — holds scheduling, assessor, start/submit/cancel **and** the clinical review fields `review_decision`, `reviewed_by`, `reviewed_at`, `review_reason`.
- `care_assessment_capture_events` — append-only: `client_event_id`, `field_id`, `value` jsonb, `captured_at`, `received_at`, `author_person_id`, `client_seq`.
- `care_plan_needs`, `care_plan_goals`, `care_plan_tasks` — structured plan layer, keyed to `document_id`.
- `care_work_items` (26 cols) — kinds already include `agree_package`, `staff_package`, `first_visit_check`, `review_due`, `resolve_escalation`; 8 rows.
- `care_flags` — severity limited to `review` / `urgent`.
- `form_definitions` — 4 rows: published assessment v1, pre-assessment v2, structural care plan v1.
- `care_access_bases`, `care_access_grants`, scopes journey / clinical / finance.

Does **not** exist (confirmed, not assumed): `care_packages`, `care_rosters`, `care_visits`, `care_visit_events`, `care_monitoring_plans`, `care_monitoring_items`, `care_observations`, `care_interventions`, any medication order/administration table, and **`care_clinical_reviews`** (the review is columns on `care_assessment_work`, not a table).

`care_assignments`: 0 rows, 9 columns, `role` constrained to `assessor | named_caregiver | supervising_nurse`, `person_id` → `mu_people`, `plan_version_id` → `care_documents`. It still carries the broad `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and a `FOR ALL` admin policy from migration 0010, unlike the hardened clinical tables. It is read by stage derivation in 0024, 0031, 0038 and by 0042.

## 2. Stale in the roadmap

- Roadmap 6A/6B/7 are unticked although the code, migrations and tests exist; only populated-screen and device acceptance is outstanding.
- Tranche 8 is written as "package, staffing, assignments, roster" with no delivery-record model; it needs the 7.5 primitives inserted before it.
- Tranche 9 "visits reusing the offline layer" assumes a shared offline primitive that has not been extracted from the assessor implementation.
- "Outcome analytics against plan goals" under Later presumes goal evidence, which does not exist.

## 3. The boundary that must not blur

Assessment answers are evidence captured against a frozen questionnaire version and live only in `care_documents.responses` plus `care_assessment_capture_events`. A weight captured at assessment is not an observation.

Longitudinal delivery data lives in typed tables and is never stored as a questionnaire answer. The `measurement`, `repeatable`, `matrix` and `weekly_pattern` field types stay inside form capture; they may only be used to *populate* a typed delivery record through an explicit server function, never as its store.

Chain: care recipient → episode → care plan → monitoring plan → visit → observation → intervention → goal evidence → professional review → escalation.

## 4. Proposed entities

- `care_episodes` — client, service code, start/end, status, configuration snapshot. The unit an agreed service runs under.
- `care_monitoring_plans` / `care_monitoring_items` — item carries observation type, purpose, frequency, schedule, responsible capability, method, unit, individual target or governed-rule reference, start date, review date, family visibility, self-entry permitted, escalation-rule reference. No thresholds are hard-coded.
- `care_observations` — recipient, episode, visit, monitoring item, observation type code, observed_at, recorded_at, performer, capability, source (manual/device/import/family), structured components jsonb, unit, qualifiers, visibility, status (`recorded` / `corrected` / `retracted`), `corrects_id`, linked flag, media reference.
- `care_observation_components` (only if multi-part values such as BP prove awkward inside jsonb; decided in 7.5B against real examples).
- `care_interventions` — recipient, episode, visit, intervention type, planned vs actual, performer, capability, timings, structured detail, outcome, `responds_to_observation_id`, `followed_by_observation_id`. Medication administration becomes a later specialisation, not part of this pass.
- `care_goal_evidence` — additive to existing `care_plan_goals`: goal, episode, visit, observed_at, evidence type, support level, frequency, duration, opportunity count, free note, performer, visibility. No composite progress score.
- `care_visits` and `care_visit_events` — the event stream is append-only and operational; each event may reference a typed record id but never replaces it.
- `care_delivery_assignments` — replaces the delivery role of `care_assignments`.
- `care_service_configurations` — versioned module configuration resolved by service, age band, plan, capability and per-client override.

Every one of these tables is created with GRANTs limited to the roles its policies allow, RLS on, and writes through security-definer RPCs only, matching the 0044/0046 clinical hardening.

## 5. Visibility

No new top-level access scopes. `journey`, `clinical`, `finance` stay. Each delivery record carries a `visibility` column from a controlled list: `family`, `care_team`, `professional`, `safeguarding`. Family sees a record only when it is `family` **and** the reader holds the relevant grant scope. Professional assignment never implies family access.

## 6. care_assignments

Correct it now while empty rather than preserve a wrong model. Strategy:
1. New `care_delivery_assignments` with capability-based roles (delivery capability code, not job title), episode and package references, effective dates, assigning staff, status.
2. Rewrite the four stage/lifecycle functions that read `care_assignments` (0024, 0031, 0038, 0042) to read the new table.
3. Revoke direct `authenticated` DML on `care_assignments`, replace the `FOR ALL` policy with SELECT-only, and mark it deprecated. No drop in this pass — drop only after the functions are proven on the new table.

## 7. Service configuration

Configuration is data, never a page named after a service. A resolver takes service code, age, active plan, reader capability and client overrides and returns the enabled module set. Safety-required modules carry a `required` flag that no default may suppress. This mirrors and reuses the existing `private.care_resolve_modules` grammar rather than inventing a second one.

## 8. Offline

Extract the assessor IndexedDB layer in `src/lib/care-offline.ts` into a shared primitive: local persistence, client-generated event ids, monotonic sequence, strict provenance, visible sync state, corrections instead of overwrite, server-authoritative validation on sync. Visit capture consumes it; assessment capture keeps its current behaviour unchanged.

## 9. Reuse unchanged

`care_documents` versioning and immutability, `care_plan_needs/goals/tasks`, `care_work_items` and ranking, `care_access_*`, `care_notifications` and the dispatcher, `care_flags`, `src/lib/care-schema.ts`, `private.care_resolve_modules`, the assessor workspace.

## 10. Requires correction before Tranche 8

- `care_assignments` role model and grants (section 6).
- Missing `care_flags` link fields for delivery-side escalation.
- `care-offline.ts` extraction before a second consumer copies it.

## 11. Implementation sequence

- **7.5A** — Documentation only: commit `docs/care-platform/delivery-architecture.md` and update the roadmap. No schema.
- **7.5B** — Migration: `care_episodes`, `care_service_configurations`, resolver function, RLS, grants, tests.
- **7.5C** — Migration: `care_delivery_assignments`, rewrite the four stage functions, restrict `care_assignments`, tests.
- **7.5D** — Migration: `care_monitoring_plans`, `care_monitoring_items`, RPCs, visibility, tests.
- **7.5E** — Migration: `care_observations`, `care_interventions`, `care_goal_evidence`, correction provenance, escalation links, tests.
- **7.5F** — Extract the shared offline primitive; assessor behaviour unchanged; tests.

Tranche 8 resumes after 7.5C, provided 7.5D and 7.5E are scheduled before any visit UI.

## 12. Acceptance and security tests

Rollback-safe SQL in `supabase/tests/`: no `anon`/`authenticated` DML on any new table; RPC-only writes; observation correction creates a successor and never mutates the original; a family reader sees only `family`-visible records and only with the right scope; a delivery assignment grants no portal access; two episodes on one client never cross-read; visit events referencing typed records replay idempotently; safety-required modules survive an age/service default that would hide them.

## 13. First build prompt (7.5A, not executed)

> Implement 7.5A only. Commit `docs/care-platform/delivery-architecture.md` recording the record boundaries, entity list, visibility model, assignment correction strategy, service-configuration resolution and offline split agreed in this pass, and update `roadmap.md` with the 7.5A–7.5F sequence and the corrected Tranche 6/7 state. No migrations, no schema changes, no UI, no database writes. Verify with typecheck and build only.
