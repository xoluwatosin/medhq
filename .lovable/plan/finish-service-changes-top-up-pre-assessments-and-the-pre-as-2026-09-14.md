# Finish service changes, top-up pre-assessments and the pre-assessment UI

## Outcome

Complete the unfinished service-change journey without starting T8 or redesigning the assessment system:

- A service added before submission extends the current pre-assessment.
- A service added after submission creates a short top-up for the correct care recipient.
- A family can correct submitted answers until the assessment visit starts.
- An assessor can record a newly requested service during an open assessment, with a reason.
- The entire pre-assessment uses the same visual language as the native Request care cards.

## 1. Stabilise the unfinished work first

- Review migrations `0079` and `0080` and correct the coverage, amendment and assessor-service functions before adding more interface work.
- Replace name-based top-up recipient matching with an authoritative request-recipient to intake-recipient binding. Never fall back to the first person.
- Bind every link to its exact draft or submitted pre-assessment document so a full form, top-up and amendment cannot accidentally load or update another document.
- Make top-up coverage compare the new service against the services already covered for that recipient, not merely against record creation dates.
- Treat removed or declined services as historical evidence: exclude their questions from an active journey without deleting answers or audit history.
- Lock family amendments when the assessment visit has actually started, including a scheduled record with `started_at` set.
- Validate amendments with the same field contract and controlled vocabularies as ordinary saves. Reject fields outside the selected section or recipient.
- Make submission retry-safe and confirm that an empty final submit payload still finalises the already-saved answers.

## 2. Deterministic form logic

Keep question selection entirely rule-based. Lovable AI or Claude will not decide which clinical question appears.

```text
Open link
  |
  +-- Full pre-assessment, not submitted
  |     -> intake if not already established
  |     -> shared request sections once
  |     -> each recipient's applicable sections
  |     -> review and send
  |
  +-- Top-up
  |     -> load the existing intake and recipient binding
  |     -> omit intake and shared questions
  |     -> calculate sections introduced by the added service
  |     -> ask only those missing sections for that person
  |     -> review and send
  |
  +-- Submitted, visit not started
  |     -> read-only summary
  |     -> edit one section at a time
  |     -> record an audited correction
  |
  +-- Visit started
        -> read-only summary
        -> changes made with the nurse during the assessment
```

- Recompute the itinerary immediately after every answer.
- Keep each branching question and every follow-up it opens on the same screen.
- Keep conditions, medicines, allergies, uploads, repeating controls and appointment preferences on their own screens.
- If a branch closes, remove its hidden answers from the active payload or explicitly retain them as inactive history, consistently in browser and server validation.
- Resolve a changed itinerary to the current valid question, its section cover or the nearest valid page, never to a blank screen.
- Preserve separate answer namespaces for each recipient and pass the bound recipient through uploads.

## 3. Pre-assessment visual rebuild using the native Request care files

Use `/mnt/user-uploads/Medic_Connect_Request_Care.html` as the primary visual source and the `Copy_of_MEDIC_CONNECT.zip` element files as supporting references. Reuse the implemented Request care patterns in `RequestShell.tsx` rather than inventing another form style.

### Shared shell

- Soft blue canvas behind one centred warm-white form shell.
- Soft 22 to 24px outer corners, restrained navy-tinted shadow and no cream analogue boxes.
- Compact navy cap with the real Medic Connect lockup, form label and one faint brand watermark.
- Segmented progress immediately below the cap, with the current section and save state written plainly.
- One scrolling content area and one stable action footer. No nested scroll areas.
- On phones, respect safe areas, use the full available width with a small outer gutter and keep every target at least 44px.

### Intake and question cards

- Convert intake, section covers, question pages, review blocks, upload controls and correction views to the same Request care card family.
- Use white choice rows with hairline borders, a soft-blue selected state and a clear circular selection mark.
- Use compact field labels, 16px inputs on phones and direct validation beneath the relevant field.
- Show newly opened follow-ups directly beneath their parent question with the same short entrance transition used by Request care.
- Keep no more than three independent question clusters on one screen.
- Give every section cover one navy emphasis area, its number, person name where relevant, title, short introduction and one primary action.
- Make the numbered section rail interactive, horizontally scrollable without page overflow, and clearly distinguish current, visited and not-yet-visited sections.
- Use the same design for full forms and top-ups. A top-up changes the wording and scope, not the visual system.

### Review and submitted states

- Group review as Shared, then each care recipient by full name.
- Show readable labels and values only, never internal codes or empty rows.
- Provide one quiet Edit action per section.
- Submitted forms use the same shell and cards, with either the amendment message or the visit-started lock message.
- Errors use an action-needed card with the failure and next step. Loading, saving and saved states must not move the layout.

## 4. Office workflow

- Keep the existing Services area on the care request.
- Show one calm action-needed notice per recipient when services are not yet covered, naming the recipient and service or services.
- Offer one action: `Send top-up questions`.
- After sending, show sent state, date and delivery outcome; prevent accidental duplicate sends while retaining an explicit resend action.
- Use top-up-specific email wording and subject. The email must state whose care and which added service the questions concern.
- If email delivery fails, keep the link available for copy or WhatsApp rather than reporting success.
- Surface supporting-list load failures instead of silently showing empty selectors.

## 5. Assessor workflow

- Add a compact service coverage area near the assessment heading: covered before the visit, top-up outstanding, or requested during the visit.
- While an assessment is still draft or in progress, allow `Include this service` with a required reason. Add the applicable assessment sections to the same assessment without altering pricing.
- Add `Family asked for another service` using the existing service list and a required note.
- Record the service as proposed and audit who recorded it, when and why.
- If the assessment has already been submitted, preserve it and create the linked follow-up assessment path rather than reopening the submitted document.
- Preserve the current offline-first capture and submission behaviour.

## 6. Verification and acceptance

### Automated checks

- Unit tests for deterministic branching, immediate follow-ups, stable page keys and no blank pages.
- Tests for full versus top-up scope, exact recipient binding, multiple recipients with identical names, multiple services per person and request-wide questions appearing once.
- Server tests for token/document authority, amendment cut-off, controlled-value validation, service removal history and top-up coverage completion.
- Upload tests proving every file is filed against the bound recipient.
- Assessor tests for include-service, family-requested service, required reasons, submitted-assessment follow-up and audit events.
- Existing Care tests, type checking and production build.

### Browser walkthroughs

- Full single-adult pre-assessment.
- Mother and twins with shared questions once and person-specific answers separated.
- Medicine and allergy branches appearing immediately on the same screen.
- Service added before submission, after submission and during assessment.
- Top-up opening for the intended recipient only, including two recipients with the same name.
- Submit, reopen, amend before visit, then verify editing is locked after visit start.
- Upload, reload/resume, interactive section navigation and review editing.
- Visual checks at 320px, 390px, 430px and desktop, with no clipping, nested scrolling, overlap or horizontal overflow.

## Delivery order

1. Correct and test link, document, recipient and coverage authority.
2. Finish full/top-up/amendment behaviour and top-up delivery wording.
3. Rebuild the pre-assessment presentation from the native Request care shell and card elements.
4. Finish the office coverage states.
5. Add the bounded assessor service-change controls.
6. Run database, function, unit, build and populated browser acceptance checks, then deploy the changed functions.

## Out of scope

No package agreement, pricing changes, staffing, matching, roster, visits implementation, monitoring, medicine administration, worker portal, full family portal, invoicing, Paystack or broader professional-assessment redesign.
