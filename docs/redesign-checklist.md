# Site redesign checklist

The Medic Connect design system rollout, page by page. Tick items as they ship.

## Done

- [x] Home, Care at home, For facilities, Join the network
- [x] The 11 service pages, on one shared layout
- [x] About, Contact, 404
- [x] The 15 area pages (7 neighbourhoods, 8 estates and districts)
- [x] Prices aligned to the approved pricing book (live-in from ₦300,000)
- [x] The SEO pages (governed core pages and expansion pages)
- [x] The Bridge (blog list and story pages)
- [x] Sign-up steps: account, confirm, first profile answers
- [x] Candidate portal frame, sign in, and the shared portal cards, fields and headings
- [x] Family care pages: invitation, family home (names, what is shared, a way into the proposal) and proposal, in one family frame (`src/components/care/FamilyShell.tsx`); the care details and pre-assessment forms were already on the Request care surface
- [x] Request care and welcome pop-ups: soft navy-tinted shadow (the offset block shadow is retired on application surfaces), pale blue caps on navy everywhere (a shared label style was overriding them), no empty footer, and a care type picked in the welcome is not asked again
- [x] Emails: soft corners, space under buttons, and a footer with the company name and address on every email (the footnote was accepted but never printed)
- [x] Contract signing link: navy cap, cards and controls on the system (the contract document itself is unchanged)

## To do

- [ ] Candidate portal: screen-by-screen polish once real data is in (offers, contracts, applications)
- [ ] Smaller public pages: Creator, Agency vs private nurse, Privacy, Terms, Unsubscribe, matchmaker pages (/hm)
- [ ] Admin Centre: inventory done (docs/admin-inventory.md); defects fixed in code (merges, approvals, autosave, confirmations, silent failures, route access, settings, invoices, intake count, admin 404)
- [x] Merge function migration applied to the live database (via the SQL editor, 5 October)
- [ ] Admin Centre phases: kit (plain register), pipeline (retire Applications and Creator into Pool and Programmes), care and inbox, content and comms

## Admin wishes

- [ ] Blog: choose clip art for a story in the post editor, so a story can carry an illustration (for example in place of, or beside, its photo on The Bridge).

## Open questions

- [ ] Post titles on The Bridge are stored in Title Case; the rest of the site uses sentence case.
- [ ] Contact page: keep or drop "Emergency support 24/7 on WhatsApp" above the call 112 box.
- [ ] Show more of the approved package prices (Omugwo from ₦290,000, managed nanny from ₦285,000, 24-hour nursing from ₦150,000)?
