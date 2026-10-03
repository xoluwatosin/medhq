# Pre-assessment colour and accessibility-mode correction

## Goal

Correct the unreadable **Section x of x** text on the blue pre-assessment section panel, then make every accessibility option preserve a stable, understandable page rather than distorting it.

## 1. Correct the section progress contrast

- Give the section number and **Section x of x** label an explicit semantic on-dark colour that remains light against the navy panel in normal and high-contrast modes.
- Check the other text and decorative numbering within that same panel so no dark text can inherit onto a dark background.
- Preserve the current pre-assessment wording, colours and structure outside this contrast correction.

## 2. Replace whole-page zoom with reflowing text sizes

The current Larger, Larger still and Largest settings apply browser zoom to the entire page. Replace that behaviour with scoped type scaling so content reflows normally.

For each size:
- increase readable content and control text without scaling the viewport itself;
- allow headings, progress labels, selected answers and buttons to wrap safely;
- keep the section rail horizontally usable without shrinking the page;
- keep the footer actions reachable and prevent fixed controls from covering questions;
- preserve the person's current place and scroll position when a setting changes.

## 3. Optimise every existing option independently and in combination

- **Higher contrast:** strengthen text, borders, focus indicators and selected states while retaining correct light-on-navy text.
- **Reduce movement:** remove transitions and entrance movement without hiding content or changing spacing.
- **Easier-to-read typeface:** apply the alternative typeface without clipping labels, controls or headings.
- **Underline links and buttons:** distinguish links clearly without underlining non-text icons or disrupting button alignment.
- **Read aloud:** keep the existing page-reading action and ensure start, stop and completion states are announced.
- **Panel behaviour:** use the existing accessible dialog primitives, restore focus on close, support Escape, prevent background interaction, and keep the panel usable at the largest text size.
- **Combined settings:** explicitly test the most demanding combinations, especially Largest + Higher contrast + Easier-to-read typeface + Underlines.

## 4. Scope settings safely

- Keep saved preferences across Medic Connect public pages and linked care forms.
- Do not apply the Medic Connect settings to Admin, the Candidate Portal or Heard.
- Reset must return every visual setting and floating-control position to its default.
- Respect the device's reduced-motion preference even before the person selects Reduce movement.

## 5. WCAG 2.2 AA review and acceptance

Audit the pre-assessment and accessibility panel for keyboard access, focus order, accessible names, landmarks, contrast, text spacing, reflow, target size and motion.

Verify on populated pre-assessment screens at:
- 320px, 390px and 430px phone widths;
- 1280px desktop width;
- every text-size level;
- each option alone and the demanding combined setting;
- keyboard-only use and reduced-motion mode.

Acceptance requires no horizontal page overflow, no clipped or overlapping text, no lost controls, no unexpected page jump, visible focus throughout, and WCAG AA contrast for every state.

## Technical details

- Replace root `body { zoom: ... }` rules with accessibility variables/classes scoped to the relevant Medic Connect content and controls.
- Introduce semantic on-dark accessibility tokens rather than relying on inherited foreground colours.
- Keep all changes in presentation and accessibility behaviour. Do not alter questionnaire data, routing, saving, submission or care-record logic.
