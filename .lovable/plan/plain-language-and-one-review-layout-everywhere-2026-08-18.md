# Plain language, and one review layout everywhere

Three jobs: strip the leftover machine language from the admin back end, remove the two sections that no longer earn their place, and reuse the review-queue layout on the candidate profile.

## What I found in the audit

Machine words still on screen in the admin:

- Verification queue: "Why it is still here" (hold note), "Waiting on the candidate" section (the disagreements list).
- Candidate profile: "What the parser proposed" section, "Canonical record" section title, "Review parser proposals" in the actions menu.
- Intake page: "Parser proposals" stat, "How the pool was read / Parse state across every profile", "N profiles the parser has not finished with", raw parse states as pills, "Parse history" on the CV panel.
- CV panel: "13 fields from CV" counter pill and the status pills next to it.
- Credentials: "Deployment ready", "Claim: not asked (provenance)" run-on line.

Layout inconsistency: the review queue now uses labelled field grids and full-width note blocks, while the profile's Verification tab still uses pills, truncated one-line summaries and bunched buttons.

## Things worth knowing before I remove them

- The parser-proposals section is not only display. Opening it settles the obvious cases automatically and turns the rest into questions in the candidate's portal, and it has a manual "Ask them" button. If the section goes, the settle still needs to run. I will run it silently when the profile loads, and anything it cannot settle becomes a portal question on its own, no button. Nothing is lost, it just stops being a screen.
- The disagreements list is read-only already, so removing it loses no action. What it did give was visibility of how many people are sitting unanswered, and which of those have never claimed their portal. I will keep that as one plain line on each person's Verification tab ("Waiting on Joyce to confirm their state, asked 6 days ago") and a single count on the intake page, rather than a queue nobody can act on.

## What changes

**1. Remove the disagreements section** from the verification queue page, along with its data load and row type. The page becomes documents only.

**2. Remove the parser-proposals section** from the candidate profile. Settle runs quietly on load; unsettled values become portal questions. Retire `ParsedVsHeld`.

**3. Reuse the queue layout in the profile's Verification tab.**

- Documents: each item becomes a labelled grid (Document, Kind, Proves, Arrived, Expiry, Status) with the note in its own bordered block and the decision buttons on a separated, right-aligned row, exactly as the queue reads.
- Credentials: the run-on middle line becomes the same labelled grid (What they told us, Evidence on file, Reviewed, Expires), with actions to the right.
- References keeps its shape, spacing brought in line.

**4. Strip badges that carry no decision.** The "N fields from CV" counter, the parse-state pills on intake, the "no CV on file" pill, the profile-header "yrs experience" pill. Status stays where it changes what you do next (verified, accepted, outstanding); counts move into section descriptions as plain text.

**5. Rename to precise, professional labels.** Short noun labels, no explanatory sentences standing in as headings, no internal system words.


| Now                                         | Becomes                     |
| ------------------------------------------- | --------------------------- |
| Why it is still here                        | Hold reason                 |
| Note on file                                | Filing note                 |
| Canonical record                            | Profile details             |
| Read from their CV                          | CV summary                  |
| What the parser proposed                    | (removed)                   |
| Review parser proposals                     | (removed)                   |
| Waiting on the candidate                    | Awaiting candidate response |
| Parser proposals                            | Awaiting candidate response |
| How the pool was read                       | CV coverage                 |
| N profiles the parser has not finished with | N CVs outstanding           |
| Parse history                               | CV read history             |
| Deployment ready                            | Placement ready             |
| Claim: not asked                            | Not declared                |


## i like note on file and parse history. instead.

## Technical notes

- Files: `MatchUniverseVerification.tsx`, `MatchUniversePerson.tsx`, `MatchUniverseIntake.tsx`, `DocumentsPanel.tsx`, `CredentialsPanel.tsx`, `CvDataTab.tsx`, delete `mu/ParsedVsHeld.tsx`.
- The auto-settle call currently inside `ParsedVsHeld` moves into the profile's load effect. No database change: the same RPCs run, just without a screen around them.
- Presentation only otherwise. No change to matching, settle rules or email behaviour.