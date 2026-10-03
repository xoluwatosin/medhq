# Portal Refinement Plan

## Done
- Google Maps Platform connector linked to the project (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_TRACKING_ID` now available).

## To Build

### 1. Exit strategy on `/portal/start`
- Add "Not you? Sign out" footer and a "Back to sign in" link so the page is not a dead-end.

### 2. Track-aware profession / study logic
- If the candidate chose **Student**, hide the profession question and show study-level + course/institution fields instead.
- Filter the profession list by the track chosen at `/join` (Clinical, Support & Care, Non-Clinical).
- Ensure licensing-body questions auto-answer once a profession is selected.

### 3. Remove redundant portal sections
- Drop the "What you have told us" tab entirely.
- Hide the **Time off** section from `PortalOffers` (underlying tables stay for future workforce features).

### 4. Inline home address capture
- Replace the "Invited" home-address row with an inline entry form.
- Once a valid address is saved, hide the row from the home checklist.
- Use Google Maps Places autocomplete on the address input to reduce typos and normalize entries.

### 5. Document actions
- When a candidate taps a held document, show an action sheet with **View** and **Replace / Upload** options.
- Keep the existing rename-before-upload behaviour.

### 6. Home / document page tidy-up
- Merge duplicate upload instructions.
- Hide empty sections.
- Reduce repetitive standing rows on the portal home page.

### 7. Mobile account page polish
- Ensure the email masthead logo and text do not overlap on small screens.
- Center the right-side content on split-shell layouts where it is currently off-centre.

## Out of Scope
- Workforce/time-off features remain in the codebase but are not exposed to candidates.
- Custom-domain Google Maps fix is a follow-up once you have your own API key.
