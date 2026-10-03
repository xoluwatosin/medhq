# Admin tidy-up: profile table, clean answers, one text scale, drop Workforce, add Requests

## 1. Profile details as a table

The candidate profile currently renders "Profile details" as an icon-anchored three-column field grid. Replace it with a two-column table (Field / Value) so it reads like a record rather than a card wall:

- Rows: Full name, Email, Phone, State, LGA, Languages, Profession, Years of experience, Licensing body, Licence number, Licence expiry.
- Right-hand column shows the value, with a quiet "Self declared, not evidenced" line only on claim fields.
- Empty values show "Not provided" in muted text rather than a blank cell.
- Same table treatment for the attribution block under Applications.

## 2. Application answers

Two problems today: the keys are raw machine identifiers, and the definition list wraps badly.

- Resolve each answer key to its human label. Matchmaker answers are keyed by the question and document field ids stored on the opportunity, so the opportunity's `questions` and `document_fields` are loaded alongside the application and used as the label source. Anything unresolved falls back to the existing humanise helper (underscores stripped, sentence case, known acronyms preserved) rather than printing the raw key.
- Render answers in the same table style as profile details: label column, value column, full width, no truncation on the value (wrap instead), booleans as Yes/No, arrays as comma lists, file answers as a "View document" link.
- Keep the accordion, drop the cramped two-column dl.

## 3. Uneven text sizes

The Match Universe admin mixes `text-xs`, `text-[11px]`, `text-sm` and `text-base` for equivalent roles. Fix at the shell level in `MuShell` so every page inherits it:

- Section title `text-sm font-semibold`, section description `text-sm` muted.
- Field labels one size only (`text-xs` uppercase), field values `text-sm`.
- Record titles `text-sm font-semibold`, subtitles `text-sm` muted.
- Sweep the MU admin pages for one-off sizes and point them at the shell components.

## 4. Remove Workforce

- Delete the Workforce page, its route, and its sidebar entry.
- Remove the two links into it (Candidates page header, Availability page header).
- No database changes: engagements and offers stay, they are still used by the person profile Work section.

## 5. Requests tab for matching

A new admin page, Requests, inside the matching area of Match Universe. A request is a client need written in plain English, turned into an editable spec, then matched.

Flow:
1. Type or paste the brief (who the client is, where, what care is needed, hours, any must-haves). Optional title.
2. Save it as a request. Requests are stored as internal, unlisted records so they never appear on the public matchmaker site and cannot be applied to.
3. The brief parser proposes structured criteria (profession, location, minimum years, licence and right-to-work evidence, care types, live-in, shift patterns, skill and specialty facets). It only proposes.
4. Every criterion is editable by hand, before or after matching. The brief can be rewritten and reparsed at any time; reparsing shows what changed and never silently overwrites a criterion an admin has edited.
5. Once the spec is complete, the deterministic SQL matcher ranks candidates. The model never picks anyone.

### What a request must specify before it can be matched

The matcher already refuses to rank a brief with no criteria. Make that rule explicit and visible instead of a surprise, as a spec checklist on the request:

Required before matching:
- Profession, at least one.
- Location, at least one state or LGA.
- Care need, at least one required or desirable facet, or at least one care type.
- Start date or "as soon as possible", so availability can be scored honestly.

Optional but prompted, because leaving them blank widens the list:
- Minimum years of experience.
- Licence and right-to-work evidence tier.
- Live-in or live-out.
- Shift pattern.
- Client details that affect fit: client sex preference, religion, pets, smoking household.

The page shows a completeness strip listing what is set and what is missing. The Match button stays disabled with the missing items named until the required four are present. Warnings, not blocks, on the optional ones: for example "No minimum experience set, everyone qualifies on experience" and "Marking everything as required empties the list" when the spec has many required facets and no matches.

Request status moves through Draft, Ready to match, Matching done, Closed. Requests list shows title, location, status, what is missing, when it was last matched and how many candidates it returned; a request can be duplicated, closed, or deleted.



### Why each person was recommended

Every recommendation gets its reasoning shown in three layers, from glanceable to detailed, with no jargon:

1. **Bubbles.** A row of chips per candidate, each already a fact the matcher used: matched requirement (solid), nice-to-have matched (soft), missing requirement (outline), "Free in your window", "Outside the area", "Licence verified", "No location on file". Facet codes are rendered through the existing label lookup so nothing shows as a raw code.
2. **Score table.** An expandable table, one row per scoring line, using the weights already stored in the database: Required needs matched, Nice-to-haves matched, Experience above the minimum, Location, Documents on file, Recent activity, Verified evidence. Each row shows what was found, points earned, points available, and a one-line plain-English note (for example "Matched 3 of 4 must-haves"). Footer row totals to the score already shown on the card.
3. **One-paragraph summary.** The existing rationale, reworded to plain terms and made available on demand rather than by default.

Rules kept intact: the ranking and every number come from the SQL matcher, never from a model. Anything unverified is labelled as self declared or read from a CV. Blockers are shown as their own red line, naming the rule that excluded the person, and blocked candidates can be toggled into view.

The same explanation UI is used on the opportunity matches page, so requests and opportunities read identically. Requests live inside the matching area of Match Universe rather than as a separate silo.

## 6. Remove sparkle icons

Drop the `Sparkles` icon from admin UI: the extract-requirements button on the matches page and the parsed-readout header on `DocumentReadout`. Replace with plain, literal icons (for example a document or list icon) or no icon at all. Public marketing pages keep their existing iconography unless asked otherwise.

## Technical notes

- New route `/admin/match-universe/requests` and `/admin/match-universe/requests/:id`, added to the admin sidebar under the Match Universe group, guarded by the existing `match_universe` permission.
- Requests reuse `matchmaker_opportunities` with a new `kind` column defaulting to `opportunity` and set to `request` for these, plus `brief` text, `request_status`, `client_notes` and `start_date` columns, and a `criteria_edited_by_admin` flag so reparsing does not overwrite hand-edited criteria. RLS follows the existing opportunity policies; public reads are filtered to `kind = 'opportunity'` so requests are never exposed. Public listing and apply pages get the same filter.
- Spec completeness is derived in one place (a small helper shared by the page and the Match button) from the same fields the matcher reads, so the checklist and the matcher can never disagree.
- Parsing calls the existing `parse-opportunity` function; ranking calls the existing `mu_match_candidates` RPC. No new matching or scoring logic.
- Explanation UI extracted into a shared component (`MatchExplanation`) reading `breakdown`, `matched_required`, `matched_desirable`, `missing_required` and `blockers` from the match row, plus the weights from `mu_match_weights` so the table stays correct if weights change. Used by both the requests page and `MatchmakerMatches`.
- Answer labels are resolved client side from the opportunity `questions` and `document_fields` already stored per opportunity, with `humaniseTerm` as fallback.
- Files touched: `MatchUniversePerson.tsx`, `MuShell.tsx`, `AdminLayout.tsx`, `App.tsx`, `MatchUniverse.tsx`, `MatchUniverseAvailability.tsx`, `MatchmakerMatches.tsx`, `DocumentReadout.tsx`, delete `MatchUniverseWorkforce.tsx`, new request pages and shared explanation component, one migration.

