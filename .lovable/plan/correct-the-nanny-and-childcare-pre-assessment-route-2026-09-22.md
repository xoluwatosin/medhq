# Correct the nanny and childcare pre-assessment route

## Outcome
Create and publish the next immutable pre-assessment version, leaving completed and already-started forms on their existing question set.

The corrected nanny route will ask each fact once at the appropriate level and will only request school collection information when **School run** is selected.

## Questionnaire changes

### 1. School-run branch
- Change the school-setting trigger from `School run OR Homework support OR Outings` to **School run only**.
- Only after School run is selected, ask whether the child attends a nursery, school or other setting.
- Only after that answer is Yes, show the setting type, name, area, attendance days, start and finish times, term pattern and authorised collection contacts.
- Keep hidden-answer pruning, so removing School run also removes answers that no longer belong to the visible route.

### 2. Schedule, accommodation and overnight care
Keep both levels, but give each one a distinct purpose:
- The standard schedule question records **when support is needed**: mornings, afternoons, evenings and overnight.
- Remove Live-in from that time-of-day list because it is an accommodation arrangement, not a time.
- The nanny role question records **whether the nanny lives in the home**: Live-in, Live-out or No preference. Reword it accordingly.
- The nanny overnight follow-up records the nanny's **overnight responsibility**, rather than repeating whether care occurs overnight. Show it when Overnight is selected in the standard schedule, then ask which nights.

### 3. Child duties and role-wide duties
Keep both, with non-overlapping scopes:
- **For each child:** direct personal care and supervision, including supervision, feeding support, bathing and dressing, nappies or toileting, naps and bedtime, school run, homework, play, medicines and clinical tasks.
- Remove shared household duties, generic outings and Overnight care from the per-child list.
- **For the nanny role as a whole:** ask only about shared duties such as meals for the children, children's laundry, tidying children's spaces, activities or appointments away from home, travel with the family, and another shared duty.
- Rename and reword both questions so the distinction is clear in the form and the admin record.

### 4. Checked and deliberately unchanged
- "How long might support be needed?" keeps its Ongoing option. That question records duration, not schedule or accommodation, so it does not repeat the live-in or overnight questions and stays as it is.



## Versioning and data safety
- Build from the current governed definition and publish the next available database version, currently version 10.
- Do not edit published version 9.
- Keep existing question identifiers where the concept remains the same so reporting and historical rendering stay stable.
- Retain the governed subject, display context, cardinality and carry metadata for every question.
- Existing submitted answers remain unchanged and continue to render against their original version.

## Validation
- Add tests proving Homework support and Outings alone do not open school details.
- Add tests proving School run opens the attendance question, and Yes opens the full school and authorised-collection branch.
- Test deselecting School run removes now-hidden school answers.
- Confirm Live-in appears only in the accommodation question and Overnight has one schedule signal plus one conditional responsibility detail.
- Confirm the two duties lists have no overlapping option values or meanings.
- Run the questionnaire definition validator and relevant automated tests.
- Verify the nanny journey on phone and desktop, including returning to earlier answers and changing selections.

## Technical details
- Update the questionnaire generator rather than hand-editing only the generated JSON.
- Generate the new definition file and update the validator/test fixture to target the newly published version.
- Publish through an additive migration that retires version 9 only for new starts; documents already pinned to version 9 remain pinned.
