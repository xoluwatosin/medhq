# Roadmap

Execution list only. Product decisions live in `docs/care-platform/`; tranche grouping and prompts live in `docs/care-platform/implementation-plan.md`. Order follows the approved execution plan of 12 September 2026.

## Completed

- [x] Restore reflowing larger-text settings across Medic Connect public pages without reintroducing whole-page zoom or affecting Admin, Candidate Portal or Heard.
- [x] Publish pre-assessment version 10: the school and collection questions open on the school run only, living arrangement and overnight responsibility are each asked once, and per-child care is separated from shared duties. Version 9 retired; answered forms keep their own questions.
- [x] Correct the pre-assessment section-counter contrast and rebuild every accessibility display option around stable text reflow rather than whole-page zoom.
- [x] Replace the oversized Heard volunteer role boxes with the approved compact scrapbook stack and remove the inappropriate full-blue role treatment.
- [x] Tighten the Heard header divider spacing, restore the hero mark scale, remove connector lines, rebalance the action pills, and add a fitted mobile menu and accordion footer groups.
- [x] Correct the Heard homepage hero proportions and connector geometry using the selected balanced composition, without changing the official mark, copy, colours or destinations.
- [x] Rebuild the Care record around person, household and care-request context with the approved Structural clinical sidebar, consolidated Care plan navigation and preserved deep links.
- [x] Add governed questionnaire answer-context metadata and a complete pre-assessment submission/revision audit without updating verified records.
- [x] Add auditable working-plan approval and require an approved plan before preparing a client proposal.
- [x] Connect Care Finance to recorded contacts, quotes, invoices, payments, credit notes, refunds and financial activity.
- [x] Verify the Tobi/Bukayo record, permissions, desktop/mobile presentation and existing Care workflows.
- [x] Consolidate Admin navigation by business domain, add the Care Requests work surface, clarify client-record labels and replace the passive Overview without changing existing routes, permissions or workflows.
- [x] Build and verify the static `/admin/clients` design test with stacked mobile records.
- [x] Reorder availability around the usual week and progressively disclose date overrides.
- [x] Derive preference-required groups from `preferencesComplete` and progressively disclose optional groups.
- [x] Preserve all save functions, fields, partial-save behaviour, and completion rules.
- [x] Validate candidate journeys and report required groups for each track.
- [x] Commit the logic architecture review and the architecture contract to `docs/care-platform/`.
- [x] Commit the UI architecture review to `docs/care-platform/ui-architecture.md`.
- [x] Investigate and ratify the account, client profile, family access and onboarding model (`docs/care-platform/account-model.md` Revision 2).
- [x] Approve the implementation execution plan (`docs/care-platform/implementation-plan.md`).

## In progress

- [x] Complete the 75-route SEO expansion: preserved the existing Hospital staffing page, created 74 distinct pages in the Clinical Home Care design, added concise expandable process answers, updated crawler sources, and verified representative phone and desktop layouts.
- [x] Quality-assure and repair all 74 expansion pages so each directly fulfils its search intent, uses page-specific supporting content, and passes content and responsive acceptance checks.

- [x] Admin mobile operating system: full-viewport two-level navigator, contextual back, record section picker, phone-native list rows and dialog/overlay treatment across every Admin page, with desktop unchanged and no backend, route, permission or lifecycle changes. Verified at 430px across 14 populated routes (zero body overflow, drill-down navigation, contextual back to parent record list) and at 1440px for desktop regression.
- [x] Adopt the uploaded Request care HTML as the site-wide soft surface standard, retire asymmetric analogue boxes and verify shared pop-ups on phone and desktop.
- [x] Make the pre-assessment, intake and professional assessment full-page working forms, flatten routine boxes and align their readable text scale with the Welcome experience.
- [x] Compact the mobile assessment controls, remove the global navy iPhone edge, add five-stage intake navigation and derive assessment slots from chosen weekdays and periods. Source, 168 automated checks, build and public responsive checks passed; populated token acceptance remains blocked by the absence of a valid bound test link.
- [x] Make iPhone top and bottom edges follow each page surface, including pre-assessment, professional assessment, Candidate Portal and Admin, without restoring a permanent site-wide navy band.

## Tranche 1: shared field and state foundation

- [x] Build the shared field layer at `src/components/field/*` with 320px behaviour contracts.
- [x] Build the shared `DateField`, `TimeField` and `DateTimeField`; adopt in the care and client screens.
- [x] Build the shared `PhoneField` normalising to E.164 and exposing country context (no schema change in this tranche; persisted country comes with the relevant migration).
- [x] Add one shared `Status`, `SaveState` and `formatDate` for the care path.
- [x] Replace pre-assessment autosave with acknowledged saves and visible save states; never clear the buffer before acknowledgement.

## Tranche 2: identity, access bases and grants

- [x] 2A.1: `care_people`, `client_contacts.person_id` and the one-person-per-contact migration-safety backfill (no merging).
- [x] 2A.2 + 2A.3: `care_access_bases`, `care_access_grants`, `care_my_person_ids()` and grant-scoped RLS over journey, clinical and finance (nine-test security gate passed).
- [x] 2A hardening: basis withdrawal always succeeds and suspends an emptied grant, client rows are no longer readable by grant (safe summary through `care_my_clients()` only), contact and person edits save in one transaction through `care_contact_save()`. Tranche 2A complete.
- [x] 2B: grant administration in the console (Access section on the client record), automatic journey access on pre-assessment submission, basis recording, suspension, revocation, payer and portal invitations.
- [ ] Assign `care_coordinator` and `care_clinical` to real people so commercial data is visible to operations.
- [ ] Add assessor and care-worker capability grants on `mu_people`, with an audit record per grant.
- [ ] Gate: all nine access tests pass with a real second and third identity. (Checkpoint A follows Tranche 3.)

## Tranche 3: notification delivery

- [x] Build the notification model: `care_notifications`, one dispatcher at `supabase/functions/_shared/care-notify.ts`, durable records, dedupe, controlled retry and visible failure. Pre-assessment links and portal invitations route through it. Delivery only; no lifecycle logic.

**Checkpoint A: fields, identity, grants, bases and notifications operate.**

## Tranche 4: controlled data and derived facts

- [x] Controlled codes for sex, relationship, languages and Nigerian geography, held in one shared source (`src/lib/care-vocabularies.ts`) and stored as stable codes on `clients` and `client_contacts`. Old free text stays readable; values that could not be matched are listed in `care_controlled_value_review`.
- [x] Age derived from `date_of_birth` with `date_of_birth_is_estimated`; the age input is gone from Clients and the client record.
- [x] The public address path writes only the address through `care_token_address_save()`, which checks the link and logs the use.

## Tranche 5: work engine and derived stage

- [x] Work engine: `care_work_items`, event rules, dedupe, dependencies, outcomes, working-day due dates and ranked `care_work_ranked()` / `care_client_next_action`.
- [x] `care_derive_stage()` with a reconciled `clients.stage` cache; the stage dropdown and every direct stage write are gone, including in `care-token-send` and `care-form-save`.
- [x] Notification correction: an explicit resend sends again, an accidental replay does not, and only one send can be in flight at a time.

**Checkpoint B: enquiry to callback to pre-assessment runs on real work items.** Verified with synthetic records: callback on client creation, no duplicate on replay, proceeding chains to sending the pre-assessment, one chase after repeated sends, chasing stops when answers return, stages derive through enquiry, awaiting answers, answers returned and paused.


## Tranches 6 and 7: assessments, clinical review, care plan

- [ ] 6A: assessment scheduling and assessor assignment. Built and covered by migrations 0030 to 0041 and `supabase/tests/care_assessment_lifecycle.sql`; awaiting populated screen and device acceptance only.
- [ ] 6B: offline assessor workspace: IndexedDB, append-only events, idempotency keys, sync queue. Built (`src/lib/care-offline.ts`, `src/pages/assessor/AssessmentWorkspace.tsx`); awaiting a genuine network-cut and device run.
- [ ] 7: clinical review and the versioned care plan document. Built and covered by automated checks (`supabase/tests/care_t7_correction.sql`): only clinical staff may accept or return, an assessor cannot review their own work, sent records are immutable, no account writes clinical content directly, acceptance opens one plan draft with plan and package work once, notifications do not duplicate, and no plan can be issued before the package and staffing exist. Awaiting acceptance: populated review and plan screens on a real record, and mobile and device checks.

- [ ] 7 correction (Pass 2, Part A): a review is bound to the exact assessment document its own visit produced (`care_documents.assessment_work_id`), so repeat assessments on one client never cross over and a historical review shows its own sent version; the review returns the assessment's own definition and version alongside the carried pre-assessment's; every authorship and provenance field on a sent record is protected; the four clinical tables carry no write privileges for `anon` or `authenticated`. Covered by `supabase/tests/care_pass2_binding.sql`. Awaiting acceptance: that rollback-safe test run against the database, plus populated review and plan screens and mobile checks.

## Pass 2: the governed questionnaire engine

- [x] Definition schema, whole-definition validation with exact problem paths, and deterministic module resolution implemented identically in the browser (`src/lib/care-schema.ts`) and the database (`private.care_resolve_modules`). Modules are frozen onto the assessment document when the visit starts. Covered by `src/lib/care-schema.test.ts` against an invented question set.
- [x] Professional controls: yes or no, measurements with fixed units, repeatable entries, support matrices and weekly patterns, all read back with their units and entries intact.
- [x] The record renderer reads from the assessment's own definition and frozen modules, keeping carried family evidence, the assessor's clinical answers, section notes and provenance apart.
- [ ] Family sequential screens and the assessor workspace adopted onto the new controls end to end.
- [ ] Server-side validation of captured clinical answers against the frozen definition.
- [ ] Publication of the 184-question catalogue as a form definition, and the Form Library UI (Tranche 12).

**Checkpoint C: enquiry to accepted assessment to drafted plan.**

## Care group and multi-recipient intake

- [x] Stage 1, the multi-person foundation (migration 0070): care groups, memberships, governed directional relationships, care requests, multiple recipients per request, service intentions allocated to one or several recipients with a compatibility flag for clinical resolution, and grouped assessment visits that keep one assessment record per recipient. Every existing care record was placed in its own group and request; `clients.service_id` remains an untouched compatibility projection. Covered by `supabase/tests/care_group_foundation.sql`.
- [x] Stage 1 correction (migration 0071): least privilege over every Stage 1 table (no anon reads, no direct writes by signed-in users, explicit admin read policies in place of blanket manage-everything policies), deliberate recipient-to-person resolution that never matches on email or name and never merges records, and a readiness read model for a request. Covered by `supabase/tests/care_group_security_and_intake.sql`; `supabase/tests/care_intake_correction.sql` repaired to rely on its own rollback.
- [x] Stage 2: the admin preparation workspace, a Family and care group tab on a care record covering Request, People, Recipients, Relationships, Services, Assessment visit and Questionnaire readiness.
- [ ] Stage 3: pre-assessment v5 as one coordinated session across recipients. In progress.
  - [x] Universal clinical lists (`src/lib/care-clinical-lists.ts`), covered by `src/lib/care-clinical-lists.test.ts`.
  - [x] Structured answer layer: new question types (`condition_list`, `medicine_list`, `allergy_list`, `hospital`, `professional`, `appointment_preference`, `care_upload`) in `src/lib/care.ts`, the definition validator, and the server mirror in `supabase/functions/_shared/care-form.ts`; controls in `src/components/care/CareClinicalControls.tsx`; private uploads through the `care-uploads` bucket and the `care-file-upload` function (PDF, JPG, PNG, HEIC, 15MB; Candidate Portal stays PDF only).
  - [ ] The v5 question catalogue itself, the coordinated session across recipients (shared operational answers, recipient-owned clinical answers), the guided one-question screens with numbered navigation, and the additive session migration after 0071.

- [ ] Stage 4: professional assessment v3 with grouped visit preparation and per-recipient records.
- [ ] Stage 5: assessor home preview against Begin assessment, with offline isolation per recipient.
- [ ] Stage 6: documentation of the group model across the care platform docs.



## Pass 7.5: care delivery architecture

Ratified in `docs/care-platform/delivery-architecture.md` on 13 September 2026, before Tranche 8 creates delivery tables. Assessment answers stay in the versioned document architecture; longitudinal observations, interventions and goal evidence live in typed delivery tables and never in questionnaire answers.

- [x] 7.5A: commit the delivery architecture and correct the roadmap. No schema.
- [x] 7.5B: `care_episodes` and `care_service_configurations` with the module resolver, row-level security, grants and tests.
- [x] 7.5C: `care_delivery_assignments`, rewrite the stage and lifecycle functions that read `care_assignments` (0024, 0031, 0038, 0042), restrict the empty `care_assignments` to read only and deprecate it.
- [ ] 7.5D: `care_monitoring_plans` and `care_monitoring_items` with visibility and self-entry rules. No clinical thresholds in the architecture.
- [ ] 7.5E: `care_observations`, `care_interventions` and `care_goal_evidence` with correction provenance and escalation links.
- [ ] 7.5F: extract the shared offline primitive from `src/lib/care-offline.ts`; assessor behaviour unchanged.

## Tranches 8 and 9: package, staffing, roster, visits

Tranche 8 resumes after 7.5C. 7.5D and 7.5E must land before any visit screen, and 7.5F before Tranche 9.

- [ ] 8: care package, staffing, roster, on the corrected delivery assignment model.
- [ ] 9: care worker visits and `care_visit_events` on the shared offline primitive; the event stream references typed records and never replaces them.
- [ ] Add emergency alerting on same-day routes, building on `admin_alerts`.

**Checkpoint D: a worker delivers and records a visit offline and it syncs.**

## Tranche 10: client and family portal

- [ ] 10A: multi-client, scope-aware portal routing and cache keys.
- [ ] 10B: journey, clinical and finance surfaces per grant scope.

**Checkpoint E: different scopes see correctly different things across two clients.**

## Tranche 11: finance and Care Fund

- [ ] Add payment reconciliation and an idempotent Paystack webhook keyed on reference.
- [ ] Invoices, then the Care Fund rebuilt on Cx.

## Tranche 12: reviews, Form Library, hardening

- [ ] Build the governed Form Library with versioned publishing and both preview modes.
- [ ] Make services, pricing, fees, budget bands, SLAs, review intervals, payment terms, working hours and public holidays governed configuration with effective dates.
- [ ] Add `job_runs` visibility, last-success timestamps, missed-window alerts and migration-declared schedules.
- [ ] Build `MoneyField`, `PersonPicker` and `VocabularyField`; consolidate the file upload implementations.

**Checkpoint F: finance operates and configuration is administrable without a developer.**

## Intake integrity correction (done)

- [x] Routing and evidence derived from the exact source pre-assessment's raw answers; no stored `derived_*` keys.
- [x] Document-bound clinical review in the screen, with structured return (category, reason, instructions, priority) and a note required for any check not met.
- [x] Exact assessment to plan to proposal lineage; no fallback plan, no repointed draft.
- [x] Proposal recipients limited to clinical grants; client responses for one exact version.
- [x] Assessor carry-forward split into clinical evidence, context and authority.
- [x] Controlled reroute with old and new routing snapshots, reason, actor and time.

## Still open from that correction

- [ ] Pre-assessment v5: possessive wording for another recipient, service choices filtered by recipient and age, separate first and last name on self-confirmation, honest wording where no upload happens.
- [ ] Populated browser walkthrough and physical-device acceptance of the assessor, review and proposal screens.

## Required before scale

- [ ] Migrate the remaining raw date and phone call sites to the shared components.
- [ ] Move `join_pending_v1` off localStorage to expiring session or server storage.
- [ ] Stop storing raw care tokens in sessionStorage; hold them in memory for the dialog lifetime.

## Operational improvement

- [ ] Add reason-code, closure-reason, escalation-category and work-outcome vocabularies.
- [ ] Allow administrators to edit non-clinical notification wording.
- [ ] Extract `ActivityHistory` from `ClientRecord` into a shared component.
- [ ] Consolidate `PERMISSION_OPTIONS` into one shared module.
- [ ] Add a read-only form definition viewer so live definitions are inspectable without a developer.
- [ ] Fold the `LocationStep` language list into `LanguagePicker` and delete the orphan `GoogleMapsLoader`.
- [ ] Add an expiry to `mc_visitor_v2`.

## Deferred cleanup (after Checkpoint C)

- [ ] Fold `src/components/admin/console/*` into the Mu record grammar and retire `MuStats`.
- [ ] Clean the design tokens: retire `--tag-*`, `--chart-*`, `--spacing`, `--tracking-normal`; remove raw `rgba()` and `#fff` literals; collapse the three radius grammars.
- [ ] Retire the five page-local status maps and seven date formats outside the care path.

## System management

Plan: `docs/administration/system-management.md`. Order: A, C1, B, rest of C, D, E.

Section A is built and tested against a local database; it goes live when the migration is applied at cutover (`scripts/migration/CUTOVER.md` step 6) and `send-admin-alert` and `ops-probe` are deployed.

- [x] A1: health signal catalogue (`ops_checks`), `ops_function_errors` with the shared `_shared/ops-log.ts` wrapper, and `private.ops_run_checks()` on a five-minute cron.
- [x] A2: extend `admin_alerts` with severity, dedupe, occurrences, acknowledge and auto-resolve.
- [x] A4: `/admin/system` live screen with realtime alerts, scheduled jobs, failed deliveries and retry; header alert bell; status strip on the Overview.
- [x] A3: immediate critical email with escalation, hourly warning batch and 07:45 daily digest through a generalised `send-admin-alert`.
- [x] A1 follow-on: `ops-probe` for Resend, Paystack, Anthropic and Google Maps.
- [ ] C1 (alerts and email groups): typed `admin_settings`, `src/lib/system-config.ts` catalogue, `_shared/config.ts`; replace hard-coded alert and operations addresses.
- [ ] B1–B3: `admin_activity` view over existing logs, `admin_audit` trigger on unlogged tables, `/admin/activity` with record and person history links.
- [ ] C1 (remaining groups): working calendar and holiday editor, feature flags, maintenance banners and form pause, secret presence.
- [ ] D1: role templates, with `care_coordinator` and `care_clinical` assigned through roles; move super admins from the hard-coded id into a table and add a second one.
- [ ] D2–D3: account health checks, quarterly access review, and one-step removal of access linked to Workforce leavers.
- [ ] E1: archive registry across Care and Talent, restore and guarded permanent delete.
- [ ] E2–E3: data requests with export and erase, and report-only retention.

## Later

- [ ] Cross-client dashboard for relatives managing several clients.
- [ ] Richer operational reporting.
- [ ] Outcome analytics against plan goals.

## Active: pre-assessment completion

- [ ] Complete seeded intake confirmation, questionnaire grouping/routing, availability redesign, movable accessibility and WhatsApp controls, and full acceptance checks from the approved plan.
  - [x] Align newborn and paediatric routing between the family form and office processing.
  - [x] Remove hidden conditional answers before they reach the care record.
  - [x] Bind newly created full links to their request and care recipient.
  - [ ] Backfill durable recipient keys, publish version 7, deploy the form functions and run populated acceptance checks.

## Heard consumer refinement

- [x] Give the Get involved role cards a playful Heard scrapbook treatment using tape, pinned notes and offset paper layers.
- [x] Add the restrained Letter Room tape, stack, opened-letter, note, postmark, pigeonhole, closing and segment treatments without changing Heard mechanics or Medic Connect.
- [x] Restore direct reading for populated Letter Room letters while retaining the three-sheet stack; add mobile Heard refinements, the approved Primary horizontal logo treatment, Get involved routes and the email-verified volunteer account foundation.
- [x] Apply the approved Heard brand elements across consumer pages and finish the opening screen, header and one-view mobile menu.
- [x] Tidy the existing homepage infinity connector joins and action-pill spacing across phone and desktop sizes.
- [x] Balance the homepage action-pill spacing and lift the infinity composition without shifting the mobile headline.
- [ ] Build the Heard volunteer role questionnaire and application workflow after verification. Deferred by the approved scope.
- [ ] Remove the project primary-domain redirect so `heard.medicconnect.co` serves Heard directly. DNS is active and verified; the remaining blocker is the Lovable domain setting.
