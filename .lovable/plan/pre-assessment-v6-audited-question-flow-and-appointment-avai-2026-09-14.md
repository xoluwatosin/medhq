# Pre-assessment v6: audited question flow and appointment availability

## Scope and safeguards

Rebuild the pre-assessment only. Keep every v5 definition, submitted answer and in-progress v5 document pinned to v5, including Munachim’s submission. Do not change the Clinical Assessor form, assessment decision-making, Care lifecycle, permissions, T8, packages, matching, staffing, roster, visits, monitoring, medicines administration, worker/family portals, finance or Paystack.

The current catalogue has 26 sections, 217 fields, 62 conditional fields and 67 free-text/repeatable fields. The implementation will ship an audit manifest listing every v5 field ID, its v6 field ID, and one disposition: kept, moved, grouped, replaced or retired. No field may disappear without that record and a compatibility read-back rule.

## 0. Restore card consistency before changing the form

- Remove phone-only bottom-sheet positioning, corner and spacing overrides from standard dialogs and alerts. Standard cards and pop-ups will keep the same centred composition, border, radius, shadow, header and close control at 430px and 1440px; only available width, height and safe-area spacing may change.
- Keep genuine navigation sheets and drawers as sheets.
- Keep the Request care navy-cap card composition identical across phone and desktop.
- Verify representative public, Care and Admin cards/pop-ups side by side before starting v6.

## 1. Publish an immutable v6 and complete coordinated sessions

- Generate and publish a new immutable v6 definition. Existing v5 documents will neither migrate nor be repointed.
- Complete the existing request-wide questionnaire session integration: one request can include several care recipients, the respondent can switch recipients, recipient answers remain separated, and request-wide answers are asked once.
- Save and resume the active recipient, section and page. A branch opening or closing must resolve to a valid nearby page without losing answers.
- Preserve answers from a branch that later closes, but identify them in the audit/read-back model instead of silently presenting them as current answers. Reopening the branch restores them.
- Keep person identity based on immutable Care person IDs. Email and phone remain contact/matching signals only; no automatic person merge or family access grant will be added.

## 1a. Establish who and what before any questions

A short intake runs before the questionnaire. Each step is one screen with one decision, and each branch is stated so it can be tested exactly. Names are captured as first name and last name in separate fields.

### Step 1. Your details

First name, last name, phone and email. Email is required, as it is throughout the care-request journey.

### Step 2. Who is this request for?

Options: Myself, One other person, Several people.

- Myself: the enquirer is recorded as the care recipient. Go to step 4.
- One other person: step 3 once, then step 4.
- Several people: step 2a.

### Step 2a. Are you also receiving care?

Yes or No. Yes records the enquirer as a care recipient without repeating their name.

### Step 3. Care recipient details

For each care recipient, on one screen:

- First name
- Last name
- Relationship to you, from the governed relationship list. Not asked when the recipient is the enquirer.
- Date of birth, or approximate age when the date is not known
- Which support is required for this person, from the service list
- Contact details, requested only where the recipient is an adult who may be contacted directly, and recorded as optional

Then Add another care recipient, or Continue.

Rules:

- At least one care recipient is required.
- Each care recipient must have at least one service selected.
- Each care recipient is recorded as a distinct Care person and request recipient. No person is merged with another automatically.
- Each recipient's own date of birth or approximate age sets their age band, so recipients on one request are routed independently.
- Where a selected service cannot apply to that recipient's age band, the conflict is shown on the same screen and resolved by the respondent. No service is reassigned automatically.
- A service selected for more than one recipient is recorded as shared. There is no separate step asking who each service is for.

### Step 4. Service-driven care recipients

Where a service implies further people, they are added as named care recipients within that service, not through a generic count:

- Postnatal care and Omugwo (mother): further asks whether newborn care is also required.
- Newborn care: how many babies, then first name, last name and date of birth for each. Each baby is recorded as a care recipient.
- Nanny and childcare: how many children, then first name, last name and date of birth for each. Each child is recorded as a care recipient.
- Paediatric care and Children with additional needs: recorded against a named child, reusing a child already added rather than asking again.

### Service list

Services are listed independently so routing is exact, replacing the current grouped options:

- Antenatal care at home
- Postnatal care and Omugwo (mother)
- Newborn care
- Paediatric care
- Children with additional needs
- Nanny and childcare
- Post-surgical care at home
- Eldercare and companion care
- Clinical home care
- Another service, or not yet decided

### Step 5. Confirm

A summary of each care recipient and their services, with Edit on each entry, before the questionnaire begins.

### How the questionnaire then runs

- Request-wide, asked once: address and area, household, enquirer contact, assessment appointment availability and consent.
- Recipient-wide, asked once per care recipient: identity confirmation, authority where another person is arranging care, health, conditions, medicines, allergies and mobility.
- Service-specific, asked once per recipient-and-service pair: only the sections that service opens, plus the clinical modules its answers trigger.

No question is repeated for one recipient who has two services. A progress map lists each care recipient with their services and states of Complete, In progress and Not started, and allows switching between them. Answers, clinical flags and uploads are held against a single recipient and never cross.

This writes only through the request, recipient and service-intention records already built for the Admin console, including the shared-service flag. No new identity, grouping or lifecycle model is introduced.


## 2. Replace section-first paging with deterministic answer rounds


The current engine clusters dependencies only inside one section, which is why late modules can be detached from their trigger. V6 will use explicit flow groups spanning sections while retaining deterministic catalogue conditions.

Each round will contain one decision or one coherent answer task:

1. Show the trigger.
2. Reveal its follow-up immediately after the answer, on the same screen when short or the next screen when structured.
3. Confirm completion with a small progress transition and advance to the next relevant round.
4. Never award points, streaks or clinical “scores”. The game-like quality will come from short rounds, a visible journey map, immediate reveal, clear completion states and tap-first controls.

Numbered navigation will show completed, current and available stages. Hidden branches will not leave empty stages. Back, review, autosave and resume remain available.

## 3. Exact catalogue regrouping

### Identity, service and authority

- `who_for` gains a third option for several people and feeds the intake above. Recipient details are captured per person.
- Per recipient, group `recipient_first_name`, `recipient_last_name`, `respondent_relationship` and the service selection in one recipient screen. `recipient_middle_name` and `recipient_preferred_name` move to optional details on the same screen.
- Group `dob_known` with exactly one immediate follow-up, `date_of_birth` or `approx_age`, per recipient.
- `service_requested` becomes a per-recipient multi-select over the expanded independent service list. `service_confirmed` is asked only where a selected service cannot apply to that recipient, and is never resolved automatically.
- Keep `decisions_adult` in two rounds: knowledge/feeling (`recipient_knows`, `recipient_feeling`, `recipient_feeling_note`) and authority (`decision_authority`, `decision_authority_other`).
- Group child guardian fields into one structured contact: `is_parent_guardian` then first name, last name, relationship, phone and optional email when No. Remove the no-op condition on `child_feeling`; ask it only when `child_knows_visit` makes it relevant.

### Situation, safety and communication

- Ask `immediate_danger` first and show the existing emergency stop message immediately when Yes.
- Keep `situation` and `urgency` together as the request summary.
- Keep `languages`; group `communication_support` with `communication_detail`, shown only when selected support needs detail.

### Health

- `diagnosed_conditions` → immediate structured `condition_details` when Yes.
- `hospital_recent` → one grouped hospital episode using `hospital_name`, `admission_date`, `discharge_status`, the applicable discharge date and optional `discharge_letter`.
- `professional_involved` → immediate structured `professional_details` when Yes.
- `regular_medicines` → immediate structured medicine list when Yes. Move `md_list` here and retire the duplicate nanny free-text `nn_medicines_detail`.
- `allergies` → immediate `allergy_details` when Yes.
- Keep medicines and allergies as separate rounds so one does not delay the other.

### Existing support and contacts

- Show only one of `support_now` or `childcare_now` according to service, followed immediately by `support_detail` when support exists.
- Replace `alt_contact_first_name`, `alt_contact_last_name`, `alt_contact_relationship` and `alt_contact_phone` with one optional grouped contact control: first name, last name, relationship, phone and optional email.
- The primary care-request email remains required. Only this additional contact’s email is optional.

### Ongoing care schedule and assessment appointment availability

These remain two separate answers, as confirmed:

- **Ongoing care schedule:** replace independent `care_days` and `care_times` with a weekly-pattern control. Select weekdays, then set morning, afternoon, evening, overnight or live-in for each selected day. “Apply to selected days” avoids repeating the same answer. Keep `start_when` with immediate `start_date` when specific, and keep `duration` in this round.
- **Assessment appointment availability:** replace the three unrelated date inputs in `visit_preferences` with a bounded candidate-style selector. The respondent first selects suitable weekdays. The form generates the next six matching dates per selected weekday within a six-week horizon, starting tomorrow and using `en-GB` local dates. Selecting a date opens only valid daytime periods: Morning 08:00–12:00, Afternoon 12:00–16:00, Evening 16:00–19:00. The respondent then picks an exact start time in 30-minute steps inside that period. They submit up to three ranked date/time preferences.
- Keep `visit_address`, `visit_lga` and `visit_landmark` as one location control, followed by `visit_attendees`.
- Appointment preferences remain preferences. Admin still chooses and books the authoritative appointment; this will not write to or reuse candidate availability tables.

### Service-specific sections

- **Antenatal:** group due date/weeks/multiple; clinician/details; high-risk/reason/concerns; previous pregnancies/births/complications; support wanted/home support.
- **Postnatal mother:** group delivery facts/complications; recovery/warning signs; feeding/help; support/home support.
- **Postnatal baby:** group identity/birth facts; special care/readmission; jaundice/treatment; feeding/output; warning signs/checks.
- **Post-surgical:** group procedure/date/hospital/location/documents/follow-up; use one wound round by moving `wd_sites`, `wd_dressing`, `wd_signs` here and retiring duplicate `ps_wound_detail`; use one device round sourced from `dv_items` and retire duplicate `ps_devices`; then pain, mobility/help, warnings and household support.
- **Eldercare:** group support/independence; memory/change; eating/continence; overnight; living situation/routine/safety/goals. Structured choices precede optional narrative.
- **Clinical home care:** group requested care/prescriber/instructions/frequency; monitoring; escalation plan/detail; current warning signs. Trigger wound, device, respiratory, nutrition and palliative groups immediately after the selection that opened them.
- **Nanny:** keep structured child records, health, feeding, sleep, toileting, language, activities and safety together per child. Medicines use the central medicine control rather than nanny free text. Keep role pattern/duties/collection/experience/household/priorities as a separate role round.
- **Additional needs:** group diagnosis/professionals; communication/understanding; mobility/personal care; eating/swallowing; seizures; equipment; sensory/distress/support strategies; plans/school/safety; strengths/goals. Trigger shared mobility, device and nutrition follow-ups immediately and remove duplicate capture.
- Reuse the central `professional_details` entries in the additional-needs route instead of asking `ad_professionals` for the same professionals again. Allow additional entries there without duplicating already entered people.
- **Other/not sure:** keep `ot_what`, `ot_who`, concern/detail and callback in one concise route.
- **Consent:** keep the three existing acknowledgements on one final screen and preserve server-side submission checks.

Routing and alerts will be based on discrete answers, not on whether somebody typed into a narrative box. In particular, replace the current always-raised `ad_seizure_detail` route with structured seizure recency/frequency and whether a current professional plan exists; keep the narrative description as context. Apply the same rule to high-risk pregnancy, birth complications, wounds, memory changes, missed/time-critical medicines and falls: the existing Yes/No or structured severity answer raises the alert, while free text explains it.

## 4. Structured medicines and linked follow-ups

For every reported medicine collect, without suggesting or prescribing values:

- medicine from the governed list or a separate “not listed” entry;
- strength value and unit exactly as reported from the pack;
- dose amount and adjustable unit;
- route: by mouth, injection, inhaled, topical, eye, ear, feeding tube or other;
- schedule using frequency chips plus reported times when known;
- reason, where known.

Keep `md_manager`, `md_help`, `md_missed` and `md_missed_detail` directly after the medicine list. Replace `md_critical_detail` with a multi-select sourced only from medicines already entered. Add a separate refrigerated-medicine Yes/No question with the same linked selection pattern. Store stable local medicine entry IDs plus snapshot labels. Client and server will reject linked IDs not present in that recipient’s medicine answer. No clinical dose, schedule or medicine identity will be inferred.

## 5. Reduce avoidable typing

- Replace appropriate narrative fields with grouped structured controls while retaining “Something else” text: hospital/treating team, follow-up appointment, wound site and dressing, device instructions, feeding regime, escalation contact and professional details.
- Preserve narrative where personal context matters: `situation`, routines, goals, distress triggers, what helps, family priorities and palliative wishes.
- Use tap-first Yes/No, multi-select chips, matrices, dates, time chips and repeatable person/medicine rows. Do not convert nuanced clinical or legal answers into lossy choices.
- Use respondent-aware `{subject}` grammar everywhere. Self-answering copy says “you/your”; third-party copy uses the recipient’s preferred name. Remove authored `{child}` from generic self-capable questions and remove the inconsistent `{Subject}` option token.

## 6. Soft-surface form presentation

- Replace the current Candidate Portal shell with the approved uploaded Request care composition: navy cap, warm paper and soft-blue surfaces, symmetric soft corners, restrained navy-tinted shadow and clear selected states.
- Use one stable scroll region, safe-area spacing, full-width phone actions and no horizontal overflow.
- Grouped controls are unframed sections within the main card, not cards nested inside cards.
- Show a concise completion summary before advancing, such as selected dates/times or medicines entered, with Edit available.
- On review, list unanswered required questions by section with direct links back to them. Preserve the current non-blocking distinction for ordinary required questions; only existing consent/blocking rules prevent submission.

## Technical implementation

- Add v6 catalogue source/builder and `docs/care/pre-assessment-v6-audit.md`, containing one row for each of the 217 v5 IDs and the exact v6 disposition.
- Extend shared definition types for cross-section flow groups, grouped contacts, weekly care patterns, generated appointment slots and previous-answer options.
- Resolve `optionsFrom` in the browser and validate it on the server; it is currently accepted by the schema but not resolved by the page.
- Extend browser and server validation in lockstep for medicine units/routes/schedules, grouped contacts, weekly patterns and appointment date/time linkage.
- Wire the existing questionnaire-session and recipient records through load/save/submit. The audited session tables already hold request, recipient and position data, so no new Care identity or lifecycle tables are planned. Publish the v6 definition as data, not as a schema migration.
- Preserve v5 read-back. Add v6 read-back for grouped controls and exact appointment preferences.

## Audit and acceptance

- **Catalogue:** every v5 ID appears once in the disposition manifest; unique v6 IDs; valid tokens/conditions/options; no orphan required fields, no no-op conditions, no separated cross-section follow-ups and no duplicate wound/device/medicine capture.
- **Flow:** tests for all service routes, self/other voice, adult/child authority, immediate medicine/allergy branches, module triggers, hidden branch cleanup, recipient switching, stable resume and review.
- **Several people and services:** tests for one person with two services, two people with one shared service, two people with different services, a child added inside postnatal or nanny care, and an enquirer who is also a recipient. Prove request-wide questions are asked once, person questions once per person, service questions once per person-and-service pair, and that answers, alerts and readiness stay attributed to the right person in Admin.
- **Routing:** prove narrative text alone cannot create or suppress a clinical alert; test seizure, pregnancy, birth, wound, memory, medicine and fall alert inputs explicitly.
- **Availability:** deterministic date generation across month/year boundaries; selected weekdays only; tomorrow minimum; six-week horizon; period-to-time enforcement; unique ranked slots; up to three choices; ongoing care schedule kept separate.
- **Validation:** browser/server parity; reject malformed contacts, medicine structures, forged medicine references, dates outside generated weekdays/horizon, times outside selected periods and cross-recipient answer writes.
- **Compatibility:** prove v5 submissions remain pinned, readable and unchanged.
- **Visual:** populated 430×786 and 1440×900 walkthroughs covering cards/pop-ups, every structured control, branching, several recipients, autosave, resume and review; no overflow, overlap or phone-only distortion.
- **Quality:** typecheck, full tests, preview build, runtime/console/network logs and accessibility checks for keyboard, focus, labels and reduced motion.

## Completion boundary

This pass completes the audited pre-assessment v6 and the shared multi-recipient questionnaire flow. The Clinical Assessor form remains unchanged and will receive its own audit before any rebuild.
