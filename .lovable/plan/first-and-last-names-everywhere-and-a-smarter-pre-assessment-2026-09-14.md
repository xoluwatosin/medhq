# First and last names everywhere, and a smarter pre-assessment

Confirmed by reading the code and the database: nothing stores a first name and a last name. Every person record (clients, client contacts, care people, enquiry submissions) holds a single "Full name" field, the Request care dialog asks one open "What is your name?", the admin client edit sheet shows only "Full name", and the published pre-assessment therefore asks for the name again. The pre-assessment link panel also asks "who is answering" and a contact before it will create a link, and the section numbers along the top of the form are shown but are not clickable.

## 1. First and last name, from the first form to the last

- Add `first_name` and `last_name` alongside the existing full name on clients, client contacts, care people and enquiry submissions. The existing full name stays and is kept in step automatically, so nothing that reads it today breaks.
- Request care now asks for first name and last name as two fields on the name step. The recap and the confirmation read the same names back.
- The admin client details sheet and the contact sheet ask first name and last name. Existing records keep whatever is on file until an administrator edits them; a one-off tidy splits obvious two-word names and leaves anything ambiguous untouched for a person to correct.
- The pre-assessment stops asking who the person is. It greets them by the name already on file and offers a single quiet "This is not me" correction.

## 2. Remove the redundant step before the link

The Pre-assessment link panel drops the "who is answering" and contact pickers. It creates the link straight from the request: the enquirer on file is the respondent, the relationship is already recorded on the family record. The live-link wording changes from "A link is live for a family member" to naming the person it was sent to.

## 3. A calmer, conditional-aware questionnaire

- A question that opens follow-up questions gets its own screen, and its follow-ups appear on that same screen the moment they are answered, sliding in under the question rather than vanishing and reappearing later. Medicines, allergies, conditions and other branching questions all behave this way.
- No fact is asked twice. Anything captured by the opening intake, or already held on the client record, is shown as a confirmed fact rather than asked again.
- Copy follows who is answering. When the mother is both the enquirer and the person receiving care, postnatal questions read "Are you...", never "Is Munachim...". This is resolved once per screen from the respondent, not per question.
- The numbered section strip becomes interactive: tapping 5 moves to section 5. Sections not yet reachable stay dimmed and unclickable.

## 4. Section covers that look like the rest of the site

Each section opens with the same soft card used for the Workforce notice: a short title, one or two sentences of context, and one primary action. When and where, consent and every other section share that single cover component, matching the Request care cards.

## Should an AI model write the questions?

No. The routing has to be identical every time, auditable and testable: a model that decides which question comes next would be neither. The fix is deterministic rules plus tests. Lovable AI is worth using later for reading free-text answers back into structure, not for deciding the flow.

## Technical notes

- Additive migration `0077`: `first_name`/`last_name` text columns plus a trigger keeping `full_name` composed; no column is dropped and no existing row is rewritten beyond the safe split.
- `src/lib/care-intake.ts` gains the person-name type; `CareIntakeSteps.tsx`, `CareRequestDialog.tsx`, `ClientRecord.tsx` (client and contact sheets) and `PromoteEnquiries.tsx` use it.
- New pre-assessment v7 catalogue built from v6 by `scripts/pre-assessment/`: identity questions removed, branching parents isolated on their own page, respondent-aware phrasing tokens. v5 and v6 documents stay readable unchanged.
- `care-token-create` keeps accepting `filler_type` and `contact_id` for older calls but derives both from the request when they are absent.
- `buildItinerary`/`clustersForSection` gain follow-up-in-place rendering and a `jumpToSection` entry point; `PreAssessment.tsx` wires the numbered rail to it.
- Tests: name splitting and composition, no-duplicate-question routing, respondent phrasing for self versus third party, section jump bounds, plus a populated 430px walkthrough of a mother-and-newborn request.

## Not included

Professional assessment v3, the Clinical Assessor rebuild, T8, packages, staffing, rosters, visits, invoicing.
