# The Care questionnaire engine

Revision 1. Governs how Medic Connect Care asks questions, freezes what was
asked, and reads a record back exactly as it was written.

A questionnaire is data, never code. Nothing in this document publishes
clinical content: the 184-question catalogue is authored separately and
published as a form definition once the engine below is proven.

## One definition, one version, one frozen record

A question set lives in `form_definitions` as `kind` plus `version` plus
`definition`. Publishing is one way: a published version is never edited.

Every clinical document in `care_documents` names the `form_definition_id` it
was written against, so the record can always be re-rendered from the exact
question set the author saw. On a sent document these fields cannot change:
responses, client, kind, form definition, version, both authorship columns,
built-from, supersedes, reissue reason, content hash, submitted time,
outstanding required answers, the visit it belongs to, and the modules it was
written against.

## Modules

A definition declares `moduleRules`. A module opens when the client's service
always carries it, or when any stated condition matches an answer. Resolution
is deterministic and alphabetically ordered, and it is implemented twice from
the same rules:

- in the browser, `resolveModules` in `src/lib/care-schema.ts`;
- in the database, `private.care_resolve_modules(client, definition)`.

The resolved list is frozen onto the assessment document when the visit is
started, so a rule published later can never change what a past assessment was
asked. A record is re-rendered through `sectionsForModules`, which shows the
core sections plus only the modules that were frozen on.

## Validation before publication

`validateDefinition` accepts a definition only when it is valid in full.
It reports every problem with the exact path it was found at, and rejects:

- a missing or repeated section or question identifier;
- a control the engine cannot draw;
- a choice, multi-select, budget band or matrix with no list to pick from;
- a repeated option value, or an option with no words to read;
- a measurement with no fixed unit, a repeatable item with no parts, a matrix
  with no rows;
- an escalation naming an answer the question cannot give, or reaching nobody;
- any condition, on a field, on a section or in a module rule, that names a
  question the definition does not hold;
- a module rule no section attaches to, and a section module no rule opens.

`src/lib/care-schema.fixture.ts` holds an invented question set used only by
the tests. It is never loaded by the application.

## Controls

Alongside the family controls, the engine draws the professional ones:

| Control | Stored as | Notes |
| --- | --- | --- |
| `yes_no` | `"yes"` or `"no"` | Two buttons, no dropdown |
| `measurement` | object keyed by measure | Always read back with its fixed unit |
| `repeatable` | array of entries | Each entry validated on its own |
| `matrix` | object keyed by activity | One level of support per activity |
| `weekly_pattern` | object keyed by day | Days over seven rows |

Dates are entered on a calendar or typed; day, month and year dropdowns are
never used. A person's name is asked in separate boxes, never as one box.

Each question may declare its audience: `client`, `internal` or `restricted`.
The audience travels with the answer into the record renderer, so a restricted
answer is always labelled as one.

## Offline capture

The assessor workspace writes one append-only event per answer, held in
IndexedDB with complete provenance (professional, visit, client, document) and
a per-device sequence. The new controls change nothing here: a control's value
is a single value for a single question, whatever its shape.

## Reading a record back

`care_assessment_record(work_id)` returns the assessment document bound to that
visit through `care_documents.assessment_work_id`, never merely the latest
assessment for the client. Repeat assessments on one person cannot cross over,
and a historical review always shows its own sent version.

The response carries the assessment's own definition and version, the frozen
modules, the carried pre-assessment answers with their own definition and
version, the clinical flags and the outstanding required answers. The renderer
keeps four things apart: carried family evidence with the assessor's decision
to confirm or amend, the assessor's own clinical questions and answers, the
assessor's account and section notes, and provenance.

## Routing the pre-assessment (version 3)

The pre-assessment routes on the answers, never on what was recorded on the
enquiry. Three facts are worked out on every keystroke, in the browser
(`src/lib/care.ts`), in the edge functions (`supabase/functions/_shared/care-form.ts`)
and in the database (`private.care_derived_facts`), the same way in all three:
who the care is for, how old they are, and which service is being asked for.

They are read like any other answer, under reserved identifiers that a
definition may not author: `derived_is_self`, `derived_age_years`,
`derived_age_band`, `derived_recipient_group`, `derived_service`,
`derived_is_parent`, `derived_service_conflict`. Nothing derived is ever
written to a record.

Age bands: newborn under 28 days, infant under 2, child under 18, adult under
65, older person from 65. A date of birth decides it; an approximate age is
used only where the date is not known.

Where the service asked for cannot belong to this person, or disagrees with the
service recorded on the enquiry, `derived_service_conflict` is raised and the
person is asked to settle it. Nothing is chosen for them.

A condition may now join other conditions with `allOf`, `anyOf` and `not`, and
every test written on one condition has to hold. A section naming both a group
and a service is filtered by both.

Wording is written once, with tokens (`{subject}`, `{possessive}`, `{do}`,
`{child}` and the rest), and resolved by `src/lib/care-copy.ts` into the voice
the answers belong in. A person answering for themselves is addressed as "you".

A form that has been started keeps the questions it was started on: the loader
and saver pin to the document's own `form_definition_id`. Only a form that has
not been started picks up the current published version.
