# Changing or adding a service after the pre-assessment

## What happens today (checked in the code and database)

- Staff can add, edit or remove a service on a care request at any time. Nothing reacts to that change.
- A request can hold only one live pre-assessment. Once the family sends it, their answers are frozen and the link accepts nothing further. There is no way to reopen it or to ask only the new questions.
- Link creation does not check whether the services have changed since the last link was sent.
- At the visit, an assessor can refresh which questions apply, with a reason recorded, but only while the assessment is still being written. Nothing tells them a service was added, and nothing exists for a service requested during the visit.

So adding a service before the family sends works by accident; everything after that is unhandled.

## The one rule

The family can change their answers up to the moment the assessment visit starts. After that, the visit is where things change.

## The logic, stated exactly

Trigger: a service is added, changed or removed on a request.

| State of the pre-assessment | State of the visit | What happens |
| --- | --- | --- |
| Not sent yet (link open) | Not started | The new sections appear in the form the family already has. No new link. |
| Sent | Not started | Request shows "not covered yet". Staff send a top-up: only the new service's questions, for that person. |
| Sent, family amending | Not started | Same as above. Amendments continue as normal. |
| Sent | Visit open, assessment being written | Assessor is told; the new sections open inside that same assessment, with a reason recorded. |
| Sent | Assessment already sent | Nothing is edited. The service is confirmed in the office and a short follow-up assessment is opened for it. |

Removing a service: its questions and answers disappear from view but are kept in the record. Nothing is deleted.

Coverage test, run on every service change:

```text
required sections = deterministic rules applied to the request's current services, per person
answered sections = sections present in that person's sent pre-assessment
gap             = required − answered
gap empty  → nothing to do
gap present → "Not covered by the pre-assessment yet", listing person and service
```

No AI decides which questions appear. The same rules that route the form today produce the gap.

Amendment window:

```text
family sends  → status: sent, still amendable
visit opens   → status: closed, link becomes read-only
```

Every amendment records field, previous value, new value, who and when. The version they first sent is kept intact.

## The screens

**1. Request record, services panel (staff)**
Unchanged layout. Below the service list, one notice card in the existing style when a gap exists:
"Not covered by the pre-assessment yet — Baby A, paediatric care." One action: Send top-up questions. When there is no gap, the card is absent — no green ticks, no extra clutter.

**2. Pre-assessment panel (staff)**
Adds two facts to what it already shows: whether the family can still amend, and, once a top-up exists, a second line reading "Top-up sent, 3 questions, not yet returned". It stays one panel about one pre-assessment; a top-up is never listed as a separate form.

**3. The family's form**
No new screen type. A top-up opens on a cover page reading "A few more questions about Baby A", then the new sections in the existing style, then send. Sections they already completed are not shown.

After sending, the same link opens the read-only summary they have today, with one added line at the top: "You can still change these answers until the assessment visit." Each section keeps an Edit action until the visit opens, at which point the line changes to "Changes are now made with the nurse on the day" and the Edit actions disappear.

**4. The assessor's workspace**
One line under the visit heading: which services this visit covers, and, if applicable, "Paediatric care was added after the family answered." If the assessment is still being written, the same line carries the action Include this service, which asks for a short reason and then opens the sections.

A small action, Family asked for another service, records person, service and note. It writes a proposed service back to the request. It never confirms a service and never touches pricing.

## Why this does not cause confusion

One pre-assessment per request, always. A top-up is part of it, not a second form. One visit, one assessment, unless the assessment has already been sent, in which case history is never rewritten. Staff see gaps only when there is a gap. Families are told plainly when they may still change things and when they may not.

## Technical notes

- Migration: `care_questionnaire_sessions` gains an amendment state closed by `care_assessment_start`, plus `parent_session_id` and `scope` so a top-up is a child of the sent session; the one-live-session index allows one live top-up. New amendment log table records field, previous value, new value, author, time.
- `care_service_intention_set` / `_remove` gain an after-trigger writing a coverage result read by the request readiness summary.
- Coverage derives from the existing deterministic section rules compared against answered sections; no schema change to published definitions, and v5/v6 documents read unchanged.
- Assessor-requested services use a new controlled function writing a `proposed` intention plus an assessment event. Existing freeze and `care_assessment_reroute` rules are reused, not replaced.
- Tests: amend-then-visit-starts locking, top-up covers only the gap, consent not re-asked, sent answers preserved, removed service retained, assessor request lands as proposed only, follow-up assessment leaves the sent one untouched.

## Not included

Pricing or proposal changes arising from a new service, T8 packages, staffing, rosters, visits, invoicing.
