# Pre-assessment: publish version 6 and finish the new look

## What the audit found

The question set is built from source files (`scripts/pre-assessment/`) into a JSON file, then loaded into the database as an immutable version. The live form reads whichever version is marked published. That is still version 5, so every link still serves the old question set. This is the single reason the form looks unchanged.

Confirmed, item by item:

- The live version is 5. No version 6 exists anywhere except as intent.
- The duplicated opening questions are already suppressed in the page code, so that part is handled. Everything else in the question set is not.
- "Do you take regular medicines?" sits in the health section; the medicine list, who manages them, missed doses and time-critical medicines sit in a separate later section. Answering yes therefore leads nowhere until much later.
- Time-critical and refrigerated follow-ups are free text, not a choice from the medicines already entered.
- Medicines already accept a dose and a frequency, but as loose text rather than an adjustable amount, unit and frequency.
- The alternative contact is already grouped (first name, last name, relationship, phone, email). No change needed.
- Respondent-aware wording already exists in the question source ("Do you..." versus the person's name). It is correct in v5 and carries to v6.
- The opening intake still offers "One other person". It should read "Another person".
- The pre-assessment pages still use the candidate-portal card components, not the Request care surface.

## Why the previous pass did not land, and what changes

The previous pass changed code but never published a new version, and the live form is driven by the published version, not by the code. Publishing is the switchover. This plan therefore treats publication and on-screen evidence as the definition of done, not the code edit.

## The work

### 1. Version 6 of the question set

Version 5 is left untouched and retired, so anything already submitted still reads back exactly as it was answered.

Changes in version 6:
- The medicine questions move to sit immediately after "Do you take regular medicines?" — list, dose, who manages them, missed doses, time-critical.
- Allergy detail stays immediately after the allergy question.
- Each medicine is entered as a name plus an adjustable amount, unit and frequency. Nothing is ever suggested or pre-filled by the system.
- Time-critical and refrigerated follow-ups become a selection from the medicines already entered.
- Shared questions (address, dates, visit preferences, consent) stay request-wide; person-specific questions repeat per person.

### 2. The opening intake

"One other person" becomes "Another person".

### 3. The look

The pre-assessment moves onto the same surface as the Request care form: warm-white shell, navy cap, segmented progress, one question at a time, soft choice rows, full-width primary action, safe touch targets on a phone. The numbered section rail and the section covers stay, restyled to match.

### 4. Conditional questions appear immediately

A follow-up appears on the same screen the moment its trigger is answered. The grouping engine already does this within a section; moving the medicine questions next to their trigger removes the remaining case where it fails.

Routing stays deterministic. No AI chooses or orders clinical questions.

## Contingency

- **The database refuses to publish version 6.** A guard rejects any definition with a broken condition or a missing classification. The build is validated against the same rules before publishing, so a rejection is caught at build time. If it still fails, version 5 stays published and the form keeps working; nothing is half-switched.
- **A form is already part-answered on version 5.** Part-answered forms are pinned to the version they started on, so they continue on version 5 untouched. Only new links get version 6.
- **A version 5 answer has no version 6 equivalent.** Question identifiers are preserved wherever the question survives, so office records and the assessment read back unchanged. Anything renamed is listed explicitly before publishing.
- **The new look breaks a control on a phone.** The visual layer is separated from the question logic, so the surface can be reverted without touching the published question set.
- **The temporary test link created earlier** is revoked once the walkthrough screenshots are taken.

## How each item is confirmed before I come back to you

Nothing is reported as done on the strength of an edit. Each item has a check that either passes or is reported as outstanding:

1. Build the version 6 file and validate it against the engine's own rules — must report zero problems.
2. Publish it and read the database back — must show version 6 published, version 5 retired, and the expected section and question counts.
3. Open a real link in a browser at phone width and walk it end to end — screenshots of the medicine follow-up appearing immediately, the time-critical selector listing the entered medicines, "Another person" in the opening intake, and the new surface.
4. Walk the same link on desktop.
5. Run the full test suite, the type check and the production build.
6. Confirm the deployed functions serve the published version.
7. Report anything that did not pass, named, rather than describing the pass as complete.

## Technical notes

- New `scripts/pre-assessment/build-v6.mjs` reusing the existing kit, route, services and modules sources; medicine questions relocated into the health section, `md_critical_detail` retyped as a selection sourced from `md_list`, medicine entries given amount/unit/frequency parts.
- Publication via the existing definition upsert path; `care-form-load` already picks the published version, so no function change is needed for the switchover, and in-progress documents stay pinned by `form_definition_id`.
- `PreAssessment.tsx` moves off `CxJoinShell`/`CxCard`/`CxButton` onto a page variant of `src/components/request/RequestShell.tsx`, shared so the two forms cannot drift.
- `CareFieldInput` and `CareClinicalControls` restyled to the same choice rows and field styles; a medicine control with amount, unit and frequency, and a picker for the critical and refrigerated follow-ups.
- Server validation mirrors the browser rules for the new medicine structure.
- `CareIntakeSteps.tsx` label change for "Another person".

## Not in this pass

Professional assessment version 3, the Clinical Assessor UI rebuild, T8, packages, staffing, roster, visits, monitoring, medication administration, worker portal, full family portal, invoicing and Paystack.
