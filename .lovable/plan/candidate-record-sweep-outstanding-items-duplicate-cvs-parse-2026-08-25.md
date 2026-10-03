# Candidate record sweep: outstanding items, duplicate CVs, parsers, emails

## What the audit found

Confirmed against the code and the live records:

1. The portal home turns every outstanding item into a free-text answer box. Gaps that are not text answers, `references`, `work_preferences`, `availability` and `cv`, get the same box. Answering one writes a parsed-field row that maps to no profile column, so the gap never clears and the item returns. This is what Francisca met when she was told to complete her references.
2. Duplicate CVs are genuine separate files, not repeated rows: across 408 documents there is not one repeated URL, yet many people hold two or three CVs, typically one carried in from their application and one uploaded in the portal. Nothing marks which is current, so both sit in the review queue and both count as work.
3. Every review outcome emails the candidate, from three call sites, so an acceptance that asks nothing of them still sends a message.
4. Parse promotion covers a narrow set of fields, so evidence cannot close most gaps and they fall back to the candidate as questions.

## What will change

### Outstanding items lead somewhere

Each outstanding item declares whether it is answered in place or on another screen. Text facts keep their box. The rest become a sentence with an action:

- References: opens the references screen, with the count the role asks for stated.
- Work preferences: opens preferences.
- Availability: opens the calendar.
- A missing or rejected document: opens documents with that document ready to upload.

The same rule governs the admin side, so the office sees the identical list of outstanding items and who owns each one.

### One current CV

The newest accepted CV becomes the current one and every earlier CV is marked superseded. Superseded documents stay on file and stay readable, but they leave the review queue, stop counting as outstanding and are shown under a quiet heading on the record. The office keeps a manual supersede action for anything the rule does not catch.

### Emails only when something is needed

The candidate is emailed when a document is rejected or expired, when a document is requested, and when a question is put to them. Acceptance and supersession are silent. One further email is sent when the last required item clears and nothing is outstanding, confirming the record is complete.

### Parsers

Extraction: widen the read in `parse-cv` and `parse-document` to the fields the gap rules actually judge, languages, sex, right to work, NYSC, licensing body and expiry, state and local government area, and return an explicit "not stated" rather than omitting a field, so a silence is recorded as a silence.

After the read: promote every field the parser is confident about instead of the current five, raise a question only where the read disagrees with what is held or is genuinely absent, cap retries so a failing parse surfaces instead of looping, and skip a re-parse of a file already read.

## Copy

Formal record sentences throughout. "Two references are needed and none are on file." Actions are short imperatives: "Add a reference", "Set your availability", "Upload your licence".

## Technical notes

- Database: extend the readiness item rows with a route and an action label so both surfaces read one source; add a superseded marker to `mu_documents` with a trigger that supersedes older CVs on acceptance; exclude superseded documents from `mu_document_status`, the verification queue and readiness; widen `mu_promote_parsed_fields`; add a parse attempt ceiling.
- Portal: `usePortal.ts` separates text answers from routed items; `PortalAccount.tsx` renders the two kinds differently; `portal-actions.ts` stops accepting non-field gaps.
- Admin: `DocumentsPanel.tsx` gains supersede and a superseded group, `MatchUniverseVerification.tsx` drops the acceptance email and hides superseded rows, `ReadinessPanel.tsx` shows the same routed items.
- Emails: acceptance calls to `notify-candidate-document` removed; the function keeps rejection, expiry and request paths and gains the single all-clear message.
- Edge functions: `parse-cv` and `parse-document` prompts and field maps.

## Sequence

1. Database: superseded CVs, routed readiness items, promotion coverage, retry ceiling.
2. Portal home and admin readiness rewired to routed items.
3. Documents panel and verification queue: supersede, grouping, email removal.
4. Parser extraction and promotion, then a pass over existing records so states settle.
