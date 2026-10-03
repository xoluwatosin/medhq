# Clean up what we ask candidates, and what admin sees

Five faults, all confirmed against the live data for Oluwatosin's profile.

## 1. The sex answer does not carry across

The question on Home saves the words "Female", "Male", "Prefer not to say". The
preferences screen, "Your details" and matching all expect the codes
`female`, `male`, `other`, `prefer_not_to_say`. So the answer is saved, then
read back as nothing and the box looks empty again.

Fix: the Home question offers the same coded options as everywhere else, the
saved value is normalised on the way in, and the existing rows already holding
words are corrected in one pass.

## 2. Answers should not read as "Being checked"

Today, once a candidate answers a question it is pilled "Being checked". We do
not check answers. We check documents.

- A typed answer becomes "You told us" and reads as settled.
- Only documents keep a checking state: on file, being checked, accepted,
  needs another copy.
- The toast after saving stops promising confirmation by the team.

## 3. Questions that are not pertinent should go quiet

- Anything already settled on the profile (state, LGA, profession) is never
  asked again as a question. It shows on "Your details" as an editable fact.
- The list on Home only holds things we genuinely do not hold, plus anything an
  admin has queried.
- No explanatory paragraph under each row. The label and the input are enough.

## 4. Let candidates correct their own facts, with a trail

On "Your details", state, LGA, profession, sex and languages become editable in
place. LGA follows the chosen state, as it does elsewhere.

Every change writes an activity row: what changed, from what to what, who did
it, when. Admin sees that trail on the profile, so a late correction is never
silent.

## 5. Invite a home address

New optional block on "Your details" and on the Home list once the basics are
in: house or street address, nearest landmark, and area if it differs from the
LGA. Framed as an invitation, and used for travel distance and for visits.

Stored on the person record with its own source and timestamp so we know the
candidate gave it rather than a parser.

## 6. The CV summary that has no CV

Oluwatosin has no document on file at all. His five rows in `mu_parsed_fields`
were all written by the portal when he answered questions (state, licensing
body, NYSC, sex, right to work), and `savePortalField` already writes those same
answers onto the `mu_people` columns, where the profile tab reads them. So the
answers are on the profile twice over, and the CV tab, which selects every row
in `mu_parsed_fields` regardless of origin, dresses them up as
"Their CV describes them as...".

Fix: the CV tab reads only rows that came from reading a document
(`document_id` present, or a model other than `candidate`). With no CV it says
so and shows nothing else. No second block is needed for candidate answers,
because the profile tab is already their home.


## 7. Sense check before tomorrow's intake

Ahead of 200+ profiles landing:

- Confirm the gaps list is derived, not stale, for a profile with no documents.
- Confirm a person created by claim, by self-registration and by admin import
  all land in the same shape (state/LGA source, profession source, verification
  state unverified).
- Confirm nothing writes free text where a coded value is expected: sex,
  right to work, NYSC, live-in, looking status.
- Confirm the admin profile header states plainly, per fact, whether it came
  from the candidate, a document, or an admin.

## Technical notes

- `src/components/portal/FieldAnswerInput.tsx`: sex options come from
  `SEX_OPTIONS`; add address fields.
- `src/lib/portal-actions.ts`: normalise coded values before writing to
  `mu_people`; log each candidate-side change to `mu_activity`.
- `src/pages/portal/usePortal.ts`: drop from the attention list any field
  already held on `mu_people`; keep admin-queried rows.
- `src/pages/portal/PortalAccount.tsx`: pill wording, no per-row explanation.
- `src/pages/portal/PortalDetails.tsx`: in-place editing for state, LGA,
  profession, sex, languages, plus the address block.
- `src/components/admin/CvDataTab.tsx`: filter to rows with a `document_id` or a
  non-candidate model, so candidate answers stay on the profile tab only.

- Migration: `mu_people` gains address columns (address line, landmark, area,
  source, captured at) with grants unchanged; one-off normalisation of existing
  free-text `sex` values and matching `mu_parsed_fields` rows.
