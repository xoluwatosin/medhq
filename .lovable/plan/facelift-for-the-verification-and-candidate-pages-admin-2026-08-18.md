# Facelift for the verification and candidate pages (admin)

The review queue got a tidy-up; the candidate profile and its panels did not. They still run on loose sentence fragments, dot-separated run-on lines and badges that carry no decision. This pass gives the whole area one grammar: labelled fields, icons instead of dots, generous space, and a documented note wherever behaviour is not obvious.

## The rules this pass applies everywhere

1. No dot separators. Every fact gets its own labelled cell with a leading icon (file, calendar, clock, user, shield, map pin).
2. No loose text floating between controls. A fact is either a labelled field, a status chip, or a bordered note block.
3. Only data that changes what an admin does next earns space. Everything else moves into the section description or drops.
4. One decision row per item, right-aligned, separated by a rule, with a clear primary action.
5. Code comments explaining any non-obvious rule stay and are extended where the UI hides logic.

## Shared pieces (new, in MuShell)

- `MuFieldGrid` / `MuField` — the labelled `dt`/`dd` grid the review queue already uses, with an optional icon and a "Not provided" fallback. This becomes the single way facts are shown.
- `MuNote` — bordered, tinted block for hold reasons, filing notes and returned-document reasons, with a title and full untruncated body.
- `MuStatus` — one chip component with a fixed vocabulary: Verified, Accepted, Awaiting review, Returned, Expired, Awaiting candidate. Same colour rules on every screen.
- `MuRecord` — the item shell used by both the queue and the profile panels: avatar or icon, title line, field grid, notes, action row.

## Candidate profile (`MatchUniversePerson.tsx`)

- Header becomes a two-column identity card: identity and contact on the left as icon rows, and a compact status strip (verification state, documents accepted, profile completeness) as chips rather than three grey outline badges. Remove the dead "Review parser proposals" menu item, which now points at a section that no longer exists.
- Tab bar keeps six tabs but gains an at-a-glance count on Verification (documents awaiting a decision) so the tab itself carries the work signal.
- Profile details grid moves to `MuFieldGrid` with icons, two columns on desktop, and the long explanatory paragraph shortened to one line, with the full reasoning kept as a code comment.
- Applications list: replace the `Matchmaker · date · source` run-on with three labelled cells (Route, Applied, Source) and an outcome chip.

## Verification tab

- Documents: each requirement becomes a `MuRecord` with fields Document, Kind, Proves, Arrived, Reviewed, Expiry and a status chip; the current three-cell dot-joined grey line goes. Actions become Open, Return, Accept, right-aligned on their own row.
- Other documents on file get the same record shape instead of the cramped inline row.
- Credentials: the dot-joined middle line becomes fields What they told us, Evidence on file, Reviewed, Expires, with the action to the right.
- References keeps its structure, spacing brought in line.
- Request-documents dialog: checkbox rows get status chips instead of trailing grey text.

## Document review queue (`MatchUniverseVerification.tsx`)

Already close. It adopts the shared components so it cannot drift, loses `· required of them` in favour of a Required chip, and gets clearer empty and loading states.

## Other Match Universe screens with the same fault

Availability, Workforce, Intake and Work panel all build strings with `·`. They move to the same labelled cells or icon rows so the whole area reads as one product.

## What does not change

No database, RPC, email or matching behaviour. Presentation only. Status vocabulary maps one to one onto the existing values, so nothing new needs computing.

## Technical notes

- New exports in `src/components/admin/mu/MuShell.tsx`; consumers: `MatchUniversePerson.tsx`, `MatchUniverseVerification.tsx`, `DocumentsPanel.tsx`, `CredentialsPanel.tsx`, `CvDataTab.tsx`, `mu/WorkPanel.tsx`, `MatchUniverseAvailability.tsx`, `MatchUniverseWorkforce.tsx`, `MatchUniverseIntake.tsx`.
- Semantic tokens only; no hardcoded colours. Status tones come from `MuStatus`, not per-call classnames.
- Each panel keeps a short header comment stating what the screen decides and what is deliberately not shown.
