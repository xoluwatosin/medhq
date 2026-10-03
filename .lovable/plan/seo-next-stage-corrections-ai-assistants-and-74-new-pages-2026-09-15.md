# SEO next stage: corrections, AI assistants, and 74 new pages

## 1. Sense-check and correct the live pages

Fix the wording that is wrong or overweight on the 17 new pages.

- "Routes into work" lists only real types of engagement: shifts and locum work, contract work, employment, permanent placements, and home care assignments. Registration, vetting and onboarding are removed from that list; they move into "How this works" as steps, because they are how someone joins, not work we offer.
- Placements are named plainly as one type of employment we offer, on both the careers pages and the employer staffing pages. No separate placements page.
- "How this works" becomes a one-line step you can open: each numbered step shows a single short sentence, with the fuller approved wording only when the step is opened.
- Page openings and card text are trimmed to the shortest wording that still says the same thing. No approved fact, price or limitation is removed or changed.
- Re-read all 17 pages end to end for anything else that reads wrongly (duplicate sentences, a claim that does not belong on that page, a price that should be quote-only).

## 2. Update the AI assistants (ChatGPT, Claude, and similar)

- Rewrite `public/llms.txt` from the governed registry so the summary, service list, markets and prices match what is actually approved and live, and add the new page list. Today it still names Lagos only and quotes rates that are not the approved public tariff.
- Markets stated as Lagos, Abuja/FCT, Ogun State and Ibadan/Oyo. Port Harcourt stays out.
- Add per-page structured data for service, breadcrumbs and, on the question pages, the question and answer, so assistants and search can read each page cleanly.
- Confirm robots allows the AI crawlers and that the sitemap lists every live page.

## 3. Designs for the 74 new pages

Five page designs, all built from the existing look (navy photo header, Our Clients strip, picture cards, short numbered steps, prices where governed, closing call to action).

1. Care service page — for things we deliver at home (wound dressing, IV therapy, stroke recovery, live-in caregiver, PEG feeding, and so on). Header, who it is for, what is included, prices where a governed price exists, short steps, call to action.
2. Childcare and additional needs page — for shadow teacher, autism support, speech therapy, nanny type pages. Same shape, with a safeguarding and authorised pick-up section instead of clinical wording.
3. Employer staffing page — for hospital, doctor, pharmacist, school and corporate staffing. Header, who we staff, engagement types including permanent placements, vetting, and an enquiry call to action.
4. Jobs page — for nurse, doctor, midwife, caregiver and nanny opportunities. Header, who we engage, routes into work, what joining involves, Join our network call to action.
5. Guide and comparison page — for "Nurse vs caregiver", "Who do I need after surgery?", "Home care vs care home", "Caregiver cost in Lagos", and the rest. Short answer at the top, a comparison or checklist block, then links to the relevant service pages.

Every one of the 74 paths is assigned to one of these five designs and grouped into a hub so pages link to each other rather than sitting alone.

## 4. Content rules for the new pages

- Wording is written into the governed registry first, then rendered. No page invents a price, a location, a clinical claim or a service we do not deliver.
- Prices only appear where an approved public rate exists; everything else says it is quoted after assessment.
- Each page gets its own short title and description, its own header photo from existing photography, and links to related pages.

## 5. Build order

1. Corrections and trimming on the 17 live pages.
2. AI assistant and structured data update.
3. One example page per design, for your review, before the rest are built.
4. The remaining pages in batches by group, with the sitemap updated at the end of each batch.

## Technical notes

- Page copy, claims and prices stay in the governed SEO registry and the local mirrors in `src/content/seo/`; publication and index state continue to go through the server-side governed controls, not direct writes.
- `GovernedSeoPage.tsx` gains a template selector so the five designs share one renderer; `page-visuals.ts` gains the new path mappings.
- Structured data per template via the existing `SEO` component; `scripts/generate-sitemap.ts` updated per batch.
- Checks each batch: typecheck, tests, build, and browser checks at 393px and 1280px.
