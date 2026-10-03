# Tighter candidate records: references, and a tidy-up of documents

## What I checked first

- 39 referee entries across 28 people are stored in the references table.
- Only 1 person has a document filed as "Reference".
- The roster filter labelled "Reference" reads the **document kind**, not the referees table. That is why filtering shows one person while you can see many with referees.
- 546 documents in total: 350 CV rows across 288 people (46 people hold more than one CV), 102 filed as "Other", 36 person-and-label pairs uploaded more than once, and 49 document requests still sitting open.
- Labels have drifted: "Cv/Resume" (216) and "CV" (81) mean the same thing; 87 rows are still called "Other Relevant Documentation" even though some were later reclassified as Licence or Certificate; one label has the file name doubled up twice over.

## 1. Make the references filter tell the truth

- Load a referee count per person with the roster, alongside the document counts.
- Replace the misleading document-kind "Reference" option with two honest filters:
  - **Referees given** / **No referees yet** (from the referees table)
  - Reference *letters* stay available under the document-kind filter, renamed "Reference letter" so the two are never confused.
- Show a referee count chip on each roster row and in the export, so the number is visible without opening the record.

## 2. Referees as a proper collapsible table (admin side)

Rewrite the admin view of the references panel as a compact table:

- Columns: name, relationship, organisation and role, best contact, status, when added.
- The whole panel collapses to a one-line summary ("Two referees given, neither taken up yet") and opens on click.
- Each row expands to reveal the note, the full contact details, and the actions: copy contact, mark as taken up, mark as unreachable, remove.
- Sensible sort (most recent first) and a plain empty state.
- The candidate-facing version stays as it is today: simple cards, no jargon.

## 3. What the upload behaviour is telling us, and what to do

Observed patterns and the fix for each:

- **Repeat uploads of the same thing.** People re-upload rather than replace, so a record holds four "Identity document" rows. Fix: when a new document lands for a kind the person already has, mark the older row as **superseded** and keep it in history rather than in the live list. The live list shows one current document per requirement.
- **Multiple CVs (46 people).** Same cause. The newest CV becomes the current one; older ones fold into history, and the parser only ever reads the current CV, which also stops repeat parse work.
- **Free-text labels.** "Cv/Resume", "CV", "Curriculum vitae" are one thing. Fix: a canonical label per kind, generated on write, with the original file name kept underneath. Stops the doubled-up names ("... Identity document.pdf — ... Identity document.pdf").
- **The "Other" pile (102 rows).** Many are already recognisable from their file name. Fix: an admin **Tidy documents** action that proposes a kind for each "Other" row using the existing classifier, and lets you accept them in bulk with one click, using the reclassify function that already exists.
- **Open requests that are already satisfied (49).** When an accepted document meets a requirement, close the matching open request automatically and stop chasing the candidate for it.
- **Backfill pass**, run once: canonicalise existing labels, mark historic duplicates as superseded, and re-run classification on the "Other" pile so the counts in the office match reality from day one.

## Technical notes

- Roster: extend the loader in `src/pages/admin/MatchUniverse.tsx` to fetch `mu_references` counts by person; new `refFilter` state; keep `docFilter` for document kinds.
- Referees table: split `src/components/portal/ReferencesPanel.tsx` into the existing candidate card list and a new admin table view (collapsible, row expansion), still writing through the same table.
- Documents: add a `superseded_at` column and a current-document rule to `mu_documents`; label canonicalisation on the insert paths in `src/lib/portal-actions.ts` and the admin upload path; extend the existing reclassify RPC with a bulk variant for the tidy-up; auto-close satisfied entries in `mu_document_requests`.
- One migration for the column, the bulk reclassify function and the request auto-close trigger; one data pass for the backfill.

## Not in this pass

- No change to what candidates are asked for or to the verification rules.
- Reference letters are still documents; we are not asking candidates to upload letters they do not have.
