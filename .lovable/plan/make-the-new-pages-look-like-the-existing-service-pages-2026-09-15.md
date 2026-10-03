# Make the new pages look like the existing service pages

The 17 new pages currently show plain text blocks. They will be rebuilt to the same layout every other service page uses, with photos already on the site.

## The layout each new page gets

1. Navy header block with a photo beside it, the "HEFAMAA accredited" badge, the page heading, the promise line and a Request care button (Join our network on the two careers pages).
2. Our Clients strip, showing who the service is for.
3. Grid of picture cards for the parts of the service, taken only from the approved wording. Pages whose approved wording names no distinct parts skip this section.
4. How it works, as the numbered expanding list used elsewhere.
5. Why choose Medic Connect, as the small icon cards used elsewhere.
6. Prices, where approved prices exist for that page.
7. Closing call to action.

Wording stays exactly as approved. Nothing new is written, no new prices, no new claims.

## Photos

Each new page reuses the closest photo already on the site:

- 24-hour nursing, catheter care, chronic care, doctor visits, physiotherapy, palliative care: clinical and skilled nursing photos
- Omugwo, professional Omugwo, the Omugwo guide, newborn care: postnatal photos
- Caregiver, professional nanny: nanny and childcare photos
- Careers, nursing careers, nurse staffing, NGO staffing: hospital staffing photos
- Event medical cover: the existing event medical photo

Card images inside each page come from the same families. No new pictures are generated.

## The eight pages that already existed

Care at home, for facilities, clinical home care, post-surgical care, care from abroad, postnatal care, nanny and childcare and eldercare keep their current pages untouched.

## Technical notes

- Rework `src/pages/GovernedSeoPage.tsx` to mirror the section structure of `src/pages/ClinicalHomeCare.tsx` and `src/pages/Eldercare.tsx`, reusing `ClientsScrollSection`, `ServiceFlipCard`, `HoverCard`, `Accordion`, `CareRequestDialog` and `CTASection`. Existing design tokens only.
- Extend the page records in `src/content/seo/governed-pages.ts` with hero image, card images, who-it-is-for entries and card entries, each derived from the approved module and page wording already stored.
- Keep prices rendering from the governed public fee records; no hard-coded amounts.
- Careers pages route their primary action to `/join` and suppress the care request form.
- Verify with a typecheck, the test suite and browser checks at phone and desktop widths.
