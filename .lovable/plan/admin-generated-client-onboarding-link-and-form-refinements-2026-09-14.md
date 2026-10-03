# Admin-generated client onboarding link and form refinements

## Goal

Change **Add client** in Admin so staff can choose either:

1. **Enter details manually** using the existing client form.
2. **Generate link** for a person to enter their details, add every care recipient and select each recipient’s services, then continue directly into the full pre-assessment.

Also correct the pre-assessment section-cover colours and make appointment preferences use explicit one-hour slots.

## Journey logic

```text
Admin selects Add client
├── Enter details manually
│   └── Existing manual client creation remains unchanged
└── Generate link
    ├── Create a secure, expiring onboarding link without a placeholder client
    ├── Staff copy the link or send it using supplied contact details
    └── Recipient opens link
        1. Enquirer first name, last name, phone and email
        2. Who the request is for: self, another person or several people
        3. Whether the enquirer also needs care, when several people are selected
        4. Each care recipient: first name, last name, DOB or approximate age,
           age-appropriate optional contact details, relationship and services
        5. Confirm people and services
        ├── Create the Care group, request, people, recipient clients,
        │   recipient rows and service intentions as one transaction
        └── Continue on the same link into the routed pre-assessment
```

The opening details are saved and then reused. The pre-assessment must not ask for the same identity, recipient or service information again.

## Implementation

### 1. Add a pending onboarding-link record

- Add an auth-only table for pending onboarding links with: token hash, expiry, revocation, first-opened/completed timestamps, creator, delivery state and saved intake.
- Grant access only to authenticated staff and the service role, enable RLS, and use existing Admin role checks.
- Store only the token hash. Return the plain link once, as the current pre-assessment links do.
- Do not create a placeholder client, person, family or request merely to obtain a link.
- Add an Admin-only creation endpoint plus public token-validated load/save endpoints with expiry, revocation, rate, size and payload validation.

### 2. Add the Admin choice

- Make the existing **Add client** action open a two-option chooser: **Enter details manually** or **Generate link**.
- Preserve the current manual form and its behaviour.
- The generated-link view shows expiry, copy and revoke controls. Email or WhatsApp delivery is offered only when staff supply a destination; generating and copying the link does not require staff to know the person’s name.
- Add pending and completed onboarding links to the relevant Admin work surface, with direct status labels and no empty client record in the Clients list.

### 3. Reuse the established intake

- Reuse the existing five-stage intake, formal copy, required first and last names, independent service choices and durable request-local recipient keys.
- Require enquirer email, as required across the care-request journey.
- Validate DOB and approximate age as alternatives, and retain deterministic age/service conflict handling.
- Autosave the pending intake against the onboarding token. Resume on the last valid stage on another device.
- Prevent access after expiry or revocation and make completion idempotent.

### 4. Materialise records safely after confirmation

- Add one transactional database function that creates or links the exact existing Care records only after the person confirms the intake.
- Create one immutable Care person per submitted person, a Care group, one Care request, one recipient client/recipient row per care recipient, and service intentions allocated directly to those recipients.
- Use email and phone only to flag possible matches. Never automatically merge people, reuse a client, attach an auth identity or grant family access.
- Preserve immutable Care person IDs and keep the enquiry/request, clinical and finance scopes separate.
- Bind the same browser journey to a normal full pre-assessment token and the current published questionnaire, then continue without asking the intake again.
- If record creation partially fails, roll back the whole transaction and leave the onboarding link resumable.
- If the same confirmation is retried, return the already-created request and token rather than creating duplicates.

### 5. Preserve downstream behaviour

- Continue using the current deterministic questionnaire routing, recipient-scoped answers, recipient-scoped uploads, urgent-answer flags and finalisation workflow.
- Do not use AI to choose questions or infer identity.
- Do not grant portal access, merge possible duplicates or send invitations automatically.
- Surface possible duplicate signals to staff for review without blocking the family’s pre-assessment.

### 6. Correct section cover pages

- Apply the correction to section cover pages in both pre-assessment and professional assessment wherever the shared treatment is used.
- Make every title, section number, recipient label, count and supporting line on navy explicitly white or white at a readable opacity. Remove grey, black and other dark text from navy surfaces.
- Add restrained Medic Connect watermarks to the navy area using decorative, non-interactive shapes or brand marks at low white opacity.
- Keep watermarks behind text, hide them from assistive technology and ensure they never reduce contrast or obscure content.
- Preserve the existing full-page layout and numbered section navigation.

### 7. Make appointment time selection explicit

- Keep the deterministic sequence: selected weekdays → selected periods → matching future dates → exact time.
- Label periods with their ranges:
  - Morning: 8:00 am to 12:00 pm
  - Afternoon: 12:00 pm to 4:00 pm
  - Evening: 4:00 pm to 8:00 pm
- After a date is selected, show one-hour appointment slots inside the chosen periods, for example **8:00–9:00 am**, **9:00–10:00 am**, **10:00–11:00 am** and **11:00 am–12:00 pm**.
- Use non-overlapping boundary slots for afternoon and evening in the same way.
- Save the exact start and end time, not just “morning”, “afternoon” or “evening”, and show that exact slot in review and Admin read-back.
- When weekdays or periods change, remove dates and times that are no longer valid rather than retaining hidden stale answers.
- Keep up to three ranked preferences, each with its own matching date and exact slot.

## Technical details

- Extend the existing Care token architecture additively rather than weakening the current non-null client binding.
- Keep pending onboarding tokens separate from ordinary pre-assessment tokens until intake confirmation.
- Use a security-definer transaction for materialisation with a fixed search path, explicit input validation and an idempotency key tied to the onboarding record.
- Any new public-schema table receives explicit authenticated/service-role grants before RLS policies. Anonymous users access onboarding only through token-validating functions.
- Centralise appointment-period definitions and exact slot generation so browser display, saved values, validation and read-back use the same source.
- Do not change Care lifecycle rules, Candidate Portal/Match Universe behaviour, permissions, existing route meanings, professional assessment logic or finance.

## Contingencies

- **Possible existing person/client:** create no automatic link or merge; add a staff-review signal showing the matching email/phone evidence.
- **Expired or revoked link:** show a direct status message; Admin can generate a new link without copying incomplete records.
- **Link opened twice:** both sessions load the same pending intake; writes remain idempotent and last valid save wins.
- **Confirmation retried after a timeout:** return the previously created request and continue, without duplicate people or clients.
- **Service becomes unavailable before confirmation:** stop confirmation, identify the unavailable service and preserve all other entered details.
- **No selected weekday or period:** do not invent dates or times; keep the appointment preference incomplete and explain which earlier choice is needed.
- **No valid future dates in the search window:** offer a later-date expansion, not an unrelated calendar date.

## Completion gates

1. **Database and security**
   - Verify grants, RLS, Admin-only management, hashed tokens, expiry/revocation and atomic idempotent materialisation.
   - Confirm no placeholder clients exist before intake confirmation and no automatic identity merge or portal grant occurs.

2. **Logic tests**
   - Test self, another person and several-person branches.
   - Test separate first/last names, required email, recipient keys, multiple services, age conflicts, duplicate signals and retry safety.
   - Test weekday/date filtering, one-hour slot generation, boundary labels, stale-slot removal and exact-time read-back.

3. **End-to-end browser checks**
   - As Admin: choose both Add client paths, generate/copy/revoke a link and see accurate pending/completed status.
   - As recipient: complete a populated multi-recipient journey, continue into pre-assessment without repeated intake questions, save, resume and submit.
   - Verify section-cover text and watermarks visually at 320, 393, 430 and 1280 px, including high-contrast and larger-text accessibility settings.
   - Confirm no overflow, clipped controls, nested scrolling, page errors or console errors.

4. **Regression and release**
   - Run focused tests, full tests, type checking, migration checks and production build.
   - Deploy the new functions, exercise them against a disposable onboarding link, verify created records and then remove the disposable data.
   - Report separately what was changed, what was deployed, what was tested live and any check that could not be completed.
