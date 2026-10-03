# Care record foundation: person spine, household context and governed workflows

## Outcome

Rebuild Care around connected **person records**, **household records** and **care requests**, using the selected **Structural clinical sidebar** skin. Preserve the existing clinical and operational controls, consolidate related navigation, map every pre-assessment answer to the correct on-screen context, and make Finance a complete client-linked workflow.

## Confirmed current position

- Submitted pre-assessment answers are immutable source evidence. Family and staff corrections already sit beside the original answer in `care_response_amendments`, with the previous value, corrected value, section, amendment session, actor and timestamp. Family changes are accepted through the same link until the assessment starts; staff corrections require a reason.
- The questionnaire currently distinguishes intake, request-wide and recipient answers and classifies what carries into assessment. It does not yet define where every answer should be displayed across Person, Household, Care request, Assessment and Finance views.
- No current Care process promotes questionnaire answers into verified person or household details. This work will not introduce that behaviour.
- The internal care plan and client proposal are separate governed records with different audiences, permissions and version histories.
- Paystack invoice creation, sending, payment verification and cancellation already exist in a separate Finance area. The Care record currently shows only budget band and assessment-fee state and is not connected to those invoices.

## 1. Selected Care workspace skin

Apply the selected **Structural clinical sidebar** direction using existing Medic Connect design tokens and components:

- Figtree typography.
- Clinical-white canvas, pale-blue working areas, Medic Connect navy and brand blue.
- Softly squared brand-kit surfaces, fine rules and restrained shadows.
- Person identity, Care reference, household and key relationship anchored above the working area.
- Left record navigation on desktop and a compact section selector on mobile.
- No invented facts, generic dashboard styling, gradients or decorative animation.

## 2. Exact navigation and functionality

```text
Overview
Household
Care journey
  Care requests and tasks
  Pre-assessment
  Assessment
  Clinical review
  Care plan
    Working plan
    Client proposal
People and access
Finance
Activity
```

Existing URLs and aliases continue to work.

### Overview

The decision screen for the record:

- identity, Care reference, stage and service
- household and principal relationship context
- next required action and outstanding work
- active flags and important recent activity
- hold, resume, close, reopen, archive and restore controls for authorised staff

It does not repeat every demographic field or every answer.

### Household

The shared-care context:

- household members, roles and directional relationships
- shared address and practical arrangements
- current and previous joint care requests
- recipients and services within each request
- shared appointments and request-wide documents
- direct links to each individual person record

A household is not a substitute person record. Relationship and membership never grant access.

### Care requests and tasks

The operational record of what was requested and what must happen next:

- service intentions by recipient
- request status and lifecycle history
- required work, ownership, due dates and outcomes
- deterministic routing and readiness checks
- request hold, close and archive actions where permitted

### Pre-assessment

The immutable submitted evidence, organised without changing it:

- **Submitted answers** grouped into Request information, Household information, Enquirer information and a named section for each care recipient
- **Answer context** showing the record context in which the answer is relevant
- **Revision history** shown beside the original answer, grouping all changes from one reopening/edit session and showing previous value, new value, actor and time
- **Staff corrections** shown separately with the required reason, author and time
- **Unmapped legacy answers** shown for configuration review, never guessed or discarded

Formal labels use record nouns, for example **Context: Care recipient — Oluwabukayomi Bolanle**, **Context: Belewu household** and **Context: Care request**. The interface will not use phrases such as “Filed to Bukayo's person file”.

### Assessment

Assessment operations only:

- scheduling, assignment, rescheduling and cancellation
- captured assessment versions and visit history
- clear readiness state based on returned pre-assessment evidence

Clinical conclusions remain in the captured assessment and review workflow, not in scheduling controls.

### Clinical review

The governed review of a submitted assessment:

- review checklist and professional notes
- accept or return with category, reason, instructions and priority
- reviewer, date, decision and version history
- accepted evidence carried forward into the working care plan

### Care plan

One navigation area with two separate governed views.

#### Working plan

The internal clinical and operational record:

- versioned sections, needs, goals and care tasks
- written by authorised clinical staff while in draft
- approved by either an authorised clinician or coordinator
- approval records actor, role, date, version and decision
- issued versions remain immutable; amendments create a new version

#### Client proposal

The controlled family-facing extract:

- prepared server-side from an approved working plan
- excludes internal risk and safeguarding material
- separately versioned with its own recipients, sends, comments, responses and withdrawal history
- prepared and sent by authorised coordinators
- available only to recipients with the required recorded access

The proposal is not temporary or deleted after acceptance. It remains the permanent record of what was presented and agreed. It is consolidated under Care plan in navigation, but not merged with the internal plan in storage or permissions.

### People and access

Identity, relationships, contact roles and authority:

- individual details and communication information
- linked people and directional relationships
- contact roles, including the main and billing contacts
- recorded authority or consent basis
- invitations and journey, clinical and finance access grants
- suspension, revocation and access history

A relationship label alone never creates an account or grants access.

### Finance

The financial workspace for this care arrangement:

- budget band and assessment-fee status
- recorded contacts eligible to receive financial documents
- quotes and estimates with line items, totals, expiry and status
- accepted quotes automatically create an invoice from the accepted version and preserve the quote-to-invoice link
- invoices: create, issue, email, share, view, verify payment, cancel and view history
- payment status and Paystack reconciliation
- credit notes, refunds and payment adjustments, each linked to its originating invoice
- immutable financial document versions and a complete audit trail

Before issuing any quote or invoice, staff select a recorded contact as recipient. This foundation does not add a permanent payer-arrangement model. Finance remains restricted from clinical users without finance permission.

### Activity

A readable audit history:

- action, actor, role, date and time
- reason where required
- affected person, household, care request or financial document
- previous and resulting state where relevant
- filters by workflow area and record

The screen will use canonical labels rather than raw stored action keys.

## 3. Person record

The person record is the primary record for one individual:

- immutable Care person reference and identity
- contact, communication and accessibility details
- roles and relationships in each care arrangement
- recipient-specific submitted evidence and accepted clinical evidence
- linked care requests, documents, access, finance permissions and activity

For this case, Oluwabukayomi Bolanle's record identifies the Belewu household and Oluwatobi Belewu as parent or guardian and enquirer. Oluwatobi's own details remain associated with Oluwatobi.

## 4. Household record

Use a household when people share a home, practical arrangements or a joint care request. It contains:

- members, roles and directional relationships
- shared address and household circumstances
- joint care requests and all named recipients
- request-wide pre-assessment evidence and documents
- shared appointment and practical arrangements
- combined activity with links to each person and request

Shared answers are displayed once. Recipient-specific answers remain under the named recipient even when the care request is joint.

## 5. Complete answer-context map

Every question in the current published pre-assessment definition receives required, versioned metadata:

1. **Subject** — enquirer, named care recipient, household, care request, service intention, appointment or finance.
2. **Display context** — Person, Household, Care request, Assessment or Finance.
3. **Cardinality** — once per request, once per household, once per recipient, once per recipient-service pair or repeatable.
4. **Visibility** — client, internal or restricted.
5. **Carry behaviour** — clinical evidence, context, operational, authority/consent or not carried.

Mapping is contextual display only:

- it never updates verified person or household details
- it never creates relationships, access grants or financial responsibility
- it never merges identities
- email and phone remain matching signals only
- raw submissions and amendments remain the source evidence
- there is no profile-conflict workflow because questionnaire answers do not update verified records
- historical submissions use the map attached to their frozen questionnaire version

Publication validation fails if any question lacks valid context metadata. Legacy answers that cannot be mapped safely are shown as **Context not configured** for administrative correction of the map, without changing the answer.

## 6. Pre-assessment revision audit

Keep the existing amendment ledger and add the missing event-level audit around it:

- **Form submitted** records the submission number, time, respondent/link and outstanding required answers.
- **Form reopened** records who reopened it, when and the reason where a staff action initiated the reopening.
- **Changes submitted** records one revision event for the edit session and links every changed field from that session.
- Each field change shows question label, previous value and new value. Unchanged answers are not repeated.
- Family revisions remain available only until the assessment starts. After that point, changes are recorded within assessment evidence or as reasoned staff corrections, preserving the clinical cutoff.
- Repeated submissions with no changed answers are recorded only as delivery retries when relevant; they do not create false revisions.
- The original submitted response payload remains unchanged. The effective display is the original answer plus the ordered amendment history.

The Pre-assessment screen presents a chronological **Revision history** and Activity contains concise events linking back to the affected submission.

## 7. Workflow and lifecycle

The visible lifecycle remains:

```text
Enquiry
Care request
Pre-assessment
Assessment
Proposal
Care started
On hold
Closed
Archived
```

Clinical review and working-plan approval are governed steps within Assessment and Proposal preparation, not competing client stages. Stage changes are server-controlled, reasoned where required and recorded in Activity.

## 8. Technical implementation

- Extend the frozen questionnaire definition contract with validated field-level subject and display-context metadata.
- Add server-side answer-context resolution; browser code renders the resolved result but does not decide ownership.
- Do not create answer-projection rows that impersonate verified person, household, consent or finance facts.
- Extend the existing amendment provenance with explicit form-submitted, form-reopened and revision-submitted events, linked to the amendment session and recording actor, timestamp and field-level before/after values.
- Preserve separate journey, clinical and finance scopes and enforce each on protected reads and writes.
- Keep the working plan and client proposal as separate versioned records while presenting them in one Care plan navigation area.
- Add an auditable approval action that either authorised role may perform; proposal preparation requires an approved plan version.
- Connect existing Paystack invoice records to the Care Finance view and add governed quote, quote acceptance, credit-note and refund records through additive migrations.
- Quote acceptance automatically creates a draft invoice from the accepted quote version. Issuing or sending the invoice remains a separate authorised action so staff can verify recipient and totals.
- Use security-definer functions for controlled lifecycle, approval and finance actions; add grants and RLS to every new public table.
- Centralise navigation, destination, status and activity labels.

## 9. Verification

- Audit every current pre-assessment question and prove it has one valid subject, context and cardinality rule.
- Verify the Tobi/Bukayo case: enquirer answers display under Oluwatobi, recipient answers under Oluwabukayomi, shared arrangements under Belewu household and request facts under the joint care request.
- Test self-care, one enquirer with multiple recipients, postnatal plus newborn, different services per recipient and repeatable clinical answers.
- Verify no mapped answer changes a verified record, relationship or access grant.
- Test initial submission, family reopening, multiple changed fields in one revision, repeated edits, unchanged resubmission, staff correction with reason and the assessment-start cutoff; confirm the full chronology and before/after values.
- Test plan approval by each authorised role and confirm the complete audit record.
- Test proposal preparation, controlled recipients, sends, responses, comments, withdrawal and version history.
- Test quote creation, acceptance-to-draft-invoice conversion, invoice issue/send/payment verification/cancellation, credit notes and refunds against the correct Care record and recipient.
- Verify all sections, existing deep links, permissions and lifecycle actions on desktop and mobile.

## Boundaries

No changes to Heard, Match Universe, Workforce or the public care-request form layout. No automatic identity merge, answer-to-profile update, relationship-based access grant, silent overwrite or database-key rename. Staffing, rosters and visits remain outside this work.
