# Pre-assessment correction: one coherent journey

The published pre-assessment (version 2) shows every section it holds, decides
the pathway from the service recorded on the enquiry rather than from what the
family answers, and writes about the person in the third person even when they
are answering for themselves. This pass rewrites the questionnaire as a routed
journey and corrects the engine underneath it. Nothing outside the
pre-assessment is touched.

## What changes for the person answering

1. **Routing first.** Who is the care for (myself / someone else), the
   recipient's name in separate boxes, preferred name, date of birth on a
   calendar (approximate age offered only if the date is unknown), and the
   care being asked for. Age and answers decide the pathway, not a value
   recorded before the form was opened.
2. **Correct wording.** Answering for yourself reads "Do you take any regular
   medicines?". Answering for someone else uses their name, or "the person
   receiving care" when no name is given. Postnatal questions say plainly
   whether they are about the mother, the baby, or both.
3. **Only relevant questions.** A 50-year-old arranging clinical home care for
   themselves never sees nanny, school, pregnancy or newborn questions. The
   nanny question splits into a childcare version and a home-care version.
4. **Progressive disclosure.** Hospital details only after a hospital answer,
   medicine details only when medicines are taken, allergy details only after
   "Yes", and so on.
5. **Honest progress.** Progress and any time estimate count only the
   questions that currently apply.
6. If the recorded service and the answers disagree (for example nanny care
   with an adult recipient), one short clarification question is asked rather
   than guessing.

## Question set

Your uploaded specification (MC-FRM-07 replacement) is the authoritative source
for questions, order, controls, branching, wording and safety behaviour. It is
saved into the repository as `docs/care/pre-assessment-spec.md`, and the
researched catalogue already present (`docs/care/pre-assessment-v2.json`)
supplies question wording where the specification reuses it. A new version 3
definition is authored to match the specification, with:

- the opening route: R1 who the care is for, R2A/R2B identity, R3 date of birth
  and age, R4 decision and consent context (hidden for a competent adult
  answering for themselves), R5 confirm the type of care with the
  contradiction question where the recorded service disagrees
- age bands exactly as specified: newborn under 28 days, infant to under 2,
  child to under 18, adult to under 65, older person 65 and over; an older age
  alone never implies frailty or need
- a trimmed universal core (identity, contact, language, reason, diagnoses,
  recent hospital, medicines, allergies, professionals involved, address and
  visit arrangements, timing, consent)
- service modules: antenatal; postnatal and Omugwo (maternal and baby kept
  apart); post-surgical; eldercare and companion care; clinical home care;
  nanny and childcare; children with additional needs; something else
- risk modules: medicines; mobility, falls and home access; plus the
  clinical sub-modules the specification triggers (wound, device, respiratory,
  nutrition, palliative) shown only when the matching clinical need is chosen
- a final review of applicable answers only, section-by-section editing, and
  the three consent statements (accuracy, use of information, and authority
  when answering for someone else)

Questions that belong to the clinician's full assessment are dropped from
pre-assessment rather than moved anywhere else.

Safety answers are classed as the specification sets out: emergency concern
(shows an instruction to contact emergency services, with Medic Connect stated
not to be an emergency service), prompt clinical review (flagged internally,
no diagnosis told to the respondent), or ordinary assessment information.
Classification is derived on the server as well as shown on screen, and only
the event class ever reaches analytics.

## Technical section

### Condition grammar (client, edge, database — same rules three times)

- `sectionApplies` currently returns on the first condition key it finds, so a
  section declaring both `clientGroup` and `service` is only filtered by one.
  Fix: evaluate every declared key as AND, plus explicit `allOf`, `anyOf`,
  `not`/`notWhen` composition and the existing `in`/`notIn`/`contains`/`empty`/
  `gte` tests.
- Routing facts are derived, not loaded: `recipient_is_self`, `age_years`,
  `age_band`, `recipient_group`, `service_requested`, computed from the answers
  by one shared function and exposed to conditions as ordinary read-only keys
  (underscore ids, no dot separators). The client service/group stays only as a
  prefill and as the trigger for the reconciliation question.
- Respondent copy: `asked`, `record` and helper text carry tokens
  (`{you}`, `{your}`, `{recipient}`, `{child}`, `{subject}`) resolved by one
  central resolver used by the renderer and by record read-back, so no string is
  duplicated in two voices.
- Mirrored in `src/lib/care.ts`, `src/lib/care-schema.ts` (validation of the new
  grammar), `supabase/functions/_shared/care-form.ts`, and in SQL
  (`private.care_condition_met`, `care_sections_for`, `care_definition_issues`).

### Files and migrations

- `docs/care/pre-assessment-spec.md` — the uploaded specification, stored as the
  governing reference.
- `docs/care/pre-assessment-v3.json` — new definition (authored, validated).
- `drizzle/migrations/0054_care_condition_grammar_v2.sql` — composed condition
  operators, derived-fact evaluation, updated definition validation.
- `drizzle/migrations/0055_care_pre_assessment_v3.sql` — insert the v3
  definition as published; version 2 becomes retired. No published definition is
  edited in place, no submitted document is touched.
- `src/lib/care.ts`, `src/lib/care-schema.ts`, new `src/lib/care-copy.ts`.
- `src/pages/PreAssessment.tsx` — applicable-only progress, immediate
  recomputation, unchanged acknowledged autosave.
- `src/components/care/CareFieldInput.tsx` / `CareAnswerControls.tsx` — control
  standards (separate name boxes, calendar, yes/no buttons, structured
  measurement, "Other" reveal).
- `supabase/functions/care-form-load/index.ts`,
  `supabase/functions/care-form-save/index.ts`.

### Versioning and existing data

- Two pre-assessment drafts and one submitted pre-assessment exist today. Load
  and save pin to the document's own `form_definition_id`, so those drafts stay
  on version 2 and finish as they started; only new drafts open on version 3.
- The submitted record keeps reading against version 2. No real response row is
  migrated or mutated.

### Server enforcement

Save and submit recompute applicability server-side from the merged answers.
Documented contract: answers to questions that do not apply are **ignored** —
stripped from the stored responses, never counted for required, flags, modules
or submission, and recorded in the access log as discarded. A direct API call
cannot smuggle a hidden answer in as clinical evidence.

### Tests

Vitest journey tests (self/50/clinical home care; self/75/eldercare; someone
else/adult/post-surgical; child/nanny; child/additional needs; antenatal;
postnatal mother and baby; something else), plus upstream-answer change,
DOB boundaries, unknown DOB, incompatible service/recipient, composed AND/OR,
duplicate ids, controlled option keys, required behaviour, copy resolution.
A rollback-safe SQL test (`supabase/tests/care_pre_assessment_v3.sql`) checks
the SQL condition engine agrees with the TypeScript one and that hidden answers
are rejected server-side. Typecheck, full Vitest, build, and 320/390px browser
checks of the routed journey.

### Out of scope

Professional assessment, clinical review, care plan, packages, staffing,
roster, invoicing, T8, Admin navigation, Talent and Workforce.
