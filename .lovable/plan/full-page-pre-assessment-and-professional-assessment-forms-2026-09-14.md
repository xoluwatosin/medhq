# Full-page pre-assessment and professional assessment forms

## Goal

Make the pre-assessment and professional assessment feel like full-page working forms rather than forms placed inside floating boxes. Match the readable scale used by the “Welcome to Medic Connect” experience, using slightly larger text where clinical hierarchy requires it.

## Verified current state

- The pre-assessment still sits inside a centred `560px` floating card with rounded outer corners and a dialog shadow.
- Its intake uses the same boxed page shell, so changing only questionnaire pages would leave the opening steps inconsistent.
- Supporting text remains as small as `13px` in the shared question treatment and `13–14px` in several pre-assessment areas.
- The professional assessment is already page-based, but it still uses many bordered white cards and several `13–14px` labels, messages and navigation details.
- Both forms already have their required logic, saving, section navigation and specialised clinical controls. This pass will not alter that behaviour.

## Design changes

### 1. Shared full-page form surface

Update the shared form page used by the pre-assessment and intake so that:

- the page itself is the form surface, with no contrasting canvas behind it;
- the outer `560px` card, outer radius and dialog shadow are removed;
- the form uses the full viewport width, with a readable centred content column rather than a floating card;
- the navy heading area spans the page width;
- progress, section numbers, questions and actions align to one consistent content column;
- short screens remain visually centred vertically where practical, while long screens flow naturally from the top;
- safe-area spacing and mobile scrolling remain correct.

### 2. Mostly flat question layout

Use whitespace and dividers instead of repeated containers:

- ordinary questions, intake details, section introductions and review rows become flat page content;
- remove decorative borders, shadows and white-on-white cards around routine content;
- retain contained surfaces only for warnings, errors, selected choices, upload states, saved summaries and clinical evidence that needs clear separation;
- preserve the navy section-cover treatment, but make it a full-width section band rather than a card inside the page;
- keep interactive numbered section navigation visible and easy to tap.

### 3. Typography correction

Use the Welcome experience as the minimum reference:

- primary question and section headings: `20px` on phones and `23px` on larger screens;
- question text and important values: at least `16px`;
- body, helper, status, review and validation text: at least `15px`;
- compact metadata may use `14px` only where it remains secondary and legible;
- field controls remain at least `16px` on phones to prevent browser zoom;
- apply the same hierarchy to the professional assessment, with slightly larger clinical headings where needed.

### 4. Pre-assessment and intake

Apply the full-page treatment consistently to:

- loading and invalid-link states;
- seeded intake confirmation and incomplete intake steps;
- welcome screen;
- section cover pages;
- question screens;
- review and amendment screens;
- sent/read-only answers;
- action area and save status.

The intake and questionnaire must look like one continuous journey, not two different form systems.

### 5. Professional assessment

Flatten the assessment workspace without weakening clinical distinctions:

- keep the client and appointment header as page content;
- turn service coverage and ordinary assessor questions into unframed sections separated by rules and spacing;
- retain bordered/tinted treatments for offline warnings, sync failures, clinical evidence to confirm or amend, and destructive confirmation;
- enlarge section navigation labels and supporting text;
- keep the fixed send bar, offline storage, sync queue and submission behaviour unchanged.

## Behaviour that must remain unchanged

- deterministic conditional routing and hidden-answer pruning;
- intake seeding, first/last-name handling and recipient/service ownership;
- numbered section navigation and section cover pages;
- autosave, retry, resume, review and amendment behaviour;
- recipient-scoped answers and uploads;
- professional assessment offline capture, sync and submission;
- permissions, routes, database structure and Care lifecycle logic;
- movable accessibility and WhatsApp controls.

## Completion checks

1. Confirm no pre-assessment or intake route renders the old floating outer card.
2. Confirm routine assessment questions no longer render as a wall of cards.
3. Inspect all remaining `13px` and `14px` text in both journeys and keep it only when intentionally secondary.
4. Run focused form and Care tests, then the full test suite and type checks.
5. Confirm the preview build has no errors.
6. Walk through the pre-assessment at 320px, 393px, 430px and desktop width, including intake, section cover, question, review and sent states.
7. Walk through a populated professional assessment on phone and desktop, including evidence, amendment, offline/status messaging and the fixed send bar.
8. Verify no horizontal overflow, nested page scrolling, clipped controls, obscured floating controls or text overlap.
9. Report separately whether the changes are only in preview or have been published.

## Contingency

- If a specialised clinical control depends on its boundary for comprehension, retain a quiet divider or semantic evidence surface rather than flattening it blindly.
- If a short screen cannot be vertically centred without causing keyboard or mobile viewport jumps, keep it top-aligned with balanced spacing.
- If a populated assessment is unavailable, verify all public states and automated checks, then report the authenticated populated walkthrough as explicitly blocked rather than claiming completion.
