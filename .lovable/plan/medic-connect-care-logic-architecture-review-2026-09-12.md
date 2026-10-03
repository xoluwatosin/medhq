# Medic Connect Care: Logic Architecture Review

An audit of the live code, database, forms, routes and functions against one question: **could operations and clinical teams run this day to day without a developer?**

Not a screen review. Every finding below was checked against the running system. Findings marked *verified* were read directly from the code or the database on 12 September 2026.

Classification used throughout:

- **C** Critical before real care
- **S** Required before scale
- **O** Operational improvement
- **L** Later

---

## Part 1. The verdict

The clinical spine is sound. What is missing is almost entirely the **operating layer**: the machinery that makes a system run itself. Specifically, six gaps stand out, and five of them are cheap to close now and expensive to close later.

1. **Stage is typed, not derived.** *Verified:* `ClientRecord.tsx:731` renders a `Select` bound to `clientDraft.stage`, saved straight to `clients.stage`. A coordinator can set a client to "Care running" with no assessment, no plan and no package. Nothing reconciles it.
2. **Age is a second, independent truth.** *Verified:* `clients` holds both `date_of_birth` and `age_years`. Every screen reads `age_years` (`Clients.tsx:118,185,264`, `ClientRecord.tsx:290,397,717`); **nothing in the codebase reads or writes `date_of_birth`**. Age is hand-typed into a `type="number"` box and never ages.
3. **Controlled vocabularies store labels, not keys.** *Verified:* `languages.ts` is a hardcoded array of display strings; `LanguagePicker` stores them as a comma-joined string of those same strings. Renaming a language rewrites history. `nigeria-locations.ts` is likewise a hardcoded 37-key object.
4. **Address lookup cannot work where it matters most.** *Verified:* `supabase/functions/address-autocomplete/index.ts:19-28` returns 401 without an authenticated Supabase user. `CareFieldInput.tsx:76` renders that component for `type: "address"`, and `CareFieldInput` is what draws the **public, token-based pre-assessment**. Families on the link get a silent empty dropdown. It also returns formatted text only, no place details, no components, no coordinates, so state, LGA and area are never derived from it.
5. **A failed save destroys the answer and says nothing.** *Verified:* `PreAssessment.tsx:68-86` debounces 900ms, clears its buffer **before** the request returns, and only acts on success. A dropped connection discards the typed answer with no toast, no retry and no queue, while the screen still shows the last "Saved" time. There is no local draft and no `beforeunload` guard. This is the highest-risk defect in the audit.
6. **There is no offline capability of any kind.** *Verified:* no service worker, no manifest, no PWA plugin, no IndexedDB anywhere in the repository. Care workers and assessors will be in Nigerian homes with no signal, and today the application simply does not function there.
7. **There is no work layer and no notification layer at all.** Neither exists in schema or code today. Everything currently described as a "status" is a flat string on a row.


Two smaller but real ones: `care_coordinator` and `care_clinical` exist in the permission picker (`ControlCentre.tsx:36-37`, `WorkforceStaff.tsx:59-60`) but **no admin currently holds either** (*verified against `admin_permissions`*), so commercial data on `ClientRecord.tsx:88` is presently invisible to everyone except the super admin. And `PERMISSION_OPTIONS` is defined twice, in both of those files, which will drift.

---

## Part 2. Source-of-truth audit

Columns confirmed against the live schema. "Derived" means no stored column, or a stored column that is explicitly a reconciled cache.

| Information | Origin today | Should be | Who creates | Who amends | History | Change effect |
|---|---|---|---|---|---|---|
| Client name | Typed, `clients.full_name` | Keep typed; split first and last | Coordinator, or promoted enquiry | Coordinator | Activity entry | Appears on issued documents; document keeps its own snapshot |
| Date of birth | Column exists, **unused** | The single truth. Date control with no future dates | Coordinator or assessment | Coordinator, clinical | Activity entry | Recomputes age everywhere |
| Age | **Stored and hand-typed** | **Derived from DOB.** Drop from all forms | Nobody | Nobody | n/a | Changes silently with time, correctly |
| Approximate age (no DOB known) | Absent | `date_of_birth_is_estimated` boolean plus DOB set to 1 July of the estimated year | Coordinator, assessor | Clinical | Activity entry | Age still derives; the UI says "about" |
| Sex | Typed text | Controlled vocabulary with stable keys | Coordinator, assessment | Clinical | Activity | Clinical relevance only |
| Languages | Comma-joined **display labels** | Array of stable codes; label resolved at render | Coordinator, family, assessor | Any | Activity | Renaming must not rewrite records |
| Phone, WhatsApp | Typed, inconsistent formats | One phone component, stored E.164, country stored separately | Anyone with the record | Coordinator | Activity | Link delivery depends on it |
| Address line | Google text, or typed | Google text plus a stored `place_id` and coordinates where available | Family, coordinator, assessor | Coordinator | Activity | Worker travel, visit GPS corroboration |
| Landmark | Typed free text. Correct as free text | Unchanged | Anyone | Anyone | Activity | Worker briefing only |
| State, LGA | Typed or picked from the hardcoded file | Picked from a **database** geography table; LGA options constrained by state | Family, coordinator | Coordinator | Activity | Matching, worker travel, reporting |
| Service requested | `clients.service_id` from the enquiry | Unchanged. This is "what they asked for" and is never overwritten by what we later supply | Enquiry, coordinator | Coordinator, with reason | Activity | Drives which pre-assessment sections apply |
| Care package | Absent | New `care_packages`, superseding rows | Coordinator | Coordinator, creates new version | Superseding row | Roster, invoices, plan section "Who is coming" |
| Case stage | **Free dropdown** | **Derived** by `deriveCareStage`, cached on `clients.stage` with nightly reconciliation. Only `paused` and `closed` settable, both with a reason | System | System | Derivation is replayable | List filters only |
| Next action | Absent | Derived, first row of ranked `outstandingWork(clientId)` | System | System | Work items carry their own history | Never stored |
| Assessor | Absent | `care_assessment_work.assessor_person_id` | Coordinator | Coordinator until started | Work item + activity | Portal access to that one assessment |
| Care worker | `care_assignments.person_id` | Unchanged, delivery roles only | Coordinator | Coordinator | Row dates, never deleted | Portal capability, roster, visits |
| Assessment date | Absent | `care_assessment_work.appointment_at` | Coordinator | Coordinator | Activity | Work due dates recalculate |
| Review date | Absent | `care_reviews.due_on`, seeded from a configurable interval per service | System from interval | Clinical, with reason | Activity | Creates `review_due` work |
| Care plan version | `care_documents.version` exists | Unchanged | Clinical | Copy on write | `supersedes_id` chain | Visits snapshot their version |
| Invoice due date | Absent | Derived from issue date plus a configurable payment term | System | Finance, with reason | Activity | Chase work items |
| Visit status | Absent | Projection of `care_visit_events` | System | Supervisor can accept or reject verification | Append-only events | Invoice lines, exception board |

**Missing-value rules.** Every field above needs one of four behaviours, and today none of them are specified: *block* (cannot proceed), *flag* (record a `care_flags` row), *work* (create a work item to go and get it), or *say so* (render "Not said", never blank, never zero). Part 8 assigns one to each.

---

## Part 3. Controlled data

### Languages

*Verified:* `src/lib/languages.ts` holds two hardcoded arrays and a `searchLanguages` helper. `LanguagePicker.tsx` stores a comma-joined string of display labels. There is no "Other", no admin management, and no stable key.

Proposed: a `vocabularies` and `vocabulary_terms` pair in the database.

```
vocabularies        key (languages, sex, relationships, escalation_category,
                    closure_reason, need_domain, service_model, ...),
                    name, description, admin_managed boolean
vocabulary_terms    id, vocabulary_key, code (stable, immutable),
                    label, sort_order, is_active, retired_at, retired_reason,
                    parent_code (nullable, for state -> LGA)
```

Rules: records store `code`; screens resolve the label at render; retiring hides a term from new pickers but never from existing records; renaming changes only the label; a code is never reused. Search is supported, multiple selection where the field allows it, and "Other" is a term with `code = 'other'` paired with a free-text sibling field, never an uncontrolled escape hatch.

**C** Move languages to the database with stable codes before more client records exist. Migrating six records is trivial; migrating six hundred is not.

### Geography

*Verified:* `nigeria-locations.ts` is a static file with all 36 states plus FCT; `getLGAsForState` already constrains LGA by state, and `CareFieldInput.tsx:82` uses it for `type: "lga"`. That constraint logic is correct and should be kept, but the data must move into `vocabulary_terms` with `parent_code`, so administrators can correct a spelling without a release.

The layering, which does not exist today:

```text
Google Places  ->  suggestion text + place_id            (convenience, never authority)
Place details  ->  components + lat/lng                   (not currently fetched at all)
                   |
                   v  best-effort mapping, always shown for confirmation
State (local vocabulary)  ->  LGA (local vocabulary, constrained by state)
                   +
Area, landmark (free text)   Coordinates (stored if returned)
```

Rules:

- The local geography vocabulary is the **only** authority for state and LGA. Google never writes either directly.
- When Google returns an administrative area, we pre-select the matching state and LGA and render them as **Confirm or change**, exactly the pattern already agreed for carried pre-assessment answers. A wrong LGA is corrected in one tap.
- Coordinates are stored when returned and used only as corroboration for visit check-in and worker travel. They are never required.
- **Offline or Google unavailable:** the address field falls back to a plain text box plus the two local pickers. Nothing is blocked, and the UI says so in a sentence rather than showing an empty dropdown. The current silent-empty-dropdown behaviour is the failure mode to remove.
- **C** Fix the 401: the public pre-assessment must reach address suggestions through a token-authenticated path, or fall back cleanly. Today it does neither.

### Dates

*Verified:* fourteen files use a raw native `<input type="date">`, including `CareFieldInput.tsx:58`, `WorkPanel.tsx`, `LeavePanel.tsx`, `DocumentsPanel.tsx`, `FieldAnswerInput.tsx`, `LocationStep.tsx` and six admin screens. None sets `min` or `max`. Separately, several admin screens use the shadcn `Popover` plus `Calendar` pattern. So there are at least two date implementations and no shared rules.

One shared `DateField` replaces both:

- `min` and `max` per use, with date of birth capped at today and floored at a plausible age;
- `w-full min-w-0` and a constrained parent so it can never exceed its container, which is the recorded overflow problem, and `max-width: 100%` on the native calendar indicator;
- tested at 320px as an explicit acceptance criterion;
- one fallback path when a browser renders the native control badly;
- separate `TimeField` and `DateTimeField` built on the same base, because time-of-day rules differ.

**C** for the shared component and the DOB rules. **S** for migrating all fourteen call sites.

---

## Part 4. The form engine as an administrative product

*Verified:* `form_definitions` holds `kind`, `version`, `status`, `published_at`, `published_by`, `definition` jsonb. Two rows exist: `pre_assessment` v1 retired, v2 published with 21 sections. The shared engine (`src/lib/care.ts`, mirrored in `supabase/functions/_shared/care-form.ts`) already supports 16 field types, `showWhen` conditions, module rules, `prefill`, `routes` for risk escalation, `blocking` consent and exclusive options.

That is a genuinely strong foundation. The definition is data; only the authoring tool is missing. Today a wording change requires a developer to re-upsert JSON.

### Admin-configurable, through a governed Form Library

Create draft definition; add, rename and reorder sections; add and reorder questions; edit the client-facing wording (`asked`) and the clinical record wording (`record`) **separately**, which the schema already supports; choose a field type from the supported list; define options from a controlled vocabulary or a local list; set required or optional; define conditional visibility using existing fields; set which earlier response a field carries forward from and whether Confirm or Amend applies; preview both the family view and the assessor view; publish as a new version; retire a field without deleting data; and see which live documents still reference an older version.

Every publish creates a **new version**. Existing documents keep their `form_definition_id`, so a published change never rewrites a submitted assessment.

### Not admin-configurable, ever

Medication safety rules. Automatic clinical-level rules such as 3A and 3B gating. Clinical delegation gates. Emergency and same-day routing thresholds. The `blocking` flag on consent. Immutable audit behaviour. Permission policies. RLS. The list of supported field types. Anything that decides who may act.

These live in code and in `src/lib/care-rules.ts`, are reviewed as a release, and the Form Library renders them read-only with a note naming them as governed rules.

The line: **an administrator may change what we ask and how we ask it. Only a release may change what the answer makes the system do.** The one exception is that a field's `routes` target may be admin-editable among existing routing destinations, because that is operational, but `sameDay` may not, because that is clinical urgency.

**S** the Form Library. **C** a read-only definition viewer in admin, so at least somebody can see what is live without a developer.

---

## Part 5. Admin management matrix

| Thing | Today | Should be |
|---|---|---|
| Clients, contacts | Admin UI, exists | Admin UI |
| Services catalogue | Database only | Governed configuration screen |
| Care packages | Absent | Admin UI |
| Pricing, service fees, budget bands | Database only | Governed configuration screen, finance permission |
| Languages | **Code file** | Governed configuration, vocabularies |
| Geography | **Code file** | Governed configuration, vocabularies |
| Assessment definitions | Database, no screen | Governed configuration, Form Library |
| Care-plan templates, task libraries | Absent | Governed configuration |
| Clinical need domains | Absent | Governed configuration, clinical permission |
| Work-item rules | Absent | **Release only.** Names, owners and whether a rule is active may be viewed; creating a new rule kind is a release |
| SLAs and due-date rules | Absent | Governed configuration: the number of hours per rule is a setting, the rule itself is not |
| Working hours and public holidays | Absent | Admin UI. Nigerian public holidays change yearly and must not need a developer |
| Assessor and care-worker capabilities | Absent | Admin UI, with an audit record per grant |
| Staff permissions | Admin UI, exists, **duplicated in two files** | Admin UI, one shared definition |
| Care assignments | Partial | Admin UI |
| Portal access, family scopes | Absent | Admin UI, coordinator only |
| Document recipients | Absent | Admin UI per client |
| Invoices, care fund | Absent | Admin UI, finance permission |
| Review intervals | Absent | Governed configuration per service |
| Notification templates | Code and `email_kit_templates` | Governed configuration for non-clinical wording; clinical and safety notifications are release-only |
| Escalation categories, reason codes, closure reasons | Absent or free text | Governed configuration, vocabularies |
| Case stage, next action, age, overdue, active plan version | n/a | **Derived. Never managed** |

---

## Part 6. Event and reaction map

The format for each: **trigger, validations, writes, derived changes, work, notifications, portal effect, audit.** Abbreviated here to the consequences that are not obvious; the committed document carries all of them in full.

| Event | Writes | Derived | Work created | Work closed | Notifies | Portal effect |
|---|---|---|---|---|---|---|
| Enquiry promoted | client, contact, enquiry link | stage → enquiry | `callback` | none | coordinator | none |
| Callback completed | activity contact event, outcome | stage unchanged | `send_pre_assessment` if proceeding; else closure | `callback` | none | none |
| Pre-assessment sent | token, activity | stage → awaiting_pre_assessment | `chase_pre_assessment` at +48h | `send_pre_assessment` | none | link live |
| Pre-assessment opened | token `first_opened_at` | none | none | cancels the chase | coordinator, quiet | none |
| Pre-assessment submitted | document frozen, `outstanding_required`, `care_flags` from routes | stage → pre_assessment_received | `book_assessment`; `resolve_escalation` if a same-day flag | chase | coordinator; urgent alert on same-day flag | family journey advances |
| Assessment booked | `care_assessment_work.appointment_at` | stage → assessment_booked | `assign_assessor`, due 24h before or immediately if sooner | `book_assessment` | coordinator | family sees the date |
| Assessor assigned | assessor person | none | `conduct_assessment` to the assessor | `assign_assessor` | assessor, in portal | assessor sees briefing |
| Assessment started | status, `started_at` | stage → assessment_in_progress | none | none | none | none |
| Assessment submitted | document version, hash | stage → clinical_review | `clinical_review` to **Clinical Lead** | `conduct_assessment` | clinical lead | family: "with our clinical team" |
| Assessment returned | review outcome, reason | stage back | reopens `conduct_assessment` with the reason | `clinical_review` | assessor, reason verbatim | none |
| Assessment accepted | decision | stage → care_plan_preparation | `prepare_care_plan` **and** `agree_package`, in parallel | `clinical_review` | clinical, coordinator | none |
| Care-plan draft generated | plan document draft, needs, goals, tasks | none | none | none | none | none |
| Package proposed | `care_packages` proposed | none | none | none | coordinator | client sees a proposal if scoped |
| Package agreed | package agreed, agreement record | stage → care_setup | `staff_package` | `agree_package` | coordinator | client sees what is supplied |
| Worker assigned | `care_assignments` | portal capability gained | `refine_care_plan` | `staff_package` | worker | worker sees the client |
| Care plan issued | document issued, version frozen | none | roster setup; `first_visit_check` | `refine_care_plan` | client, worker, family per scope | plan visible per scope |
| Visit generated | `care_visits` scheduled | none | none | none | none | appears on worker and family schedule |
| Visit started | check-in event | visit status | none | none | none | family timeline shows "in progress" |
| Visit missed | missed detection 30 min after end | none | `resolve_escalation`, urgent | none | coordinator | family sees it; honesty is the policy |
| Task refused | task outcome | none | flag if the task is medication or safety | none | coordinator | not published automatically |
| Escalation raised | `care_escalations`, `admin_alerts` if emergency | none | `resolve_escalation` | none | coordinator immediately | family only when the office publishes |
| Visit completed | checkout, client-visible summary | verification state | none | `first_visit_check` if first | none | summary on the family timeline |
| Invoice issued | invoice, lines | none | `chase_payment` at due date | none | client | payable |
| Payment received | payment, allocation | none | none | `chase_payment` | finance | receipt |
| Review due | `care_reviews` | none | `review_due` to clinical | none | clinical | none |
| Plan reissued | new document version | active version | `agree_package` if provision changed | `review_due` | worker, client | worker sees the new plan, old one marked superseded |
| Family access granted or revoked | `care_portal_access` | none | none | none | the relative, on grant | scoped views appear or vanish |
| Client paused | reason required | stage → paused | cancels non-safety work, keeps safety work | none | coordinator, worker | visits stop, family told |
| Client closed | reason required | stage → closed | cancels all open work with a recorded reason | none | all parties | portal becomes read-only for the retention period |

**Pausing cancels work; it does not delete it.** Cancelled work keeps its reason.

---

## Part 7. The work engine

Beyond the table in the architecture, the engine needs these to be complete, and none exist today:

- **Ownership.** A rule names either a user, a team queue, or a derivation such as "the assessor on this assessment". Unassigned work sits in a queue, never nowhere.
- **Duplicate prevention.** Unique on `(client_id, kind, created_from_id)` while status is open. A second pre-assessment send never creates a second chase.
- **Due dates in working hours.** "+4 working hours" requires a working-hours calendar and a Nigerian public-holiday table, both administrator-managed. Without them every SLA is wrong for a third of the year.
- **Dependencies.** A work item may declare a blocker. `staff_package` cannot open before `agree_package` closes. Blocked work is visible but not overdue.
- **Blocking versus non-blocking.** A blocking item prevents the stage advancing. A non-blocking item does not.
- **Reassignment, cancellation, reopening**, each with a reason and an activity entry.
- **Outcomes**, from a controlled vocabulary per kind, because "what happened" is reportable and free text is not.
- **Chained creation.** A rule may fire on an outcome, not only on an event. "Callback completed with outcome *not proceeding*" closes the case rather than sending a pre-assessment.
- **Overdue behaviour.** Surface once, escalate to a named person after a configured interval, never nag repeatedly. The candidate nudge work already proved this.

**Next action ranking**, deterministic, in `outstandingWork(clientId)`:

1. Safety and clinical blockers
2. Urgent priority
3. Overdue
4. Due within two working days
5. Everything else, earliest due date first, then creation order

The UI states the reason in a sentence rather than making the user infer it: "Next because a safeguarding concern is open", "Next because this was due on Tuesday". A ranking nobody can explain is a ranking nobody trusts.

---

## Part 8. Offline and persistence

| Workflow | Classification |
|---|---|
| Care worker: today's assignments, issued plan, emergency instructions, check in, tasks, notes, escalation, check out | **Must work offline** |
| Assessor: briefing, full assessment, photographs, save, resume after closing the browser, submit | **Must work offline**, except submit |
| Pre-assessment for families | **Should partially work offline**: never lose a typed answer |
| Admin console | Online required |
| Family portal | Online, but must survive an interruption without losing form or payment-navigation state |

**Where we start from.** *Verified:* there is **no service worker, no manifest, no PWA plugin and no IndexedDB usage anywhere in the repository.** The application is entirely online-dependent. The only resilience that exists is server-side resume: the pre-assessment reloads its answers by token on a return visit.

**Three current storage problems, all verified.**

- `sessionStorage["care_token_<id>"]` in `ClientRecord.tsx:241,250` holds the **raw pre-assessment share token**, which is a bearer secret granting write access to a client's clinical intake. It should be held in memory for the life of the dialog, not in session storage. **C**
- `localStorage["join_pending_v1"]` (`JoinAccount.tsx:198`, `usePortal.ts:192`) holds full name, phone, institution and course between signup and email confirmation, unencrypted and un-expiring if the user never returns. Move it to `sessionStorage` with an expiry, or to the server behind the signup token. **S**
- `localStorage["mc_visitor_v2"]` holds a marketing visitor's name, phone and email. That is a deliberate, consented convenience for the public site and is acceptable, but it must never be extended to hold anything clinical, and it needs the same expiry treatment. **O**

**Storage going forward.** IndexedDB for operational and clinical data, never localStorage. localStorage keeps only non-sensitive device preferences. Local clinical data is scoped to the signed-in person, cleared on sign out, and expires after a configured number of days. `AuthContext.tsx:119` already sweeps `sb-*` keys on sign out and is the right place to hook the wipe. Devices are shared in practice, so sign out must wipe, not merely forget.

**Six states, never a spinner.** Entered; Saved on this device; Waiting to sync; Synced; Sync failed with a retry; Newer version available.

The pre-assessment today is the exact pattern to replace, and it is worse than two-state. *Verified in `PreAssessment.tsx:68-86`:* the buffered patch is cleared from `pending.current` **before** the request completes, and the result is only read on success. A failed save therefore discards the answer with no toast, no retry and no queue, and the screen simply keeps showing the last "Saved" time as though nothing happened. There is no `beforeunload` guard either, so anything typed inside the 900ms window before a refresh is gone. This is the single highest-risk defect in the audit, because it loses clinical information silently.

**Rules.** Per-field autosave locally on change, batched to the server; the buffer cleared only on acknowledgement; append-only events with client-generated idempotency keys; queue ordered per visit; media queued separately with its own retry and a visible pending state; explicit server acknowledgement before anything reads as Synced; a stale plan snapshot warns and offers a refresh rather than silently using old instructions; concurrent edits on the same assessment section warn rather than overwrite.

**The state vocabulary must never be collapsed.** Entered, saved locally, saved to server, submitted, reviewed, verified, accepted are seven different things and the UI must be able to say which one applies.


---

## Part 9. Remembered state

| Thing | Where |
|---|---|
| Selected client, record tab, list filter and sort, assessment section | **URL.** Already the pattern in `ClientRecord` |
| Active portal section, last admin workspace, collapsed sections, table density | Device preference |
| Assessor's in-progress answers | Device, IndexedDB, scoped and expiring |
| Family portal active client where a relative manages several | URL, with an account default |
| Draft filters, unsaved dialog state | Temporary session state |
| Client names, addresses, clinical content | **Never** in localStorage |

---

## Part 10. Validation and contradiction

Four behaviours, and every rule gets exactly one.

**Block.** Missing consent (already implemented as `blocking`). Roster without an active package. Worker scheduled outside their assignment dates. Family scope including payments where the contact is not permitted financial access. Care plan issued before the package is agreed. Plan review date before issue date.

**Warn, and allow with a recorded reason.** Package starting before the plan issue date, which is legitimate in an emergency and must be recorded as such. Assessment appointment within 24 hours with no assessor. A DOB producing an implausible age.

**Create a work item.** State and LGA that do not correspond. Assessment appointment with no assessor more than 24 hours out. A visit referencing a superseded plan.

**Create a clinical flag.** Unable to walk independently with transfer assistance unanswered. An allergy recorded with no reaction. A medicine at a delegation level with no gate satisfied. These are clinical incompletenesses, not user errors, and they go to a clinician rather than blocking a form.

Required remains a flag, never a block, exactly as `outstandingRequired` already implements. That decision was right and is unchanged.

---

## Part 11. Integrations as fallible systems

*Verified across the 44 edge functions and every client call site:* **not one integration has a retry anywhere in the system.** The universal pattern is try, catch, toast, and in several places not even the toast. That is the finding, more than any individual integration.

| Integration | Today | Required |
|---|---|---|
| Google Places | Autocomplete only; **401 for unauthenticated users**, so the public pre-assessment can never use it; on failure `AddressAutocomplete.tsx:52` logs to the console and clears the list, showing the user nothing; `GoogleMapsLoader.tsx:39` resolves `false` on script error and never retries; no place details, so no components and no coordinates | Token-authenticated path for public forms, place details fetched, plain text plus local pickers as the fallback, and a sentence saying so rather than an empty dropdown |
| Paystack | `generate-paystack-link` initialises a transaction; client shows a toast on failure | Idempotent webhook keyed on reference, manual reconciliation screen, retry, a payment that is pending is never shown as paid |
| Email, Resend | Used by roughly 25 functions, delivery webhook exists. `ClientRecord.tsx:255` already does the right thing: the token is still created when the email fails, and the failure is surfaced | Generalise that partial-failure pattern. Failure visible on the record, admin retry, suppression respected |
| WhatsApp | Two mechanisms: a `wa.me` deep link built client-side, which silently does nothing if the popup is blocked, and the `send-whatsapp` function with a toast on failure | Email fallback automatically, delivery state on the record, manual resend, and a visible path when the deep link is blocked |
| Storage | Used for documents across roughly fifteen independent hand-wired upload handlers, no retry queue observed in any of them | One upload component with a queue, retry, a visible pending state, never blocking a visit or an assessment |
| QR scanning, camera, GPS | **Entirely absent.** No `getUserMedia`, no QR library, no `navigator.geolocation`. Document capture is a plain file picker | All three optional at every point of use; a refusal or failure falls through to the next verification method; permission denied is explained once, not repeatedly |
| Scheduled jobs | Seven `pg_cron` jobs run today: document parse sweep every 15 minutes, reparse pool every 5, orphan account linking every 2, analytics refresh every 15, follow-up sweep at 09:00, follow-up dispatch at 09:30, metrics audit at 08:45. **None of them records a run, a success or a failure anywhere an administrator can see.** `publish-scheduled-posts` has no `cron.schedule` in the migrations at all, so its trigger is not in version control | A `job_runs` log, last-success timestamp per job, an alert when a job has not succeeded within its expected window, safe re-execution, and every schedule declared in a migration |

The governing rule: **no clinical workflow fails because an external service is down.** Every one of the above degrades to a usable path.


---

## Part 12. One client, end to end, as an administrator

Abbreviated; the committed document carries the full stage-by-stage table of see, change, cannot change, automatic, work created, access granted, family view, worker view, audit.

The shape: the coordinator never types a status and never picks a next action. They complete work. Completing work moves the case. The clinical lead is the only person who accepts an assessment. Commercial figures are invisible to the assessor and the worker at every stage. The family sees a journey, a schedule, visit summaries and whatever plan view their scope allows, and nothing else. Every stage writes an activity entry naming the actor.

### What today requires a developer, and should not

Verified against the live system. This is the list the whole audit exists to shorten.

1. Change a question, its wording, its options or its order, on any form. **S**
2. Add, rename or retire a language. **C**
3. Correct an LGA spelling or add a missing one. **C**
4. Add or change a service, its client group, its questionnaire section, or its modules. **S**
5. Change a price, a fee or a budget band. **S**
6. Change an SLA, a review interval or a payment term. **S**
7. Add this year's public holidays. **S**
8. Grant or withdraw an assessor capability. **C**
9. Grant family portal access or change a relative's scope. **C**
10. Add an escalation category, a closure reason or a work outcome code. **O**
11. Change non-clinical notification wording. **O**
12. See which form definition a given document was completed against. **O**
13. Resend a link that failed to deliver. **C**
14. Reconcile a payment the webhook missed. **S**
15. Re-run a scheduled job that did not fire. **S**

Everything on that list is operational and belongs in the admin centre. What stays with a release: clinical rules, delegation gates, medication logic, emergency thresholds, permission policy, RLS, the supported field types, and the definition of any work rule.

---

## Part 13. Shared components

One implementation each. Current duplicates named.

| Component | Current state |
|---|---|
| `DateField`, `TimeField`, `DateTimeField` | **Duplicated fourteen times.** Raw `type="date"` in `CareFieldInput.tsx:60`, `WorkPanel.tsx:835,840,851,899`, `DocumentsPanel.tsx:828,872`, `FieldAnswerInput.tsx:285`, `LeavePanel.tsx:125,129`, `LocationStep.tsx:139`, `MatchmakerApply.tsx:256`, `WorkforceStaff.tsx:380,384,663,667,671`, `Workforce.tsx:201`, `MatchmakerMatches.tsx:779,783`, `MatchUniverseVerification.tsx:538`, `MatchUniverseRequest.tsx:210`, `MatchUniverseAvailability.tsx:171,175`, `ApplicationStages.tsx:197`. The one real picker, Popover plus `ui/calendar.tsx`, is used **once**, in `PostEditor.tsx:405`. Consolidate. **C** |
| `PhoneField` | **Duplicated, and they disagree.** `JoinAccount.tsx:369` hardcodes a `+234` prefix and concatenates; `PersonalStep.tsx:32` is a bare `type="tel"` with a placeholder only; `CareFieldInput.tsx:63` is a third bare `type="tel"`. No country-code component, no E.164 helper exists anywhere. Build one, store E.164. **C** |
| `AddressField` | One component, but it lacks structured output and returns 401 for unauthenticated users. Separately, `GoogleMapsLoader.tsx` **has no importers at all** and is dead code. Rebuild around the layering in Part 3 and delete the orphan. **C** |
| `StateLgaField` | A shared `LocationSelect.tsx` exists and its own header comment claims every screen uses it. **It is imported by two files.** Seven others hand-build their own state and LGA controls off the raw data: `FieldAnswerInput.tsx:81`, `CareFieldInput.tsx:266`, `LocationStep.tsx`, `PortalDetails.tsx:153`, `PortalStart.tsx:213`, `Clients.tsx:270`, `HeardSignupForm.tsx:121`. Consolidate on `LocationSelect` and point it at the database. **C** |
| `LanguagePicker` | Mostly good: one component reused in three places. One outlier, `LocationStep.tsx`, hand-rolls its own off a separate `LANGUAGES` constant in `join-application-options.ts`. Fold it in. **O** |
| `VocabularyField` | Absent. One component drives languages, sex, relationships, categories and reason codes. **S** |
| `MoneyField` | Absent. Naira is formatted by hand at every call site, and `HirePanel.tsx:191` and `WorkforceStaff.tsx:482` carry the identical template verbatim. No `formatNaira` helper exists. **S** |
| `PersonPicker`, with assessor and worker variants filtered by capability | **Does not exist in any form.** No person search widget anywhere; every screen works from an already-resolved person passed in by route. This is unbuilt, not duplicated. **S** |
| `SaveState` and `SyncState` indicators | Absent, and reinvented **eleven times** as local `saving` booleans plus toasts, across `PreAssessment`, `PortalPreferences`, `PortalAccount`, `WorkforceStaff`, `PostEditor`, `MatchmakerEditor`, `ContractEditor`, `EnquirySetup`, `EmailTemplates`, `CampaignEditor` and `invoice/EditorTab`. Two independent debounce implementations exist (`PostEditor` and `CampaignEditor`) with no shared `useAutosave`. **C** |
| `ConfirmAmendBlock` | Partially exists as `care_response_amendments` plumbing; needs one shared presentation. **C** |
| `WorkStatus`, `DocumentStatus` | Absent; `MuStatus` is the right base. **S** |
| `ActivityHistory` | Exists inside `ClientRecord`; extract. **O** |
| `FileUpload`, `MediaCapture` | **Duplicated roughly fifteen times.** Every screen hand-wires a hidden `<input type="file">` with its own accept list, size check and `uploading` state. No dropzone, no shared hook, no retry anywhere. **S** |
| `PERMISSION_OPTIONS` | **Duplicated** in `ControlCentre.tsx:19` and `WorkforceStaff.tsx:44`. Extract to one module. **O** |


---

## Part 14. Configuration history

Nothing configurable is ever physically deleted while a record references it.

Stable immutable `code` on every vocabulary term. `version` plus `published_at` on every form definition and document. `effective_from` and `effective_to` on prices, fees, SLAs and review intervals, so an old invoice still explains itself. `is_active` and `retired_at` rather than deletion everywhere. Snapshotting where the value must survive independently: an issued document snapshots the labels it displayed, an invoice line snapshots the rate it charged, a visit snapshots its plan version. And an audit record for every configuration change, naming who, when and what moved.

---

## Part 15. Notifications

Absent as a model today; sending is scattered across edge functions.

```
notification_templates   key, channel, subject, body, admin_editable, is_clinical
notifications            id, event, recipient_kind, recipient_id, channel,
                         template_key, payload, status, sent_at, failed_reason,
                         read_at, dedupe_key
```

One dispatcher, driven by the event map in Part 6. Recipient rules live with the rule, not in a component. Dedupe on `dedupe_key` so a retried job never double-sends. Delivery records, retries, visible failures, read state. Administrators may edit non-clinical wording; clinical and safety notifications are release-controlled and marked as such.

**S**, except emergency alerting, which is **C** and already partly exists through `admin_alerts`.

---

## Part 16. Permissions by action

Page-level permission is not enough. Every consequential action gets a server-enforced rule, with the UI hiding what the server would refuse.

The ones that matter most: only `care_clinical` may accept, return or issue; only `care_coordinator` may assign, schedule, grant portal access or agree a package; only `care_finance` may issue an invoice or allocate fund money; only the assigned assessor may submit their own assessment; only the assigned worker may check in to their own visit; only a coordinator may promote a note from care team to client visibility; only a super admin may change permissions or publish a form definition.

*Verified gap:* `care_coordinator` and `care_clinical` are offered in the permission picker but held by nobody, so commercial data is currently invisible to every non-super admin. **C** to assign them before any care runs.

---

## Part 17. Derived versus stored

**Derived, never stored:** age; next action; overdue; completion of a form or a plan; the active plan version; the active package; the current assignment; visit verification where the events determine it; outstanding required items, already computed by `outstandingRequired`.

**Cached projection, with reconciliation:** `clients.stage`, refreshed on write and reconciled nightly with drift reported.

**Genuinely stored:** everything a human asserted or a document froze.

The test: if two fields can disagree and nothing reconciles them, one of them is a bug. `date_of_birth` and `age_years` are that bug today.

---

## Part 18. Self-sufficiency

After the **C** and **S** work below, operations and clinical teams could, unaided for six months: run the whole client journey; manage contacts, packages, assignments, rosters and portal access; edit every question on every form and publish new versions; manage languages, geography, services, prices, SLAs, holidays, categories and reason codes; grant and withdraw capabilities and permissions; issue invoices and reconcile payments; resend links; and re-run jobs.

They could not, and should not: change clinical rules, delegation gates, medication logic or emergency thresholds; change RLS or permission policy; add a new field type or a new work-item kind; or alter audit behaviour. Each of those is either safety-critical or structural, and each has a real review cost that is the point rather than a nuisance.

---

## Part 19. What changes in the architecture document

1. Section 0: age, stage, next action and overdue named explicitly as derived.
2. New section: controlled vocabularies, stable codes, and the geography layering.
3. New section: the shared field component library, with the date and phone consolidation named.
4. New section: save and sync states, the seven-state vocabulary, IndexedDB scope and expiry.
5. New section: the notification model.
6. Work engine section expanded with ownership, dedupe, working hours, dependencies, outcomes and chained creation.
7. Event map from Part 6 folded in at full length.
8. Permission section restated as actions rather than pages.
9. Admin management matrix from Part 5 added as an appendix.
10. An explicit "outside admin control" appendix.

**Database changes:** `vocabularies`, `vocabulary_terms`, `working_hours`, `public_holidays`, `configuration_settings` with effective dates, `notification_templates`, `notifications`, `job_runs`, plus `date_of_birth_is_estimated` on `clients` and the backfill of `age_years` into `date_of_birth` where possible. All additive.

**Code changes:** the shared field library; `deriveCareStage`; `outstandingWork`; `care-rules.ts`; the IndexedDB layer and sync queue; the vocabulary resolver; the notification dispatcher; a token-authenticated address path; and the removal of the free stage dropdown and the age input.

---

## Part 20. Proposed order

**Critical before real care.** Derived stage and the removal of the free dropdown. Age from date of birth. Languages and geography into the database with stable codes. The shared date and phone components. The public address fix and its fallback. Save and sync states on the pre-assessment. Assessor capability grants and family scope management. Assign `care_coordinator` and `care_clinical` to real people. Emergency alerting.

**Required before scale.** The Form Library. Services, pricing, SLAs, review intervals and holidays as governed configuration. The full offline layer for assessor and worker. The notification model. Payment reconciliation and job run visibility. Money, person and vocabulary components.

**Operational improvement.** Reason-code vocabularies, notification wording, activity extraction, the permission-options consolidation, the definition viewer.

**Later.** Cross-client family switching, richer reporting, outcome analytics.

---

## Part 21. What I will commit on approval

Three files, and nothing else. No product code, no schema, no screens in this step.

1. **`docs/care-platform/logic-review.md`** — this review in full, with Parts 6 and 12 expanded to their complete tables rather than the abbreviated versions above.
2. **`docs/care-platform/architecture.md`** — the agreed architecture, Revision 3, with the twenty changes in Part 19 folded in.

   One thing to flag honestly before you approve. The architecture document has only ever existed inside the plan file, and writing this review over that file replaced it. Nothing on disk holds it now. So this step is a rebuild: I will recover Revision 3 from our conversation history, which holds it in full, including the ten structural corrections and the four sign-off corrections you made after them, and write it out as a permanent document with the Part 19 changes folded in. That is why it belongs in `docs/` rather than the plan file, which is transient by design. Nothing is lost, but this is a reconstruction rather than a copy, so read the committed version once before treating it as signed off.
3. **`roadmap.md`** — the ordered task list from Part 20, grouped as Critical, Required before scale, Operational and Later, with the existing completed candidate-portal entries left in place.

I will not start any of the Critical work in the same step. You get the three documents to read first, and we begin building only when you say so.

