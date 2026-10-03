# Today's other care links

## What the database shows

Five start links were issued today.

- One (Oluwatobi Belewu) is completed and now opens straight into her pre-assessment.
- Four are still at stage 1 and not completed. Three have no answers saved yet; one has enquirer details for Francisca Abosede and nothing further.

The two faults that stopped her were both fixed centrally, not per link:

- The database fault that blocked the final "Save and continue" is fixed for every link.
- Reopening a finished start link now carries the person straight into their pre-assessment, for every link.

So the other four will behave the same way. No new links need to be generated, and nothing link-specific has to be repaired.

## What still needs doing

1. Publish the app so the screen fix reaches people using the links (a failed save keeps their answers instead of showing "This link cannot be opened").
2. Small reliability fix: the saved stage number is never sent when answers auto-save, so everyone resumes at stage 1 even if they had reached stage 3. Send the current stage with each save so people resume where they stopped.
3. Re-run an end-to-end check on one of the four pending links using temporary details, confirm the client record and onward pre-assessment link are created, then remove the temporary records.

## Technical notes

- `src/pages/CareOnboarding.tsx`: include the current step in the `save` payload; the `care-onboarding-form` function already accepts and stores `position`, and `load` already returns it.
- No database migration, no changes to token issuing, grants or the pre-assessment catalogue.
