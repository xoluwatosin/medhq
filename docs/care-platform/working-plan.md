# Working plan: from what exists to paid care running in Lagos

Written 10 October 2026 from a full audit of every tranche (1 to 12, Pass 7.5, and build steps 0 to 9 of `apps-and-operations-plan.md`) against the code, the migrations and the live database. Where this document and `roadmap.md` or `implementation-plan.md` disagree, this one reflects what was found; those two are out of date (see section 6).

## 1. Where we are

**Live data, 10 October 2026**

| Area | What is there |
| --- | --- |
| Clients | 13: 4 enquiries, 2 awaiting pre-assessment, 2 pre-assessments received, 5 closed. No full assessment, no care plan, no running care. |
| Services chosen | Postnatal and Omugwo 4, eldercare 3, newborn 2, clinical home care 1, post-surgical 1, care from abroad 1 |
| Workforce | 5 staff, all office-based; 389 in the talent pool. No field carers. 2 clinical assessors. |
| Commercial | 8 care offers (5 accepted, 3 sent); 4 offer instalments |
| Forms | 16 pre-assessment versions, 2 assessment, 1 care plan |
| Delivery | Service configurations, episodes, visits, observations: all empty |

**What is solid and in use**

- Website enquiry to client record, with the service mapped correctly.
- Care families, groups and people, with staff-reviewed duplicate matching.
- Family access model: grants by scope (journey, clinical, finance) backed by a recorded legal basis; portal invitations and acceptance.
- Work items and the derived client stage (no direct stage writes left in the app).
- Pre-assessment links, assessment scheduling, and the offline assessor workspace.
- Clinical review checklist, care plan drafting and approval.
- Care offers with e-signature, Paystack card payment and monthly instalments.
- Talent pool, verification, documents, contracts and HR (leave, probation, reviews).
- Since 10 October:
  - care-worker app access;
  - monitoring plans and delivery records (database only);
  - roster patterns, visits, and check-in and check-out with location;
  - the Today board, live alerts and the emergency button;
  - journey sharing and the live map.

**What blocks real care today**

1. **No service is set up.** Care cannot start until its service has a published configuration. None is published, there is no screen to publish one, and there is no agreed list of what a configuration may contain. Until this is fixed no carer can check in.
2. **A care plan can never be issued.** This is deliberate: the issue check refuses until packages, staffing, medicines and Clinical Lead approval exist.
3. **Nothing links what the family paid for to the care that runs.** There are no care packages. Care can be opened for a client who has agreed and paid nothing.

## 2. Things that are wrong now (fix first, whatever else we do)

These are faults in live code, not missing features.

| # | Fault | Risk | Where |
| --- | --- | --- | --- |
| 1 | The Paystack webhook can set a paid invoice back to unpaid if a late or retried event arrives | Paid families chased; books wrong | `supabase/functions/paystack-invoice-webhook` |
| 2 | Confirming a payment accepts any successful Medic Connect transaction that carries no invoice id, of at least the amount, as payment of a different invoice; one reference can be reused across invoices; currency not checked | An invoice marked paid that was not | `supabase/functions/_shared/care-payment.ts` (`confirmCarePayment`) |
| 3 | Payment-request success is trusted without checking the amount | A part payment marked paid | webhook |
| 4 | Invoice numbers are the date plus four random digits, with no uniqueness | Duplicate numbers: a tax and audit problem | `supabase/functions/paystack-invoice` |
| 5 | Issuing an invoice twice at once creates two Paystack requests | Double billing | `paystack-invoice` `issue` |
| 6 | Several billing functions check only "is an admin", not the finance or coordinator area | Any admin can bill | `paystack-invoice` create, `send-invoice-email`, `care-offer-send`, manual `care-offer-billing` |
| 7 | Sending a care proposal fails: it records a notification kind the table does not allow | Proposals cannot be sent (none sent yet, so unnoticed) | `care_proposal_send`, `care_notifications` check |
| 8 | Any admin can write family access tables (people, grants, bases) and work items directly, skipping the coordinator rules, reasons and audit | Access changed with no trail | table grants and "Admins manage" policies |
| 9 | "Add staff" and the staff page write `is_staff`, `staff_status` and `work_setting` directly, so someone can become a field carer without a signed contract | Unsigned workers sent into homes | `Workforce.tsx`, `WorkforceStaff.tsx` |
| 10 | Booking a carer checks app access, assignment and clashes only: not licence or police-check expiry, leave, or availability | Expired or unverified carers rostered | `private.care_visit_person_check` |
| 11 | A visit someone forgot to check out of cannot be closed, and a late check-in cannot be recorded by the office | Visits stuck "in progress"; no attendance record | `care_visit_close` |
| 12 | Document expiry runs only when someone presses a button; nobody is warned before a credential expires | Silent expiry | `mu_expire_documents` |

## 3. The plan

Four phases. Each item is small enough for one reviewed pull request, tested on live data before merge, as we have done since 10 October.

### Phase A: make it safe (about 1 to 2 weeks)

1. **Money safety** (faults 1 to 6):
   - a payments ledger that stores every Paystack event;
   - a unique reference per payment;
   - a paid invoice never goes back to unpaid;
   - amount, currency and invoice id checked on every path;
   - invoice issue claimed atomically;
   - sequential invoice numbers;
   - finance and coordinator areas checked inside the functions;
   - a "record a bank transfer" action with an audit trail.
2. Fix proposal sending (fault 7).
3. Close direct writes to the access tables and work items, so changes go only through the functions (fault 8).
4. Guard the Workforce columns so field work needs a signed contract (fault 9).
5. Visit recovery for coordinators: close an in-progress visit with a reason, and record attendance after the fact (fault 11).
6. Credential, leave and availability checks when booking and assigning carers; expiry run nightly with warnings 30 and 7 days ahead (faults 10 and 12).

### Phase B: the first paid client, end to end (about 4 to 6 weeks)

Goal: one postnatal and one eldercare client, from enquiry to a family seeing visit summaries and paying.

7. **Service set-up:**
   - an agreed list of modules (for example `safeguarding`, `escalation`, `daily_log`, `goal_evidence`, `monitoring`, `maternal_monitoring`, `newborn_care`, `feeding_support`) with validation;
   - a screen to draft and publish a service;
   - eldercare and postnatal published first.
8. **Care packages:**
   - an accepted, paid offer becomes the package: service, hours, pattern, rate and dates;
   - care can open only against an agreed package;
   - shifts are only offered for paid care.
9. **Plan issue:** replace the refusal with the real checks (package agreed, staffing confirmed with cover, Clinical Lead approval), then issue.
10. **The shared offline layer (7.5F):**
    - extract it from the assessor workspace, with before-and-after tests;
    - move check-in, check-out and journeys onto it so they survive poor signal and reloads.
11. **What a visit records:**
    - tasks from the care plan (done, not done with reason, declined, escalated);
    - quick logs for everyday care;
    - observations against the monitoring plan;
    - notes with visibility;
    - handover to the next carer;
    - a short family summary.
12. **The family's view:**
    - who is coming and when;
    - visit summaries;
    - invoices and what is paid, with a pay button;
    - sign-in by phone or WhatsApp code as well as email.
13. **Consent records (NDPA):**
    - consent to process health data at enquiry;
    - worker location consent;
    - photo and family-feed consent, per purpose and versioned.

### Phase C: run it day to day (about 4 to 6 weeks)

14. **Action centre:** one queue for work items, flags, alerts, incidents, expiring credentials and timesheet reviews, each with an owner and a deadline.
15. **"I'm on my way" as trip clock-in**, required by 30 minutes before the visit:
    - a reminder to the worker and an alert to coordinators if missed;
    - an ETA from Google with traffic;
    - the client sees "arriving about HH:MM" (never the worker's position).
16. **Cover:**
    - the original carer stays until a replacement accepts and a coordinator approves;
    - workers are told about new and changed visits.
17. **Pay:**
    - rate cards (pay separate from charge);
    - timesheets from check-in and check-out, confirmed by the worker and approved by a coordinator;
    - an earnings ledger, then pay runs and payslips through Paystack Transfers;
    - tax rules signed off by an accountant.
18. **Job visibility:** every scheduled job records its last success and alerts when it misses a window (billing, visit alerts, journey purge, document expiry).
19. **Emergency reach:** SMS or WhatsApp for emergencies and overdue checkouts at night, not only the bell and email.

### Phase D: grow

20. Home-visit bookings: a bookable menu with what each visit may include, red-flag triage, nurse review, prescription upload, pay before dispatch.
21. Shift offers in waves (primary carer first, then nearby matches) with worker settings.
22. School runs: school pins, collection authority, handover codes, parent tracking.
23. Care Fund, the Form Library screen, one governed price catalogue, vocabulary administration, moving public holidays.

## 4. Decisions needed

| Decision | Needed for | Suggested |
| --- | --- | --- |
| Which services launch first | Phase B, item 7 | Postnatal and Omugwo, and eldercare: 7 of the 13 clients |
| Who publishes a service set-up | Item 7 | Clinical Lead approves, coordinator publishes |
| Who are the coordinators and the Clinical Lead | Access, plan approval | Name real people and grant the roles |
| Bank transfers: accept by hand, or dedicated virtual accounts per client | Item 1 | Record by hand now; virtual accounts later |
| SMS or WhatsApp provider for sign-in codes and emergency alerts | Items 12 and 19 | One provider for both |
| Pay model, tax and pension | Item 17 | Accountant sign-off before the first pay run |
| Legal review of location tracking and consent wording | Item 13 | Before the first real carer shares a trip |
| Google server key with the Routes API | Item 15 | When Phase C starts |
| Home-visit launch menu, areas, and new-client rule | Item 20 | 4 to 6 visits, a few Lagos areas, callback and prepayment for new clients |
| Whether hospital staffing, hospital support and clinical research stay out of the care app | Scope | Keep them as staffing work, outside care delivery |

## 5. Tests we are missing

- **Access gate:** the nine-point check, with real second and third identities. The model enforces it, but no test proves it.
- **Payments:** webhook, confirmation, billing and instalments.
- **Work engine:** working-day maths, holidays, ranking, dedupe, and the stage derivation order.
- **Assessment lifecycle test:** stale. It still expects that a non-Workforce person cannot assess, a rule changed on 7 October.
- **Offline assessor workspace:** a real network-cut device run is still pending.
- **Field layer:** autosave acknowledgement and phone-number round trip.

## 6. Housekeeping

- **Two migration folders.** `drizzle/migrations` (to 0116) and `supabase/migrations` redefine the same functions, and later files depend on tables created only by the first. A clean database cannot be built from `supabase/migrations` alone, which blocks a true staging rebuild. Fold them into one ordered trail.
- **Out-of-date status lines.**
  - `roadmap.md` leaves 7.5D, 7.5E and much of steps 1 to 4 unticked.
  - `implementation-plan.md` says Tranche 8 has not started.
  - `docs/platform-architecture.md` still shows the cutover as open (it finished on 6 October).
  - Update all three, and keep this file as the working plan.
- **Two notification systems.** Care notifications (with no automatic sending or retry) and staff notifications (with a worker). Bring them together when templates are built.
- **Small faults:**
  - new family members get the old "new" stage label;
  - the age is still stored as well as derived;
  - public holidays end in 2027 and leave out Easter and Eid;
  - reopening a work item can collide with a live one.
- **Illustrations and icons from the house illustrator are still to come** (`apps-and-operations-plan.md` section 13).
