# Pre-assessment: full visual rebuild on the Request care design

## Why the design never changed

Three layers were treated as one.

1. **Questions** — version 6 is published in the database and controls wording, order and conditions. It cannot change appearance.
2. **Colours and radii** — tokens from the uploaded reference were copied into the shared stylesheet, softening a few edges only.
3. **The rendered form** — still built from the Candidate Portal components `CxJoinShell`, `CxCard`, `CxButton` in `src/pages/PreAssessment.tsx` and `src/components/care/CareIntakeSteps.tsx`. Request care uses entirely different components in `src/components/request/RequestShell.tsx`. The pre-assessment was never moved onto them, so every prompt that changed questions left the look untouched.

## Reference files this build uses

All paths are exact, so there is no ambiguity during implementation.

| Reference | What is taken from it |
|---|---|
| `/mnt/user-uploads/Medic_Connect_Request_Care.html` | The surface: navy field `#26306b`, warm-white card `#FAF8F4`, roughly 24px card corners, brand blue `#3B4DC4` full-width action, generous internal spacing, one question in view. |
| `src/components/request/RequestShell.tsx` | The working implementation of that surface: navy cap with mark and eyebrow, segmented progress, scrollable warm body, `Question`, `Choice`, `FieldLabel`, `DialCodeField`. |
| `src/components/CareRequestDialog.tsx` | The proven question-per-screen pattern: one `Question` with heading and one short help line, a single group of `Choice` rows or fields, Back on the left and one primary action on the right. |
| `Copy_of_MEDIC_CONNECT.zip` → `connect-os/Intake and Incident Instruments.dc.html` | The answer-row pattern for scored/graded questions: white row, 1.5px hairline, selected row filled navy `#26306B` with white bold text. Used for every single-choice question. |
| `Copy_of_MEDIC_CONNECT.zip` → `connect-os/Elements.dc.html` | Instrument principle: the few things a person touches most are drawn properly, not written as labels. Applied to the medicine entry and the section index. |
| `Copy_of_MEDIC_CONNECT.zip` → `connect-os/Clinical Instruments.dc.html` | Clinical list presentation: every value is both drawn and written in digits; nothing clinical abbreviated. Applied to medicines, allergies and conditions. |
| `Copy_of_MEDIC_CONNECT.zip` → `connect-os/Family and Physician Design.dc.html` | Family tone rules: answer the question they came with first, no jargon, and never a blank where a fact should be — every empty state written in words. |
| `Copy_of_MEDIC_CONNECT.zip` → `connect-os/LEXICON.md` | en-GB wording and the ban list, checked against every string touched. |
| `docs/design-guide/README.md` | Typography scale, hairline rules, 44px touch minimum, motion limits. |

## Screen design, one question per screen

Every screen is built from the same four bands, top to bottom:

```text
┌──────────────────────────────────────┐
│ NAVY CAP  mark · Pre-assessment      │  fixed, 1 line eyebrow + title
│ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁ ▁▁▁  segments        │  one segment per section
├──────────────────────────────────────┤
│ WARM CARD  #FAF8F4, 24px corners     │
│   Section 4 · Medicines              │  small navy caption
│   Question heading, 20/21px          │
│   One help line, only if it changes  │
│   the answer                         │
│                                      │
│   [ answer area ]                    │
│                                      │
│   [ follow-ups appear here, inline,  │
│     same screen, on reveal ]         │
├──────────────────────────────────────┤
│ ACTION BAR   Back        Continue    │  Continue full width on phone
└──────────────────────────────────────┘
```

Rules applied to all screens: one question in view; help text at most one line; the card scrolls, the page does not double-scroll; the action bar is always reachable; controls are at least 44px tall; only the reveal animation moves.

### Screen by screen

1. **Opening details** (`CareIntakeSteps.tsx`) — first name and last name as two fields side by side on wide screens and stacked on a phone, then phone, then email, each on its own screen, using `FieldLabel` and `DialCodeField` exactly as Request care does.
2. **Who the request is for** — three `Choice` rows: Myself, Another person, Several people.
3. **Each person receiving care** — one warm sub-card per person with name, relationship, date of birth or age band, optional contact details where age allows, and their services as `Choice` rows on the same card. Adding a person appends a card; removing one is an outline action on that card.
4. **Confirmation** — a plain-language summary listing each person and their services, then one primary action to begin the questions.
5. **Section index, numbered navigation** — currently missing from the form and restored here. Every section appears as a tappable row: the number in a navy pill on the left, the section name, and its state in words (Not started, In progress, Complete). The same numbers also sit as a compact strip above the question card on every screen, so a person can jump between sections at any point. A number already answered is filled navy; the current one is outlined; ones not yet reached are quiet but still reachable. Numbers are real buttons, keyboard reachable, at least 44px.
6. **Section cover page** — also currently missing and restored. Each section opens on its own cover: a navy band carrying the section number and name, one sentence saying what the section covers, how many questions it holds and roughly how long it takes, then one primary action to begin and a quiet link back to the section index.
7. **Standard question** — heading, optional help line, then answer area: single choice uses full-width choice rows; multiple choice uses the same rows with a tick; short text, long text, number, date and select use the Request care field treatment.
8. **Conditional follow-up** — the trigger answer stays visible and its follow-ups appear directly beneath it on the same screen with a short reveal. Answering "Yes" to regular medicines shows the medicine list, amount, unit and frequency without a page change; the same for allergies and conditions.
9. **Medicine entry** — one row per medicine: name, then amount, unit and frequency as three adjoining controls, all blank by default and never pre-filled. Added medicines appear as a stack with edit and remove. Time-critical and refrigerated questions list those same medicines as choice rows.
10. **Upload question** — one file row, a short line on what to attach, PDF only, with progress and a named file after upload.
11. **Review** — sections listed with their answered state and a link into each; one primary submit and one line on what happens next.
12. **Submitted** — confirmation heading answering the family's question first, what happens next, and, while the amendment window is open, a clear way back into the answers.
13. **Additional questions (top-up)** — same shell, a short line naming the person and the service added, then only the missing questions.
14. **Link expired, already submitted, locked, or wrong person** — the same warm card, a plain sentence explaining the state, and where to go next. No blank screens.

## Accessibility panel

A small round wheelchair button sits in a fixed corner of the form, clear of the action bar and above the phone's safe area. Tapping it opens a soft panel with plain-language options, each a simple on or off switch:

- Larger text, in three steps.
- Higher contrast.
- Reduce movement, which removes the reveal animation.
- A readable typeface option for dyslexia.
- Underline all links and buttons.
- Read the question aloud, using the device's own speech.

The panel says what each option does in one short line, applies changes immediately, and remembers the choice on that device for the rest of the form. It is keyboard reachable, announced to screen readers, closes on Escape, and never covers the current question. The button itself carries a spoken name of "Accessibility options" rather than only an icon.



## Build steps

1. Extract the shared surface out of `RequestShell.tsx` into a reusable page surface that renders the navy cap, progress, warm card, action bar, `Question`, `Choice` and `FieldLabel`. Keep the existing modal wrapper and its three call sites unchanged.
2. Rebuild every `PreAssessment.tsx` state on that surface, preserving all existing logic: intake, routing, autosave, recipient scoping, uploads, amendments, top-ups and submission.
3. Move `CareIntakeSteps.tsx` onto the same surface, keeping current branching and wording.
4. Restyle `CareFieldInput.tsx` and `CareClinicalControls.tsx` controls to the choice-row and field patterns above, preserving every field type and the medicine-choice wiring.
5. Remove `CxJoinShell`, `CxCard` and `CxButton` from this journey and add a test that fails if they return.

## How completion is proven

No claim of completion until each is evidenced: no Candidate Portal components remain in this journey; screenshots of every state above at 320px, 393px, 430px and 1280px; the conditional reveal shown working on one screen; saved answers, recipient scoping and version pinning unchanged; keyboard, focus, labels and 44px targets checked; type check, tests and build passing; and a live link exercised then revoked with its test answers removed. Anything unfinished is listed by name.

## Contingencies

- A shared change affects Request care: keep the common surface, split modal and page wrappers, re-screenshot Request care before continuing.
- An older version 5 link is opened: new presentation, original questions and answers preserved.
- A clinical control does not fit a choice row: keep its specialised interaction inside the shared field frame rather than simplifying the data.
- Nested scrolling on a phone: one scrolling region only, never horizontal scrolling or smaller text.
- A visual change disturbs saving or routing: revert that wrapper only, keep the published questions, fix against the same test link.

## Boundaries

Presentation of the pre-assessment and the shared Request care surface only. No change to the question catalogue, the database, the clinical assessor form, or AI involvement in routing. No T8, staffing, rosters, visits, monitoring, medication administration, worker delivery, the full family portal, invoicing or payments.
