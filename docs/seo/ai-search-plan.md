# AI search and organic discovery plan

Draft for approval. Nothing here is live yet. No visual redesign: every change below
sits inside existing page shells and design tokens (navy plates, square corners, Figtree).

## Why this shape

Last 30 days: 1,027 visitors, 767 of them direct (our own emails), 93 from Google,
8 from ChatGPT. ChatGPT already cites us unprompted, which means the entity is
recognised but the evidence is thin. Assistants quote pages that state plain facts:
who, where, what it costs, under what registration. Our service pages currently
persuade rather than state.

Rule for all copy below: British English, no em dashes, no invented credentials,
no numbers we cannot evidence.

---

## 1. Answer blocks on the four commercial pages

Add a "Straight answers" section low on each page, above the footer. Question as an
`<h3>`, answer as a short paragraph beginning with the fact. Each block is also
emitted as `FAQPage` JSON-LD through the existing `SEO.tsx` component.

**Care at home (families)**
- What does a live-in nurse cost in Lagos? Answer must state the assessment fee of
  35,000 naira and the fact that care rates are quoted after assessment. Do not
  invent a rate card.
- How quickly can care start? State the real median from `mu_engagements`, not a
  guess. Pull the figure before writing.
- Is the nurse registered? State that clinical staff hold current NMCN or MDCN
  registration, verified against the register before placement.
- Can we change carer? State the replacement policy as it actually operates.

**Facilities and hospitals**
- How do you supply nurses at short notice?
- What checks are completed before a shift? Name the credential ladder stages in
  plain words: registration checked, identity checked, references taken, documents held.
- Which states do you cover? List only states where we have placed staff.
- How is cover charged? State the model, not the price.

**For professionals (join)**
- Is it free to join? Yes, state it flatly.
- What documents are needed? List them, taken from `mu_required_documents`.
- How long does verification take?
- Do you place students and non-clinical staff? Yes, name the four tracks.

**About**
- Registration numbers, country of incorporation, founding year, record retention.
  Flat sentences, one fact each. This is the single highest-value page for assistant
  citation and it currently reads as narrative.

## 2. Location pages

New route `/care-at-home/:area` rendering the existing care-at-home layout with
area-specific copy. Launch set, chosen against where we already have staff:
Ikoyi, Lekki, Victoria Island, Ikeja, Yaba, Abuja, Port Harcourt.

Each page needs, or it should not ship:
- One paragraph naming real landmarks and the hospitals we work near in that area.
- Number of vetted professionals currently available in that LGA, read live from
  `mu_people` with the soft location tokens. If the count is zero the page must not
  be published, and no page may show a bare zero.
- `LocalBusiness` plus `areaServed` JSON-LD.
- A link to the two nearest area pages and up to the parent service page.

## 3. Structured data gaps

`SEO.tsx` already emits Organization and MedicalBusiness. Missing and worth adding:
- `FAQPage` on the four pages above.
- `Service` per service line, with `provider`, `areaServed`, `serviceType`.
- `BreadcrumbList` on service and area pages.
- `Person` on Bridge author bylines.
- `sameAs` pointing at the real LinkedIn, Instagram and X handles only.

## 4. Crawl and citation hygiene

- `public/llms.txt`: a plain summary of what Medic Connect is, the four tracks, the
  service lines, coverage, and contact. Assistants read it; it costs one file.
- `robots.txt`: explicitly allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended.
  Blocking them removes us from the answers we are currently winning.
- `sitemap.xml`: add the Bridge posts and the new area pages, with real `lastmod`.

## 5. The Bridge, retargeted

Current posts are brand voice. Three posts written as reference answers would carry
more weight than ten more:
1. What it costs to hire a private nurse in Nigeria, and what changes the price.
2. NMCN registration explained for families: what to ask for and how to check it.
3. Hiring nursing staff for a Nigerian hospital: the checks that matter.

Each ends with a single commercial link, not a newsletter box.

---

## Order of work

1. Answer blocks plus FAQ schema on the four pages. One day.
2. `llms.txt`, robots allowances, sitemap refresh. Half a day.
3. About page rewritten as facts. Half a day.
4. Area pages behind the live availability count. Two days.
5. Three Bridge reference posts. Ongoing.

## What I need from you before building

- The real replacement policy wording for families.
- Confirmed list of states with actual placements.
- Confirmation that registration numbers may appear publicly on About.
