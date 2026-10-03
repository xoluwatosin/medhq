# Stop the new pages competing with the established ones

Your reading of the code is correct. Adding a route to the expansion list currently puts it in the sitemap, points its canonical at itself and lets search engines index it, with no reference to the approval register. That is how seven near-duplicates of established pages became publicly indexable.

This plan closes the gate first, then fixes the clear duplicates, then works through all 75 routes with an ownership decision each.

## Stage 1 — Indexing follows approval, not the route list

Today: a route exists, therefore it is indexable.
After: a page is indexable only when its SEO register record says so.

- Each expansion route gets a registry record with an index state (the same states the 25 governed pages already use).
- A route whose record is not approved and indexable renders with a "do not index" instruction and is left out of the sitemap. It still works for anyone given the link, so pages can be built ahead of approval.
- The sitemap builder reads the register instead of blindly including every seed.
- The same rule applies to the 25 existing governed pages, so there is one path to being indexed.

## Stage 2 — The three unambiguous duplicates

| New route | Keeps | Action |
|---|---|---|
| /antenatal-care-at-home | /antenatal-care | Fold the better wording into the established page; new URL redirects to it |
| /clinical-research-staffing | /clinical-research | Same |
| /hospital-support-services | /hospital-support | Same |

Any genuinely better content on the new page is moved into the established page before the redirect goes in, so nothing is lost.

Note on redirects: the site is a single-page app, so a visitor is sent to the correct page and search engines are told the established URL is the canonical one. A true server-level permanent redirect would need a hosting rule; I will flag the three URLs so that can be added later if you want it.

## Stage 3 — Ownership decision for every one of the 75

A written table, one row per new route: the URL, the established pages it competes with, what content they share, whether it has a distinct reason to exist, and one of four decisions:

- KEEP — distinct intent, approve for indexing
- REFRAME — keep the URL but rewrite it so it answers a genuinely different question (for example, /care-for-elderly-parents becomes a decision guide for families abroad rather than a second eldercare service page)
- MERGE — content moves into the established page, URL redirects
- HOLD — route stays built but not indexed until it earns a distinct purpose

The known candidates are already listed in your note: hospital-to-home vs care-after-hospital-discharge, school-companion vs shadow-teacher, talent-pool vs careers/join, the speech, live-in, night-nurse, additional-needs and NGO/staffing clusters.

Nothing in this stage becomes indexable until the table is agreed with you.

## Stage 4 — The exact copy changes on the established pages

The older URLs hold the ranking, so the corrected wording belongs there. These are the only copy edits in this pass, each one word-for-word:

**/antenatal-care** (page title and search description)
- Now: "Antenatal Care at Home in Lagos from ₦15,000" and "Routine ANC packages from ₦15,000".
- Change to: the registered public antenatal visit and trimester prices. The page also publishes ₦15,000–₦60,000 price data to Google in its structured data; that is replaced with the same registered figures. I will list the exact amounts from the approved tariff in the ownership table before I edit anything, rather than guess them here.

**/hospital-staffing**
- Now: "Staff deployed within 24-48 hours for urgent needs" and "We respond within 2 hours."
- Change to: "Urgent requests prioritised, with agreed timelines confirmed at scoping" and "We respond to every staffing enquiry and agree next steps with you." Both are unverifiable promises today; if you want to keep a stated time, tell me the one you can honour and I will publish that instead.

**/clinical-research**
- Now: "All clinical research personnel are GCP-trained and briefed on NAFDAC, NHREC and IRB requirements" and "We typically deploy site staff within 2–4 weeks."
- Change to: "Research personnel are selected against the protocol's stated training and regulatory requirements, and evidence of GCP training and regulatory briefing is confirmed per study" and "Deployment timelines are agreed at scoping and depend on protocol complexity, geography and required certifications." The "GCP Compliant" badge and the "GCP-trained and ready to deploy" line become "Protocol-matched research teams".

Everything else on these three pages stays exactly as it is.

## Keeping the original design

The established service pages, /clinical-home-care in particular, are the reference and stay untouched visually. Where content moves from a new page into an established one, it is fitted into that page's existing sections rather than bringing the expansion layout with it. No new section types, no new components, no spacing or colour changes on the established pages.


## Technical notes

- Registry: create one `seo_pages` record per expansion route, seeded from `expansion-pages.ts` (path, type, title). Default `index_state` is `candidate`, `publication_state` `planned` — nothing becomes indexable by this migration.
- Rendering: `ExpansionSeoPage.tsx` and `GovernedSeoPage.tsx` read the record's index state; anything other than `indexable` renders `SEO` with `noindex` and a canonical pointing at the owning URL when one is set. Add an optional `canonicalPath` to `SEOProps`.
- Sitemap: `scripts/generate-sitemap.ts` stops deriving paths from `seed(...)` matches and instead queries `seo_pages` for approved indexable rows, falling back to the current static list only if the query fails (so a build never ships an empty sitemap).
- `public/llms.txt` generation follows the same indexable filter.
- Redirects: route-level `<Navigate replace>` for merged paths, plus a `redirects` map in the expansion content file so the ownership table and the router stay in one place.
- Tests: extend `expansion-page-quality.test.ts` with a check that every expansion path has a registry record and that no merged path renders as indexable.
- Out of scope: no design changes, no new pages, no changes to Care, Talent, Workforce or Finance.

## Order of work

1. Stage 1 gate plus registry records for all 74 routes (all non-indexable initially).
2. Stage 2 three merges.
3. Stage 3 ownership table for review — no indexing decisions applied until you agree it.
4. Stage 4 corrections to the established pages.
5. Approve the agreed KEEP set for indexing and regenerate sitemap and llms.txt.
