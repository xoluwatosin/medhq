# Care Stage 3: Pre-assessment v5, one request-wide questionnaire

Current state confirmed: latest migration is `0071`, the newest published question set is `pre-assessment-v4.json`, the family form still renders whole sections on one screen from `src/pages/PreAssessment.tsx`, and the structured clinical controls, universal lists and Care upload function exist but are not yet enforced end to end on the server.

Goal after this build: an administrator prepares a real multi-recipient care request, sends one pre-assessment link, the family completes a polished questionnaire on a phone, answers stay separated per person, the family sends once, and each person's record shows their own returned information.

## Part A — Finish and harden the previous pass

- Mark the universal condition, medicine and allergen lists as Medic Connect internal vocabulary with an explicit version constant, recorded against every structured answer. No external terminology mapping.
- Make server validation match the browser exactly for conditions, medicines and allergies: governed code must exist and be active, free text only through the explicit "other" value, structured properties checked against their contract, unexpected properties rejected. Malformed-payload tests added.
- Appointment preferences: at most three, real future dates, period is morning, afternoon or evening, no duplicate date and period pair, authored order preserved.
- Care uploads: prove authority on the server — valid unexpired unrevoked token, writable session, the field exists in the frozen definition bound to that session, is a Care upload field, is applicable on the current route, and the named person belongs to that session. Check real file signature, not just the extension. Return a server-issued upload reference; the questionnaire never stores a browser-supplied storage path. Persist audit metadata (session, request, recipient, document, field, original name, detected type, size, object, provenance, time).
- Candidate and Talent uploads stay PDF only everywhere (picker, portal action, admin upload, document request and replacement wording). Care family uploads keep PDF, JPG, PNG, HEIC at 15 MB.
- Authority for v5 comes from token → session → request → enrolled recipients → their documents. Never from a legacy single client reference, and never from shared group membership or family relationship.
- Reported conditions, medicines, allergies and uploaded files remain family-reported evidence. Nothing creates a diagnosis, order, administration record or accepted clinical instruction.
- Verify the above with typecheck, the existing Care tests, the control unit tests and upload accept/reject checks before moving on. No existing care record is rewritten.

## Part B — One session across several people (migration `0072`)

- `care_questionnaire_sessions`: one care request, one published definition, status of draft, submitted or superseded, shared answers, respondent context, server-side last position, timestamps.
- `care_questionnaire_session_recipients`: session, request recipient, client, that recipient's exact pre-assessment document, display order.
- On creation, create or bind one draft v5 pre-assessment document per recipient, owned by that recipient. Shared answers live on the session while drafting; each person's own answers live on their own document.
- On submission, the shared operational answers are snapshotted into each person's frozen document, so the existing carry-forward path still reads one document per person. No clinical answer is ever copied between people.
- The existing access-token machinery (hashing, expiry, revocation, sending, link format) is reused and extended with a session reference. Submitted, expired, revoked or superseded sessions accept nothing.
- Historical v1–v4 documents and single-recipient records read unchanged.

## Part C — The v5 question set

New immutable `docs/care/pre-assessment-v5.json`, evolved from v4; v4 untouched. Section scope becomes either asked once for the whole family, or asked per applicable person. A person may carry several services at once, and a section applies if any of their services matches. No sibling, baby or mother questions ever appear under the wrong person.

Removed because the admin preparation already answers them: who the care is for, rebuilding the recipient list, re-choosing services, and the nanny children roster. Conditions, medicines, allergies, hospital, treating professional, appointment preferences and documents all move to the structured controls. Mother's recovery stays on the mother's record; each baby's questions stay on that baby's record. Every section gets a short authored intro of at most two sentences.

## Part D — The family journey

Four screen types, built on the existing Care/Cx components — no second design system, no dashboard cards inside cards, one primary action per screen, usable one-handed from 320px.

1. Welcome — "Before your assessment", the authored opening text, and Start pre-assessment.
2. Section cover — person name as a small eyebrow when the section is about one person, section number, title, authored intro, Start section or Continue. No inputs.
3. Question pages — at most three independent question clusters per screen. A question and the follow-ups it opens always stay together on the same screen; a branching question gets its own screen. Large structured controls (conditions, medicines, allergies, uploads, repeating items, grids, weekly patterns) each get their own screen. Hidden questions never create blank pages, and branches recompute immediately.
4. Review and send — grouped as Shared, then each person by name, then consent. Readable answers only, no internal codes or empty entries, an Edit action per section, and Send my answers.

Navigation: "Section X of Y" with the section title and the existing save state beside it, plus a compact horizontally scrolling numbered section rail that never causes page overflow. "Part 2 of 4" inside longer sections. Back from the first question page returns to the section cover, then to the previous section. Continue flushes the save first. Resume position is stored server-side, resolves to the nearest valid page when routing has changed, and a submitted session opens the read-only view instead.

## Part E — The admin side

- `GroupSection` keeps the preparation surface; its questionnaire block becomes a compact readiness summary listing each failing fact plainly (request open, at least one recipient, each recipient resolves to their own record, each has a live service, no unresolved service and person pair, respondent chosen, v5 published).
- The Link tab on the client record becomes Questionnaire. Before creation it shows version, respondent, people covered, services per person, readiness and one action: Create pre-assessment link. One link per request, never per person.
- Once live: status, people, version, created date, opened state, whether answers have begun, expiry, and the actions Email link, Get link for WhatsApp, Copy link, Send again, Withdraw link.
- After submission: submitted date, people included, read-only link, and a way to open the returned information.
- Each person's Pre-assessment tab shows the shared snapshot, only their own answers, and where the answers came from. The client record does not become a family dashboard.

## Part F — Read-only submitted view

The same link afterwards shows the same section order grouped as Shared then each person, with no empty fields, no internal codes, no edit controls, and the existing closing message.

## Testing

- Page-grouping tests: zero to three simple clusters on a page, four clusters split, parent and children kept together, complex controls alone, no blank pages from hidden questions, itinerary stays valid when branching changes.
- Definition tests in browser and server for section scope, multi-recipient context and multi-service routing.
- Rollback-safe database tests: one request, one session, three people; a distinct document each; shared answers present in each submitted snapshot; one person's clinical answers absent from the others; a token cannot reach anyone outside its session; group membership and relationships grant nothing; submitted, revoked or expired sessions cannot be changed; one person can hold several services; no direct writes bypass the controlled functions.
- Structured validation and upload accept/reject tests.
- Populated walkthrough: a respondent arranging postnatal care for a mother and twins plus nanny care for the twins — one link, shared questions asked once, covers before sections, at most three clusters per page, branches kept with their parent, mother-only data on the mother, twins clearly distinguished, no children roster, appointment preferences asked once, upload works, back and continue work, reload resumes, review reads Shared / Mother / Baby A / Baby B, one submission freezes everything, and each record shows its own returned information.
- Also a single-adult request, which must still feel like a simple form.
- Checked at 320px, 390px and desktop, plus typecheck, the full Care test suite and a production build.

## Out of scope

Tranche 8, monitoring plans, observations, visits, rosters, family portal, finance, 7.5D/E/F, general design cleanup and Talent work unrelated to the PDF-only boundary. Stage 4 does not begin.
