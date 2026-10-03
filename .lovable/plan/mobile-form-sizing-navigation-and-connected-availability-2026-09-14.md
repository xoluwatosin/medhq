# Mobile form sizing, navigation and connected availability

## Goal
Keep the new full-page pre-assessment and professional assessment design, while making questions and controls feel compact, ensuring each page genuinely fills the iPhone screen, adding direct navigation to the opening intake, and making assessment-date choices follow the weekdays and periods already selected.

## Confirmed causes
- The iPhone edge colour is globally forced to navy in four places: the page metadata, installable-app manifest, global `html`/`body`/app-root backgrounds, and a fixed top-edge element rendered on every route.
- The assessment form recently received blanket larger typography and generous control padding. Question headings are 20–23px, most supporting labels are 15px, option controls use 15–15.5px text with large vertical padding, and primary actions are 48px high and full-width on phones.
- Individual pages already provide their own full-height surfaces, so the global navy treatment is unnecessary and conflicts with light pages.
- The opening intake has Back only in its footer and its progress display is not interactive, although the later questionnaire already has interactive numbered section circles.
- Assessment availability is currently disconnected: the form first records suitable weekdays and a time period, then presents a separate unrestricted date picker with another period choice. The selected weekdays and period do not constrain or generate the dates shown.

## Implementation

### 1. Let every page fill the iPhone screen
- Remove the fixed navy top-edge element from the application shell.
- Change the global browser canvas and default browser metadata from navy to the standard light page colour.
- Change the installable-app background and theme colour to the same light colour.
- Keep `viewport-fit=cover`, then let each page paint its own top and bottom safe areas.
- Retain navy only where a page visibly owns a navy heading or navigation area. The pre-assessment heading may extend into the top inset; its white form surface will extend through the bottom inset.
- Make the professional assessment’s light surface cover both safe areas instead of reserving a navy top strip.

### 2. Restore a natural form scale
- Reduce pre-assessment and assessment question headings to a compact mobile scale, with only a modest desktop increase.
- Return helper copy, labels, optional indicators and save status to a clear 13–14px hierarchy.
- Keep text-entry fields at 16px on iPhone to prevent Safari’s focus zoom, but reduce surrounding height and padding where possible.
- Reduce choice, multi-select and clinical-option padding and text size while preserving a minimum 44px touch target.
- Make primary and secondary actions compact rather than visually oversized; keep full-width actions only where needed on narrow phones.
- Tighten vertical gaps between question text, options and footer actions so more of each step fits without crowding.
- Apply the same scale consistently to intake, pre-assessment, clinical controls and professional assessment screens.

### 3. Preserve behaviour and accessibility
- Do not change question content, deterministic branching, answer ownership, saving, uploads, section navigation, review, offline assessment or submission behaviour.
- Preserve 44px touch targets, visible focus states, safe-area spacing, reduced-motion support and the movable accessibility/WhatsApp controls.
- Keep warning and clinical evidence emphasis while reducing only their typography and spacing.

### 4. Add direct navigation to the opening intake
- Replace the opening intake's passive progress display with five numbered, interactive circles using the same visual language as the questionnaire section rail.
- Highlight the current step and distinguish completed steps.
- Allow movement back to every completed step without scrolling to the footer.
- Keep incomplete future steps unavailable so required identity and recipient information cannot be bypassed.
- Keep the footer Back action as a second navigation route, but place it with the current actions rather than requiring avoidable scrolling on long recipient screens.
- Preserve the current conditional step for whether the enquirer is also receiving care. The rail will represent the five logical intake stages and map the conditional branch into its correct stage without changing stored answers.

### 5. Connect weekday, period, date and time choices
- Keep the existing suitable-weekday and suitable-period questions as the source selections.
- Remove the duplicate period choice from the date control.
- On the next screen, calculate upcoming dates that fall only on the selected weekdays, beginning tomorrow and using a fixed future window.
- Present the nearest matching dates as selectable options, with a further-date control only when none of the proposed dates works.
- After a date is selected, present specific times only within the chosen period: morning, afternoon or evening. If more than one period was selected, group the available times by period.
- Store the final result in the existing appointment-preference answer shape so current saving, review and Admin reading remain compatible.
- If “Not sure yet”, overnight or live-in makes a precise slot inappropriate, show a direct fallback rather than inventing an appointment time.
- Keep the logic deterministic in shared tested helpers; no AI will select dates, times or questions.

## Verification gates
- Check the home page, Request care, pre-assessment, candidate portal, professional assessment and Admin at 320px, 393px and 430px widths.
- Verify the top and bottom iPhone areas match the visible page surface, with no permanent navy band on light pages and no uncovered strip during scrolling.
- Verify the pre-assessment navy heading still reaches the top edge cleanly.
- Verify all form controls remain at least 44px tall, input text remains 16px on iPhone, and buttons/questions no longer dominate the screen.
- Verify all five opening stages show on 320px without overflow, the active stage is clear, completed stages are reachable and incomplete future stages cannot be skipped.
- Verify Monday/Wednesday/Friday selections generate only future Monday/Wednesday/Friday dates, and morning/evening selections expose only corresponding specific times.
- Verify changing a weekday or period removes a now-invalid chosen slot, while returning to a prior step preserves still-valid answers.
- Check portrait scrolling, focused inputs and on-screen keyboard behaviour for clipping or double safe-area spacing.
- Add focused tests for intake navigation, future-date generation, period-to-time mapping and stale-slot cleanup. Then run the full test suite, type check and preview build, and confirm no horizontal overflow, console errors or page errors.

## Scope
Frontend presentation and deterministic appointment-selection logic only. No Care lifecycle, database, permissions or route changes. Existing stored appointment answers remain readable.
