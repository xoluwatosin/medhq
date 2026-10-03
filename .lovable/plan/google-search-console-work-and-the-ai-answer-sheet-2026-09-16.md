# Google Search Console work and the AI answer sheet

## Where things stand today

**Google**
- The site is indexed. Google's stored result for www.medicconnect.co says "Submitted and indexed", crawling is allowed, and Google treats the www address as the main one. Last crawl 8 September.
- Last 28 complete days (17 Aug - 13 Sep): 58 clicks, 1,610 impressions, average position 10.8. Best pages: Postnatal care (18 clicks), home page (13), Nanny and childcare (6, but 289 impressions and a very low click rate), Home care Ikeja, Hospital staffing.
- Searches that already find us include "nanny in lagos", "postpartum doula near me", "nurse near me for injection at home", "healthcare staffing agencies". Most sit between position 4 and 11, so small gains move real traffic.
- The sitemap holds 48 pages. The 71 newer expansion pages are deliberately held back and are not in it.
- Crawler rules already allow Google, Bing and the main AI crawlers, and block staff and account areas.

**AI answer file**
- `public/llms.txt` already exists and is rebuilt automatically on every build. It carries the positioning line, the four served markets, contact details, 34 published prices and long explanatory sections, then a list of 25 approved pages.
- It reads as prose. There is no question-and-answer layer, so an assistant has to infer answers to the questions people actually type.

## What I will do

### 1. Google Search Console
- Read Google's stored indexing status for the 48 sitemap pages and list exactly which are indexed, which are known but not indexed, and which Google has never seen.
- Confirm the sitemap Google holds matches the current one, and resubmit it so the newest pages are picked up.
- Produce a short written strategy covering: pages at position 4-11 where better titles and descriptions would lift clicks, the Nanny and childcare click-rate problem (high impressions, few clicks), which held-back expansion pages are worth approving for indexing first, and which query themes have demand we do not yet answer well.
- No page content changes in this step beyond the strategy document, so you see the recommendations before anything is rewritten.

### 2. Internal answer sheet for AI assistants
- Build a controlled question-and-answer set covering the questions people actually ask assistants: what Medic Connect does, where it works, what care costs, how the assessment works, how staff are vetted, the emergency boundary, Omugwo and postnatal care, childcare and safeguarding, staffing for organisations, care from abroad, and how to start.
- Every answer is drawn only from already-approved material: the registered prices, the approved claims, the four served markets. Nothing new is invented, no timing promises, no coverage we do not have.
- The set is added to the AI file as a clear question-and-answer section, generated automatically alongside the rest so prices stay in step with the register. It is not published as a page.
- Goes live with the next build, as agreed.

## Technical notes
- Indexing status read per URL through the Search Console connector against the verified property `https://www.medicconnect.co/`; sitemap submitted to that same property. This reads Google's stored record; it cannot force a re-crawl.
- Answers live in a new `src/content/seo/ai-answers.ts` with the same governance shape as the existing claim records, rendered into `public/llms.txt` by `scripts/generate-llms.ts` using the existing `{{fee:...}}` substitution so prices come from the register.
- A test asserts every answer's price and market references resolve to registered values, and that no answer introduces a timing or outcome promise.
- Strategy output saved as `src/content/seo/search-strategy.md` next to the existing ownership table.
- No changes to page layouts, components or the held-back indexing policy.
