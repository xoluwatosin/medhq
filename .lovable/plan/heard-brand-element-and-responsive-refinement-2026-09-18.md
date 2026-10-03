# Heard brand-element and responsive refinement

## Goal

Make the active Heard consumer site feel consistently built from the supplied Heard element library, while finishing the homepage opening screen and correcting the desktop header and monile header and mobile menu. Preserve all existing routes, wording, forms, submissions, account behaviour and backend rules.

## Brand elements

- Keep the existing `HeardTapeLabel` and `HeardPinnedNote`, refining their small-screen sizing where needed.
- Add workbook-faithful versions of the three requested elements that are not currently in the active kit:
  - `HeardRevealStatement`: a restrained statement that reveals in stages, with an immediate static state when reduced motion is requested.
  - `HeardPullLine`: a strong editorial line with the workbook’s Late, Violet Ink, Mute and Pale Sky treatment.
  - `HeardBreadcrumb`: compact route context using real Heard links and the existing base-path adapter, so it works identically on `heard.medicconnect.co` and `/heard-preview`.
- Use existing page wording inside these elements. Do not invent testimonials, claims, metadata or explanatory copy.

## Placement across Heard

Use the elements as a repeatable visual language, not decoration on every section:

- **Home:** retain the official infinity mark and clickable **Be heard** / **Read a letter** entry points; use one reveal statement or pull line lower on the page to strengthen the editorial rhythm.
- **Be Heard, Story Swap and Leave a letter:** breadcrumbs for route context, tape labels for writing/preview states, and pinned notes only where the current guidance or safety copy genuinely behaves like a note.
- **Letter Room:** retain direct reading and the existing letter stack; use tape labels for letter state/category and the pinned note for the existing supporting note.
- **Talk to us, About, Support and Privacy:** use pull lines or reveal statements selectively around existing key lines; add breadcrumbs on inner pages.
- **Get involved, role selection and volunteer account pages:** breadcrumbs for orientation; use a tape label or pinned note only for existing role/account guidance where appropriate.
- **Not-found state:** bring it into the same active Heard layout and brand-element system rather than the older Heard shell.

## Homepage opening screen

- Recompose the official infinity mark, connector lines, action pills, headline and supporting line as one balanced opening screen.
- Remove the excessive empty space visible on laptop while keeping the opening screen as the only first-view content before scrolling.
- On mobile, fit the complete composition between the header and viewport bottom, with stable spacing at short and tall phone heights.
- Keep both action pills comfortably tappable, visually attached to the mark and clear of the headline.
- Test short laptop, standard desktop, narrow phone and tall phone dimensions; prevent horizontal overflow, clipping and accidental second-section exposure.

## Header and mobile menu

- Increase the **Heard** wordmark in the top bar while preserving the official horizontal lockup and the “by Medic Connect” line.
- Keep the desktop header compact and rebalance its logo, navigation spacing and baseline after the logo increase.
- Replace the oversized mobile Close treatment with a compact control that does not compete with or displace the logo.
- Reduce mobile menu link size and vertical spacing so all seven destinations and the safety statement fit in one ordinary phone viewport without page scrolling.
- Keep 44px minimum touch targets, visible current-page state, keyboard focus, body scroll lock and reduced-motion behaviour.

## Verification

- Check every active Heard route and deep link under `/heard-preview`; verify the same base-path behaviour used by the Heard hostname.
- Verify the homepage at narrow/tall phones and short/standard laptops, including both hero links and no overflow or overlap.
- Open and close the mobile menu, confirm every destination is visible and usable without scrolling, and confirm the larger header logo remains aligned.
- Verify forms, Letter Room loading/empty/populated states, volunteer account screens, keyboard navigation and reduced-motion mode.
- Confirm no console errors and a healthy build.

## Boundaries

- No Medic Connect, legacy `/heard`, backend, security, consent, submission, authentication, routing or copy changes.
- No new palette, makeshift mark, gradient, photography or non-workbook visual language.