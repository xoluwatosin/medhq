# Search strategy

Prepared 16 September 2026. Evidence: Google Search Console performance for 17 August to 13 September 2026, and Google's stored indexing status for all 48 sitemap pages read on 16 September 2026. No page copy has been changed on the strength of this document.

## 1. Current position

- 58 clicks, 1,610 impressions, click rate 3.6%, average position 10.8 over 28 days.
- The site is indexed and Google treats `https://www.medicconnect.co` as the canonical address. Crawling and indexing are allowed.
- Sitemap resubmitted on 16 September 2026. Google previously held a 28-page version last downloaded on 6 September with 1 warning; it now holds the current 47-page version with 0 warnings and 0 errors.

### Indexing status of the 48 sitemap pages

Indexed (25): home, about, contact, join, blog, clinical-home-care, antenatal-care, postnatal-care, post-surgical-care, nanny-childcare, eldercare, pediatric-care, hospital-staffing, hospital-support, clinical-research, care-from-abroad, home-care-lekki, home-care-ikeja, home-care-ajah, home-care-surulere, home-care-yaba, heard, creator, privacy, terms.

Known but not indexed (1): `/home-care-ikoyi` — "Discovered, currently not indexed".

Unknown to Google (22): `/agency-vs-private-nurse-lagos`, `/home-care-victoria-island`, `/24-hour-nursing-care`, `/care-at-home`, `/careers`, `/careers/nursing`, `/caregiver`, `/catheter-care-at-home`, `/chronic-care-at-home`, `/doctor-home-visits`, `/event-medical-cover`, `/for-facilities`, `/guides/what-does-an-omugwo-caregiver-do`, `/newborn-care`, `/ngo-healthcare-staffing`, `/nurse-staffing`, `/omugwo`, `/palliative-care-at-home`, `/physiotherapy-at-home`, `/professional-nanny`, `/professional-omugwo`, and the mental health blog post.

Reading: the 22 unknown pages are the newer P1 set. Google's copy of the sitemap did not contain them until today, and internal links to them are thin. This is a discovery problem, not a quality or blocking problem.

## 2. Priorities, in order

### A. Get the 22 unknown pages discovered

1. Sitemap resubmitted (done).
2. Add in-content links to each new page from the indexed pages that already earn impressions. The strongest donors are postnatal-care (173 impressions), the home page (220), nanny-childcare (289), clinical-home-care (69), home-care-ajah (69), contact (65). Suggested pairings: postnatal-care to omugwo, professional-omugwo, newborn-care and the Omugwo guide; nanny-childcare to professional-nanny and newborn-care; clinical-home-care to 24-hour-nursing-care, catheter-care-at-home, chronic-care-at-home, palliative-care-at-home, physiotherapy-at-home and doctor-home-visits; hospital-staffing to nurse-staffing, for-facilities and ngo-healthcare-staffing; about to careers.
3. Re-read indexing status two weeks after the links ship, and only then consider whether anything needs a different treatment.

### B. Fix the click rate where impressions already exist

- `/nanny-childcare`: 289 impressions, 6 clicks, 2.1% at average position 8.4. The worst ratio on the site and the largest single opportunity. The title and description should answer the searcher's actual question (vetted nannies in Lagos, what the service includes, what it costs to start) rather than describing the page.
- `/clinical-home-care`: 69 impressions, 1 click, 1.4% at position 10.1. Same treatment; lead with nurse visits and the published visit price.
- `/home-care-ajah`: 69 impressions, 2 clicks at position 5.9. Ranking well, under-clicked; the description needs the area name and a concrete starting price.
- `/contact`: 65 impressions, 2 clicks. Lower priority, but the description should state the care request route and the assessment fee.
- `/postnatal-care` at 10.4% and `/hospital-staffing` at 8.8% are the benchmark; match their description pattern.

### C. Positions 4 to 11, where small gains move real traffic

Average position across the site is 10.8, so most impressions sit at the bottom of page one or the top of page two. The queries already reaching us, with position:

| Query | Position | Owner page |
| --- | --- | --- |
| medic connect | 3.9 | home |
| nanny in lagos | 9.2 | nanny-childcare |
| agency for nanny near me | 11.0 | nanny-childcare |
| nurse near me for injection at home | 10.5 | clinical-home-care |
| healthcare staffing agencies | 4.0 | hospital-staffing |
| postpartum doula near me | 1.0 | postnatal-care |
| adult care services | 1.0 | eldercare |
| home nanny | 2.0 | nanny-childcare |

Work in this order: nanny queries (highest impressions, worst click rate, two queries sitting just off the top of page one), then injection-at-home and nurse-visit queries, then staffing.

### D. Held-back expansion pages worth approving first

71 expansion routes are live but deliberately not indexed. Nothing new should be approved until the 22 pages above are indexed, otherwise the same discovery problem repeats at four times the scale. When that is settled, the first candidates are the ones that answer a question the current pages do not own:

1. `/who-do-i-need-after-surgery` — a decision question no service page answers.
2. Nanny and childcare decision routes, because the demand is already proven by impressions.
3. Injection, wound and catheter "at home near me" routes, which match existing queries.

Everything else stays held until there is query evidence for it. The ownership table in `ownership-table.md` governs which routes may ever be approved.

### E. Demand we do not answer well yet

Impressions include location terms such as "alakuko lagos" that no page owns. Do not create pages for these. The better answer is that the existing Lagos area pages carry clearer coverage wording, so one page can serve several neighbourhoods.

## 3. What is deliberately not being done

- No indexing requests can be forced through the API; discovery is driven by the sitemap and internal links.
- No new claims, prices, coverage or timing promises. Anything published must already exist in the governed register.
- No layout or design changes to established service pages.
