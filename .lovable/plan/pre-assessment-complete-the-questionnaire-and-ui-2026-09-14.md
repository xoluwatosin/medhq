# Pre-assessment: complete the questionnaire and UI

## What is still wrong

The visual shell changed, but the questionnaire was not completed inside it.

- The opening still asks for details already held on the care request because the loader returns only four loose pre-fill strings, not the people and services attached to the request.
- A question screen can contain three unrelated questions.
- The numbered buttons represent entire database sections, even when one section contains 23 questions. This makes one tab feel endless.
- The availability question still uses the old square stack of three date/time rows. It was not redesigned.
- Short question cards stay at the top of a navy page rather than sitting calmly in the centre of the available space.
- Two questions can repeat across applicable service sections, and newborn care currently shares a route with postnatal care for the mother.

These were missed because the earlier work changed the database questionnaire and the outer visual shell separately, then accepted isolated screens rather than completing a real form from opening details through submission.

## Recovered requirements from the earlier conversation

The following requested items are not fully proved in the current UI and must be included in this completion pass:

- **Names:** first and last name are always separate. Existing Request care and Care profile values cascade into the pre-assessment. Preferred and middle names remain separate and optional. No screen silently creates a conflicting full name.
- **Respondent-aware copy:** self-care uses `you` and `your`; someone answering for another person uses that recipient's name or `they` and `their`. A mother arranging her own postnatal care is never asked whether she knows about or wants the visit in the third person.
- **Date of birth and age:** use a proper date control. Ask approximate age only after the respondent says the date of birth is unknown. Never show both inputs together. Validate the derived age against the selected service.
- **Multi-recipient intake:** identify whether care is for the respondent, one other person or several people. Each recipient owns their identity, age, optional age-appropriate contact details and independent services. Do not add a later "say who each service is for" step.
- **Independent service choices:** Postnatal care, Newborn care and Paediatric care remain separate options. Several services may attach to one recipient, and one request may cover several recipients.
- **Alternative contact:** one grouped control containing first name, last name, relationship, phone and optional email. It is not a set of disconnected questions.
- **Medicine flow:** `Do you take regular medicines?` immediately opens the medicine list. Each entry captures medicine, adjustable amount, unit and frequency without suggesting or inventing a dose. Time-critical and refrigerated follow-ups select from the entered medicines rather than using free text.
- **Allergy flow:** a Yes answer immediately opens the structured allergy control on the same screen. Free-text other values remain possible and are never silently converted into a governed code.
- **Clinical controls:** conditions, medicines, allergies, hospital stays, treating professionals, uploads and appointment preferences use their dedicated controls rather than generic text inputs.
- **Shared questions:** address, care dates, assessment availability and consent are asked once per request where appropriate, not once per recipient.
- **Recipient isolation:** clinical answers and uploads remain attached to the correct recipient. Shared answers remain explicitly shared. No answer, upload or queued save can cross recipients.
- **Hidden answers:** changing an upstream answer removes now-inapplicable answers from progress, flags and submission. The server rejects or ignores a directly submitted inapplicable field under the documented rule.
- **Required answers:** unanswered required items are recorded for staff but do not block submission. Only the two consent confirmations block submission.
- **Review and submitted states:** review is grouped into Shared and one group per recipient, omits empty fields and internal codes, and links back to the relevant section. After submission, the same structure is readable but not editable.
- **Resume behaviour:** autosave acknowledgement, reload recovery and stable Back/Continue behaviour work after branching changes.
- **Service amendments:** adding a service before submission extends the current form. Adding one after submission but before the assessment opens only a deterministic top-up for uncovered recipient/service sections. Service removal preserves history and stops removed sections from remaining active.
- **Admin link creation:** do not ask who is filling the form or their relationship before creating the link. The existing recorded contact/request context supplies it.
- **Availability:** earlier requirements also called for real future dates and precise times, not unresolved weekday labels or generic free text. The redesigned control below will capture concrete future dates and an optional exact preferred time while still allowing Morning, Afternoon, Evening or Flexible.

Already corrected items, such as the invitation route, recipient upload binding and server reading of scoped urgent answers, will receive regression checks rather than another redesign.

## The interaction model

### 1. Opening details

If the care request already identifies the enquirer, recipients and services, show one confirmation card:

```text
Who this request covers

You
Olúwatósìn [surname]
Postnatal care

Baby [surname]
Newborn care

[Change details]                 [Confirm and start]
```

- First and last names remain separate in edit mode.
- Phone and email are shown under the enquirer.
- Each recipient shows date of birth or age, relationship and independent services.
- Missing details open only the incomplete step.
- Existing saved answers always override imported request details.

### 2. Sections and numbered navigation

- Section 1 contains only Section 1 questions.
- Its cover names the section, explains its purpose and states the number of screens.
- The numbered strip remains visible on cover and question screens.
- Selecting a number opens that section cover.
- Current, answered and not-started states remain distinct.
- Long source sections are divided into meaningful sub-sections. Each receives its own number and cover rather than leaving 15 to 23 questions under one tab.

Proposed grouping:

- Health and current care becomes: **Health conditions**, **Recent hospital care**, **Medicines and allergies**.
- When and where becomes: **Care schedule**, **Assessment address**, **Assessment availability**.
- Post-surgical becomes: **Procedure and discharge**, **Recovery needs**, **Current concerns**.
- Eldercare becomes: **Daily living**, **Memory and behaviour**, **Safety and support**.
- Additional needs becomes: **Development and communication**, **Daily support**, **Health and safety**.

These are presentation groups only. Stored question identifiers and clinical meaning do not change.

### 3. Questions per screen

- One main question per screen by default.
- A second independent question appears only when it is a natural pair, such as first and last name.
- Conditional follow-ups appear immediately below the answer that opened them, on the same screen.
- Structured lists such as medicines, allergies, conditions and availability always have a dedicated screen.
- Answering "No" removes and clears hidden dependent answers only after a clear confirmation when data would be lost.

### 4. Availability

Replace the existing square three-row control with the Request care visual language:

- One soft card per preferred date.
- A clear date field followed by Morning, Afternoon, Evening or Flexible choice buttons.
- Selecting a period reveals an optional exact preferred time; the saved value contains the concrete future date, period and time rather than an unresolved weekday.
- Second and third choices are collapsed initially and opened with **Add another option**.
- Each optional choice can be removed.
- The note remains optional below the choices.
- Dates before tomorrow remain unavailable.
- This stays assessment-visit availability, not candidate/workforce availability.

### 5. Page composition

- Replace the navy full-page background with the same light `bg-desk` surface used in Admin.
- Keep the navy cap on the form card as the brand anchor.
- On short screens, vertically centre the form card within the available viewport.
- On long screens, align it near the top with safe spacing and allow only the page to scroll.
- Keep the existing warm-white card, soft borders, numbered buttons and accessibility button.
- Never add nested scrolling or horizontal scrolling.

### 6. Movable accessibility and WhatsApp controls

The accessibility and WhatsApp buttons are both currently fixed to opposite bottom corners. Replace that rigid positioning with one shared floating-control behaviour:

- A person can press and drag either button vertically or horizontally.
- On release, the button snaps to the nearest safe screen edge rather than remaining over the form.
- Movement is constrained inside the visible browser area, including notches, safe areas and the mobile keyboard.
- The final position is remembered separately for each button on that device.
- A normal tap still opens the relevant panel; dragging does not accidentally open it.
- Keyboard users can focus a button and move it in clear increments with arrow keys while holding Alt; its accessible label explains this option.
- A **Reset floating buttons** action in the accessibility panel returns both buttons to their default corners.
- If both controls occupy the same edge, collision handling keeps them separated by at least 12 pixels.
- The accessibility button remains above form controls but below an open dialog. The WhatsApp button remains hidden on the existing signed-in routes.
- Use Pointer Events so touch, mouse and stylus follow one tested interaction model. Movement is disabled while either panel is open.

### 7. Repetition and routing corrections

- Ask swallowing/choking once per recipient even when nutrition and additional-needs sections both apply.
- Ask overlapping current-warning questions once per recipient when both post-surgical and clinical-home-care sections apply.
- Route newborn care to baby questions only.
- Route postnatal care for the mother to maternal recovery questions only.
- Preserve immediate medicine and allergy branches, generic adjustable amount/unit/frequency and selection of time-critical/refrigerated medicines from the entered medicine list.
- Keep all routing deterministic. No AI chooses questions.

### 8. Review, save and amendment behaviour

- The final review is divided into Shared plus one named block for every recipient.
- Each block has **Change** links that return to the relevant numbered section without losing later answers.
- Autosave status is announced without moving focus and remains visible in plain language.
- A reload returns to the last valid page for the current recipient and branch state.
- Submitted forms show the same grouped information without edit controls or internal vocabulary codes.
- Full, top-up and amendment links have visibly different introductions, but use the same section and question components.
- A top-up link shows only uncovered questions for the bound recipient/service combination.

## Implementation

1. Extend `care-form-load` with a structured `intake_seed` from client, contact, care-request recipient, Care person and service-intention records, keyed by `intake_recipient_key`.
2. Add pure intake seeding and completion checks in `src/lib/care-intake.ts`; never overwrite saved answers.
3. Add the confirmation/incomplete-only opening path in `CareIntakeSteps.tsx`.
4. Add a presentation grouping map and one-main-question pagination in `care-itinerary.ts`. Stable page keys continue to use section and root question ids.
5. Update `PreAssessment.tsx` so numbers point to the new presentation groups and their covers; complete grouped review, resume and full/top-up/amendment states.
6. Audit `CareFieldInput.tsx` and `CareClinicalControls.tsx` against every dedicated control above; complete grouped alternative contact, immediate branches and entered-medicine references.
7. Redesign `AppointmentPreferenceAnswer` in `CareClinicalControls.tsx` with concrete future dates, optional exact times and collapsed additional choices.
8. Refine `FormSurface.tsx` to use `bg-desk` and centre short cards without affecting long forms.
9. Add a shared movable floating-control primitive and use it in `AccessibilityPanel.tsx` and `LiveChatButton.tsx`, with independent saved positions and safe collision handling.
10. Audit the Admin pre-assessment-link action and remove any remaining respondent/relationship prompt without changing permissions or link scope.
11. Publish questionnaire routing corrections as immutable version 7. Version 6 and historical records remain unchanged.

## Completion gates

I will not report this complete until all gates pass:

- Unit tests for pre-fill precedence, incomplete intake, presentation groups, stable navigation, immediate branches, duplicate suppression and newborn/mother routing.
- Contract tests for self/someone-else wording, DOB/approximate-age exclusivity, age/service compatibility, shared/request scoping, grouped contacts, hidden-answer exclusion, required-as-a-flag and consent-only blocking.
- Full typecheck, test suite and production build.
- A real version 7 link tested at 320, 393, 430 and 1280 pixels.
- Browser walkthrough of: pre-filled opening, edit path, every numbered cover, medicine yes/no branch, allergy yes/no branch, availability, back/forward navigation, resume, review and submission.
- Touch, mouse and keyboard checks for moving both floating buttons; verify snap-to-edge, persistence after reload, collision avoidance, reset and tap-versus-drag behaviour at every mobile width.
- No horizontal overflow, nested scroll, console errors or hidden-answer reappearance.
- Database verification that each recipient's answers and uploads remain scoped to that recipient.
- A generated audit report listing the exact visible questions for self-care, one adult, one child, mother/newborn, several babies and multi-service/multi-recipient scenarios, with duplicates and incorrect pronouns flagged.
- Full, top-up and amendment links tested separately, including service addition/removal and visit-start locking.
- Admin link creation checked to prove it does not ask the redundant respondent or relationship question.
- Test link and draft records removed.
- Deployment status stated explicitly; no claim that it is live before publication.
