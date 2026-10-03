# Admin candidate profile: audit, rebuild, and one verification truth

## What the audit found

The database already holds a single, trigger-maintained answer to "is this record clean": `mu_people.verification_state` and `mu_people.candidate_gaps`, derived from document status plus profession-aware gap rules. The page surfaces that answer once, correctly, in the hero strip, and then contradicts it three more times in the same view:

1. Hero record sentence: a hand-written six-item checklist (phone, profession, years, state, licensing body, one document) with no relation to the real gap rules. It can read "record complete" while the record is failed or in review.
2. Tab badge on Verification: counts every unverified row in the document table, including documents the profession does not require.
3. Credentials panel: "backed of expected" counts all five credential types for everyone, ignoring whether the profession expects a licence or NYSC.

Other faults confirmed:

- Two round trips per load fetch deployment readiness and profile completeness, and neither number is ever displayed.
- Field settlement runs a write on every page view for every candidate, whether or not anything is pending.
- CV auto-parse re-fires whenever parse status fails to advance, with no attempt ceiling.
- Credential state logic is hand-duplicated in TypeScript alongside the SQL function, with nothing tying the two together.
- Parse promotion only ever fills five fields, while the gap rules judge many more (languages, right to work, NYSC, sex, availability), so those gaps can never close from evidence, only from candidate entry.
- Availability is read only on the admin side by design, but nothing in the layout says so clearly.
- Applications is attribution only and carries no decisions, yet occupies a full tab beside Activity, which is also purely historical.

Candidate and admin already share the document requirement source, the gap list, and the credential write paths. They diverge in vocabulary: admin speaks in credential ladder terms, the candidate sees only document states. That divergence stays, it is correct.

## The verification rule

One definition, computed in one place, role aware.

Placement ready means all three of the following, judged against the requirements of the candidate's own profession:

- Every required document accepted, none rejected or expired.
- No open field disagreements and no outstanding request to the candidate.
- Profile complete for that role: the gap list empty, work preferences set, availability declared, and the reference count the role demands.

Roles differ in what they demand. A registered nurse needs a licence and a licensing body. A caregiver needs no licence but needs two references and a right to work state. A student needs an institution and an expected completion date. A non-clinical hire needs identity and right to work only. These sets live in one table so they can be edited without a code change, and the derivation reads them rather than hard-coding lists.

## Tab structure decision

Six tabs stay. Applications keeps its place and earns it: it stops being attribution only and becomes the stage record for every role the candidate has gone for, with interview booking attached. Activity remains the audit timeline behind it.

```text
Verification   Profile   Matching   Applications   Work   Activity
```

Applications gains a stage for each application, held on the application row and moved by the office: applied, shortlisted, interview offered, interview booked, interview held, offer made, not taken forward, withdrawn. The person is never rejected, only the application, which keeps the existing rule that people carry no status. Interview offered creates a slot set the candidate picks from in the portal; the pick writes the booking and notifies the office. Not taken forward records a reason, visible to the office, softened to a plain sentence for the candidate.

The candidate portal mirrors this: each application reads its stage as a sentence with its date, and where the office has offered interview times the candidate is prompted to choose one, both on the application row and as an outstanding item on the portal home.

## Layout rebuild

- Hero: one navy plate. Name, profession and location, then a fact grid split by hairlines. The readiness sentence comes straight from the derived state, never recomputed in the browser. Beneath it, a single line naming what stands between this record and placement ready, or a line confirming nothing does.
- Tab rail: hairline underline, counts shown only where a count means work for a person, and taken from the same derivation as the hero. Applications carries a count only when an interview needs offering or a booking needs confirming.
- Verification: a decision column. Required documents for the role first, each row stating what it proves and what its state is, with accept, reject and request in the row. Credentials next, expressed as the ladder against the role's requirement set. References last with the count the role demands.
- Profile: two columns, held record on the left and evidence read on the right, each disagreement stating the held value, the read value and who is being asked to settle it.
- Matching: sentence-led rows for suggested opportunities and shortlist state, preferences as plain statements, availability marked as candidate-owned.
- Applications: one row per role, each stating the role, the stage, the date of the last move and the source it came from, with the stage change and the interview actions on the right. Interview details sit under the row when there are any.
- Work: offers, engagements and leave, each a sentence with its date, actions on the right.
- Activity: the merged email and activity timeline, newest first, and the notes field.


## Copy register

Formal record language for states and facts, short imperatives for actions. "Licence accepted 12 August 2026." "Request a licence." No second person, no questions, no fragments such as "0 free". Counts read as sentences, and nothing is announced when the count is nil.

## Function work

- Add a role requirements table and rewrite the gap and verification derivation to read it, so requirements are role driven rather than a fixed list.
- Add one derived readiness view the whole app reads: state, the ordered list of outstanding items, and who owns each item, candidate or office.
- Point the hero, the tab counts and the credentials summary at that view and delete the three browser-side recomputations.
- Remove the two unused readiness and completeness calls.
- Move field settlement off page load, onto the parse completion trigger and an explicit action.
- Cap parse retries and surface the failure instead of looping.
- Delete the TypeScript copy of credential state and read the state column from the credentials view.
- Extend parse promotion to the remaining gap fields so evidence can close them.
- Add application stages and interview slots, with one function to move a stage and record who moved it, one for the office to offer times, one for the candidate to book, and notification emails on offer and on booking.
- Read applications through one function that returns the same rows for office and candidate, so the two views cannot drift.

## Sequence

1. Role requirements table and rewritten derivation, with the readiness view.
2. Rewire the page to the single truth, delete duplicate and dead computations.
3. Rebuild the hero, rail and six tabs to the new layout and copy.
4. Application stages and interview booking, admin side then portal side, with emails.
5. Parse and settlement fixes, promotion coverage, retry ceiling.
6. Check admin and candidate against the same records so both read the same outstanding items in their own vocabulary.

## Technical notes

Touched: `mu_candidate_gaps_row`, `mu_derive_verification`, `mu_document_status`, `mu_expects_licence`, `mu_promote_parsed_fields`, `mu_settle_parsed_fields`, `mu_my_applications`, a new `mu_role_requirements` table, a stage column plus a new `mu_interview_slots` table with grants and policies scoped so a candidate reads only their own, a new `mu_readiness_v` view, then `src/pages/admin/MatchUniversePerson.tsx`, `src/components/admin/mu/MuShell.tsx`, `CredentialsPanel.tsx`, `DocumentsPanel.tsx`, `PersonOpportunitiesTab.tsx`, `WorkPanel.tsx`, `src/lib/credentials.ts`, `src/pages/portal/PortalApplications.tsx`, `src/pages/portal/usePortal.ts`, and a notification path reusing the existing candidate email functions. Existing rows keep working: applications already on file take the applied stage unless a shortlist row exists, in which case they take shortlisted, and the new derivation runs over `mu_people` once on migration so states settle immediately.

