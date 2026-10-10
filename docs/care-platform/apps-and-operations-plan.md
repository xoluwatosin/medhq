# Medic Connect apps and care operations: plan

Status: working plan, 10 October 2026. Records the decisions taken in planning sessions on that date and the questions still open. Product decisions here sit alongside `account-model.md`, `delivery-architecture.md` and `ui-architecture.md`; where this plan departs from a ratified decision it says so and marks the change for ratification.

Mission: bring healthcare to people's doorsteps.

---

## 1. Ground rule: nothing live breaks

The current system (public site, intake, pre-assessment, assessor, admin, Match Universe, candidate portal) stays working throughout.

- Additive only. New work arrives as new tables, functions, routes and pages. Existing flows change only when that change is the reviewed purpose of the work.
- New screens are visible only to people holding the new capability or grant. Everyone else sees what they see today.
- A safety net comes before any feature work: CI on every pull request (lint, typecheck, unit tests, build), Vercel preview deploys, and a staging Supabase built from the migrations and filled with made-up test data. No live data, scrubbed or not, is ever copied out of production. Every migration runs on staging with the SQL tests in `supabase/tests/` before production, and production is backed up before each migration.
- Small slices, each tested end to end on staging before release.
- Every change reaches `main` through a pull request that passes the **Typecheck, test, build** check. Merging deploys the website (Vercel) and any changed edge functions straight away, but nothing applies migrations. So every database change is additive (new tables, columns and functions; nothing removed or renamed), it is applied to live first, and the code that uses it merges after.

---

## 2. Connect OS: what we take and what we leave

Connect OS (`xoluwatosin/fidelity-frame-generator-75de609c`, and the original `xoluwatosin/fidelity-frame-generator`) was reviewed on 10 October 2026. It is a multi-tenant home-care operations app with a separate Supabase project. The supplied backup is a demo database from March 2026 (4 users, 1 client, 0 visits).

Decision: medhq is the only system of record. Connect OS is used as a reference for rules and clinical content, not as a codebase, schema or design to adopt. Its UX was poor and its foundations (authorisation, data model, offline sync) conflict with medhq's ratified decisions. Its review found, among others: any member could promote themselves to admin, family accounts could read and write every client's medication and observation records, invite acceptance could overwrite an existing user's password, offline sync deleted clinical records after three failed retries, and clock-out and the family portal did not work against its own schema.

Worth taking as reference:

| Connect OS piece | Lands in medhq as |
| --- | --- |
| Clinical content: assessment templates, care categories, vitals thresholds | Questionnaire engine and 7.5D monitoring |
| Active visit flow: tasks, medication, notes, checkout blockers, handover | Workforce app visit screens, on medhq's offline primitive |
| MAR, medication log, controlled drug register | Medication tranche after 7.5E, with ledger maths and witness on the server |
| Visit status and overlap triggers, competency matcher, HMO guards | Roster rules |
| Paystack webhook pattern (signed, amount-checked, idempotent) | Tranche 11 |
| Incident grading and escalation | Action centre on `care_work_items` and `care_flags` |

Not taken: schema, hooks, tenancy, permission model, offline sync semantics, visual design.

Open: confirm whether Connect OS is deployed anywhere with real users. If it is, it needs locking down or taking offline.

---

## 3. The apps

One codebase, one database, one account per person. Three surfaces, two of them new.

| Surface | Who | Address (proposed) | Starts from |
| --- | --- | --- | --- |
| Public website | Everyone | `medicconnect.co` | Exists, unchanged |
| Admin, with a new Care Operations workspace | Staff | `medicconnect.co/admin` | Exists; Care Operations is added alongside |
| Workforce app | Workforce members (nurses, carers, nannies, assessors) | `work.medicconnect.co` | The candidate portal and the assessor workspace |
| Client and family app | Clients, parents and guardians, family, payers abroad | `my.medicconnect.co` | The existing care links (pre-assessment, proposal, invitation) |

- Each app is installable on its own (its own manifest and icon) and ships only its own screens, which matters on low-end Android phones and paid data.
- Workers and families never share a navigation. Separate apps make this structural.
- Change for ratification: `ui-architecture.md` §13 specifies a Work/Care context switcher inside one app. This plan replaces the switcher with separate apps sharing one login. The leak-prevention rules of §13 and the multi-client rules of §14 stay in force.

### 3.1 Accounts and sign-in

- One account per person across the Workforce and Client apps. Access is decided per app by capability (work) or grant (care), never by the login itself. A nurse who also arranges her mother's care uses one login in both apps; each app shows only its own scope.
- Sign-in by phone with a WhatsApp or SMS code; email remains for payers abroad.
- Each app keeps its own session, so signing into one on a shared family phone does not sign into the other.
- Admin: two-factor sign-in required for admin, clinical, finance and safeguarding access. Staff with broad clinical or finance access should use a separate work account, not a personal one.

### 3.2 Who gets which app

- Workforce app: candidates stay in the candidate portal. A person moved to Workforce by an administrator (`mu_become_workforce`, gated on a signed contract, per `talent-workforce-lifecycle.md`) gets the Workforce app. Everyone else stays a candidate.
- Client app: a mixed front door. The app is a way to request care, never the only way; WhatsApp, phone and the website form stay open.
  1. Existing care links (pre-assessment, proposal) let the family claim an account and land in the app.
  2. "Request care" in the app as a door into the enquiry desk.
  3. "Request more care" for existing clients.
  4. App store listing later, if wanted, by wrapping the same app.
- Signing up confers no clinical access. Clinical and finance visibility still require a staff-recorded basis and grant (`account-model.md` §2.5 and §2.7).

---

## 4. Services

One care model; a service changes configuration (forms, modules, safety rules, pricing), never the application (`delivery-architecture.md`). Services fall into four shapes:

| Shape | Services | Before care | Worker records | Family sees |
| --- | --- | --- | --- | --- |
| Ongoing clinical | Clinical home care, chronic care, palliative, children with additional needs | Full assessment, approved plan | Medication, observations, tasks, escalations | Summaries, plan summary, next review |
| Ongoing everyday | Eldercare and companionship, nanny and childcare, live-in | Lighter assessment, household setup | Quick logs, no clinical forms | Daily feed |
| Time-boxed | Postnatal and Omugwo, post-surgical recovery, respite | Assessment, fixed start and end | By service | Progress through the period |
| One-off | Home visits (see 4.1), single shifts, night cover, babysitting | Depends on whether the client is known | One visit record | Who is coming, arrival, what was done |

### 4.1 Doorstep home visits

A priced menu of home visits bookable in the app, built on the existing catalogue (`useCatalogue`). Candidates: vitals and wellbeing check, wound dressing, injection (prescription required), catheter care, post-discharge check, newborn check, sample collection (through a lab partner rather than built in-house), night nursing cover, evening babysitting.

Request care has three paths: book a home visit, start ongoing care, or talk to us. A one-off visit can lead into assessment and ongoing care.

Launch small: 4 to 6 visit types, a few Lagos areas, same-day or next-day. Emergency response is out of scope and the app says so.

### 4.2 Childcare and family services

Covered by the same building blocks: school drop-off and pick-up, after-school care, holiday and mid-term cover, babysitting, sick-day care, escort to lessons and appointments, overnight cover, maternity or newborn night nurse, additional-needs support.

Childcare specifics:

- Quick daily logs (feeds and meals, naps, nappies, activities, school run), three taps each.
- Parent feed of the day.
- Collection authority: who may collect from school and who may receive at home, managed by the parent.
- Development observations kept separate from clinical records and never diagnostic.
- Medication only with written parental authorisation and dose.
- Safeguarding concerns go to a restricted record and never to the family feed.

School run specifics: the school's release rules; a handover code at both ends; journey tracking the parent can follow; transport rules agreed in advance (no unvetted rides, car seats under 8); a lateness alert to the office and the parent; a named, pre-approved relief worker.

Suggested first family services: school pick-up with after-school care as one recurring service, and sick-day care.

Respite is a time-boxed episode on an existing client record, so a repeat booking is quick; the handover in and out is the critical step.

### 4.3 Safety for one-off and first visits

The risk runs both ways: a stranger entering a home, and a worker sent to an unverified address.

| Step | Rule |
| --- | --- |
| Identity | Phone verified by code |
| Address | Map pin, landmark, gate details; first visit to an address gets a short confirmation call |
| Triage | A short fixed list of red flags (chest pain, breathing difficulty, heavy bleeding, sudden weakness or confusion, seizure, severe pain, a floppy or non-feeding baby). Any yes routes to "go to hospital or call emergency services now", not to a booking |
| Clinical review | A nurse reviews clinical bookings before they are confirmed. No algorithm decides clinical urgency on its own |
| Scope | Injections and medicines require a prescription upload; each visit type states what the worker can and cannot do |
| Payment | Paid before the visit |
| Who is coming | Worker photo, name, verified badge and arrival time, plus a code confirmed at the door |
| Worker safety | Location at check-in and check-out, overdue-checkout alert, emergency button, no late-night first visits without approval |
| New clients | Never an instant one-off: a callback and prepayment first (open question 2) |

### 4.4 Booking questions

Home visit: who and how old; which visit; red flags; prescription or discharge letter; allergies and known infections; address, landmark, access and parking; who will be home, pets, safety concerns; when; who pays.

School run: school and its release rules; who may collect and who may receive (names, photos, phones); transport; times per day including half-days; allergies and medicines with written permission; what happens if no one is home at hand-back.

Ongoing care: the existing pre-assessment.

---

## 5. What a visit records

- Check-in and check-out time and location, door code confirmed.
- Each task: done, not done with reason, declined, not applicable, escalated.
- Vitals and observations (clinical services).
- Medicines given against what was authorised.
- Quick logs (childcare).
- Photos: wound and skin photos for monitoring; the child's day for the parent feed if the parent opts in; supplies left at handover. Taken inside the app and never saved to the phone's gallery (workers use personal phones). Each photo labelled clinical or family-shareable. Consent recorded per client and confirmed per photo.
- Handover to the next worker or family, including outstanding risks.
- Concerns and incidents, restricted.
- A short family summary.
- Client or family confirmation (code or signature).
- Consumables used.

---

## 6. Location

medhq captures no device location today, and client addresses hold no coordinates.

| Level | What | Build |
| --- | --- | --- |
| 1 | Location and time stamped at check-in and check-out, compared with the address on the server. A distant check-in is flagged, not blocked | With visits |
| 2 | Safety alerts: overdue checkout, far from expected location | With visits |
| 3 | Live journey tracking only while a school run or trip to a visit is in progress | With the Today board |
| 4 | Live map of workers on duty | With the Today board |

- Track only during visits and journeys, never off duty.
- Store coordinates for every client and school address, with pins and landmarks.
- The web app tracks reliably while open; background tracking with the screen locked needs an app store build of the same app, deferred until needed.
- Retention: precise routes deleted after a set period (30 to 90 days); check-in and check-out locations kept with the visit record.
- Consent: workers through their contract and an in-app notice, with a visible indicator whenever tracking is on; parents for their child's journeys.

---

## 7. Care Operations (inside the admin)

Care Operations is a workspace inside the existing admin: same login, same records, its own home page and navigation, visible by role. Care coordinators see Care Operations; marketing, SEO and recruiting stay where they are.

Already built: enquiries, care requests and routing, the client record, households and groups, pre-assessment, assessor visits, clinical review, care plans with approval, quotes and proposals, family access grants, `care_work_items`, Match Universe and contracts, `care_episodes`, `care_delivery_assignments`, service configuration, working hours, public holidays.

To add:

| Page | Purpose |
| --- | --- |
| Today | Every visit and journey today, lateness, overdue checkouts, children not yet home |
| Schedule | Roster by worker and by client, open shifts, recurring patterns |
| Bookings | Home visit requests, triage review, dispatch |
| Action centre | One queue drawing together work items, flags, alerts, incidents, expiring credentials and family requests, each with an owner, deadline and recorded outcome |
| Clients, Workers | Existing records, reached from here |
| Timesheets and pay | Shift review, payout batches, pay runs |

Operational reality: school runs, nights and weekends mean the Today board needs someone on duty at those times.

---

## 8. Shifts

| Type | Example | Length |
| --- | --- | --- |
| Visit | Wound dressing, check-in | 30 minutes to 2 hours |
| Shift | Day or night nursing | 8 to 12 hours |
| 24-hour | Complex care | 24 hours with rest |
| Live-in | Eldercare, nanny | Weekly or monthly rotation |
| Recurring | School run Monday to Friday 2:30 to 6pm | Repeating pattern |

Filling a shift: created by the admin, a booking or a plan; eligible workers listed (capability, valid documents, availability, leave, rest, distance), primary carer first; offered to one worker or several; accepted; coordinator approval where the work is high-risk; published to the worker and family.

Cover: the original worker stays assigned until a replacement accepts and a coordinator approves; the assignment then changes once.

Rules: no overlaps, travel time between visits, maximum weekly hours, minimum rest, especially after nights.

### 8.1 Shift offers

Workforce members are notified of open shifts that match them, and accept in the app.

What becomes an open shift:

- A care request or home visit the client has paid for.
- A cover request (the original worker stays assigned until a replacement is confirmed).
- A shift a coordinator opens by hand.

Unpaid requests are never offered.

Who is offered it (all checked on the server):

| Check | Rule |
| --- | --- |
| Distance | Home address within the worker's chosen radius (for example 10 km). Straight-line distance at first; travel time later |
| Skills | Capability and credentials the service requires, all valid on the shift date |
| Availability | The shift sits inside the worker's availability, not on approved leave |
| Workload | No overlap, travel buffer from the previous visit, rest after nights, weekly hours limit |
| Client | Client exclusions and preferences respected (for example a family's objection to a worker) |
| Worker settings | Offer radius, shift types, alert hours, paused |

Offering in waves, so continuity comes first and alerts are not spammed:

1. The client's primary carer or familiar team, alone, for a short window (for example 30 minutes; shorter when urgent).
2. The best-matched nearby workers, a small batch at a time.
3. A wider radius, or a coordinator chooses by hand.

Accepting:

- First eligible acceptance holds the shift; it is confirmed by a coordinator (every shift reviewed by a person, as for pay). Others see it as taken.
- Before confirmation the worker sees the area and distance, never the exact address.
- On confirmation the worker, the family and, for cover, the original worker are notified; the assignment changes once.

Notifications: in-app and WhatsApp, inside the worker's alert hours, except urgent cover, which the coordinator may send at any time.

Fairness: offers rotate among equally matched workers; declining is never penalised; no-shows after accepting are tracked.

Needs: coordinates for every worker's home address (address autocomplete already exists; it does not yet keep coordinates), and per-worker offer settings alongside the existing work preferences and availability.

Continuity: a named primary carer per client, preferred by the roster, with continuity tracked. Evidence links carer continuity with fewer falls, better function and fewer readmissions.

Already built and reused: availability with recurrence, work preferences (shift patterns, engagement types), leave requests, credentials and documents, capabilities.

---

## 9. Pay

### 9.1 Decisions

| Topic | Decision |
| --- | --- |
| Engagement | Mixed: salaried, per shift or visit, or salary plus extra shifts |
| Pay frequency | Follows the engagement: salaried monthly; per-shift workers on their own calendar, with payment after each approved shift available |
| Transport | Set per contract or shift: per visit, flat monthly, or built into the rate |
| Client cancellation | Clients pay ahead, so late cancellation incurs a fee by notice band; the worker receives a set share of any fee retained |
| Pension | Not operated yet (see 9.4) |
| Payroll tax | Applied, using the 2026 rules in 9.3 |
| Shift approval | Every shift reviewed by a person. Automatic approval is built but switched off |

### 9.2 How pay works

- Base rate by role and work type; additions for night, weekend and public holiday (`care_public_holidays`), transport, and cancellation share.
- Pay comes from approved actual time, not scheduled time. Check-in and check-out create the timesheet; the worker confirms or disputes; a coordinator approves.
- Pay rate and client charge are always separate. A client charge never falls back to a worker's pay rate.

Payment after each shift:

```
Shift ends, check-out, timesheet created
  -> checks run (times, location, door code, tasks, incidents, hours)
  -> coordinator reviews and approves (every shift, for now)
  -> finance releases the payout batch
  -> paid by bank transfer
```

- Fast review: each shift arrives with its checks pre-computed; clean shifts take one tap and can be approved in bulk by a person.
- Review deadline, for example within 4 hours of check-out or by 9am for nights; overdue reviews appear in the action centre.
- Each shift records whether the system would have approved it automatically and whether the reviewer agreed. Automatic approval is switched on only once that agreement is consistently high.
- Separation of duties: the coordinator approves timesheets and finance releases payouts. Where one person must do both for now, every action is logged.
- Each shift can be paid once only; failed transfers retry and flag, never double-pay. The client's prepayment for the shift must be received before its pay becomes available.

### 9.2.1 Paystack: the whole money cycle

Paystack carries money in and out. Workers do not get Paystack accounts; Medic Connect keeps an earnings ledger and pays out through Paystack Transfers.

Money in:

- Card payments through Paystack, as now.
- A Paystack dedicated virtual account per client: their own account number to pay by bank transfer, matched to the client and invoice automatically.

Money out, as an earnings balance:

1. A shift is approved; its pay, after tax, becomes the worker's available balance.
2. The worker taps Withdraw; Paystack transfers it to their verified bank account. A worker may choose automatic payouts instead (daily, weekly or monthly).
3. Funds stay in Medic Connect's Paystack balance until withdrawn; the system's ledger records who is owed what.

Rules:

- Earned pay only. No top-ups, no transfers between workers, no spending. Called "Earnings" or "Balance", never "Wallet": a stored-value wallet is e-money and needs Central Bank of Nigeria licensing.
- Not Paystack split payments: they would pay before the visit and before review and tax, and complicate cancellations and refunds.
- Tax withheld before pay shows as available; statements show gross, tax and net.
- The bank account name is verified before the first payout; any change of bank details is re-approved; every withdrawal sends the worker an alert.
- A daily reconciliation compares what workers can withdraw with the Paystack balance, and alerts finance if the balance falls short.
- Balances not withdrawn within a set period (for example 30 days) are paid out automatically.
- Before build: confirm with Paystack that dedicated virtual accounts and Transfers are enabled for the account, and have the accountant sign off the arrangement.

Tax by worker type:

| Worker | Pay | Tax |
| --- | --- | --- |
| Per-shift contractor | After each approved shift | Withholding tax per payment |
| Salaried, extra shifts | Settled in the monthly run; optionally advanced and reconciled at month end | PAYE in the monthly run |
| Salaried | Monthly | PAYE |

### 9.3 Payroll tax (2026 rules, pending accountant sign-off)

PAYE under the Nigeria Tax Act 2025, in force from 1 January 2026, on annual chargeable income:

| Band | Rate |
| --- | --- |
| First ₦800,000 | 0% |
| Next ₦2.2m | 15% |
| Next ₦9m | 18% |
| Next ₦13m | 21% |
| Next ₦25m | 23% |
| Above ₦50m | 25% |

- Rent relief of 20% of rent paid, capped at ₦500,000, where the worker declares rent. Pension and NHF contributions reduce chargeable income where made. Minimum-wage earners are exempt.
- PAYE calculated cumulatively through the year in each monthly run, and remitted to the tax authority of the employee's state of residence.
- NSITF 1% of monthly payroll. ITF 1% of annual payroll once headcount and turnover thresholds are met. NHF is now voluntary for private-sector employees.
- Contractors: withholding tax, commonly 5% on fees with a Tax ID and 10% without. Collect a Tax ID at onboarding.
- Sources disagree on several thresholds (ITF, withholding exemptions, pension headcount wording). An accountant signs off every rate before the first live pay run.

### 9.4 Pension

The Pension Reform Act requires contributions once an employer has three or more employees (8% employee, 10% employer, on basic, housing and transport). Not operating pension is a compliance risk to resolve with an accountant. The system carries a per-worker pension setting so it can be switched on without code changes.

### 9.5 Build

- Tax bands, withholding rates and levies are configuration with effective dates, so a change in law is a new row and past payslips keep the rules that applied.
- Each worker carries engagement type, pay calendar, Tax ID, state of residence, declared rent and pension applicability.
- A pay run produces payslips in the Workforce app, bank payouts and remittance schedules (PAYE by state, NSITF, withholding tax, pension when enabled). The system calculates; filing stays with the accountant.

### 9.6 What workers see

Upcoming shifts and offers; availability and leave; timesheet with confirm or dispute; earnings this period (paid and pending) and next payment; payslips and monthly statements including tax withheld; documents with expiry reminders (an expired document blocks new bookings).

---

## 10. Evidence notes

| Topic | Finding | Strength | Consequence |
| --- | --- | --- | --- |
| Carer continuity | Associated with fewer falls, better function, less depression, fewer readmissions | Fairly strong, observational | Primary carer and continuity tracking in the roster |
| Violence against home workers | Common, mostly verbal, widely under-reported | Consistent | Emergency button, two-tap incident reporting, training |
| Symptom checkers | Comparable on emergencies but miss most red flags | Good | Fixed red-flag list plus nurse review |
| Worker location tracking | Little evidence of fraud reduction; documented worker burden | Weak on benefit | Track only on visits and journeys; explain it as safety |
| Wound photography | Feasibility and governance guidance; no outcome trials | Weak on outcomes | In-app capture, consent, clinical label |
| Respite | Small or mixed effect on carer burden | Mixed | Present as time off, with a proper handover |
| Childcare parent apps | Mostly vendor claims | Weak | Keep logs light; measure what parents read |
| Nigerian market | Home labs, on-demand primary care, diaspora-focused care and doctor home visits already operate | Market signal | Trust is the product; partner for labs |
| NDPA 2023 | Health data is sensitive and needs purpose-specific consent | Law | Separate consent for clinical records, photos, location and family feed; legal check on location data |

---

## 11. Build order

0. Safety net: CI, preview deploys, staging database and restore. Changes nothing live. CI is in `.github/workflows/ci.yml`: typecheck, unit tests and build on every pull request; lint runs on changed files only and warns, because the codebase carries existing lint errors.
1. Care-worker capability grants (Tranche 2) so a test worker exists. Rule: the workforce app is open to a person only while they are in the Workforce, work in the field, hold the `care_worker` capability and have a sign-in. An assignment never grants access; it decides which care they see. Built in `20261010120000_care_worker_access.sql` with `supabase/tests/care_worker_access.sql`; admins grant it on the Workforce staff page.
2. Delivery data: observations, interventions, monitoring (7.5D and 7.5E), database only. 7.5D (monitoring plans) is `20261010140000_care_monitoring_plans.sql` with `supabase/tests/care_monitoring_plans.sql`. 7.5E (observations, interventions, goal evidence) is `20261010150000_care_delivery_records.sql` with `supabase/tests/care_delivery_records.sql`: records are never edited or deleted, a correction is a new record pointing at the old one, and a concern raised on a record becomes a care flag and a work item.
3. Schedule and visits: roster with recurring patterns and primary carer, visit records, check-in and check-out with location levels 1 and 2, Workforce app "My visits".
4. Today board and live alerts, location levels 3 and 4, emergency button.
5. Bookings and dispatch for home visits, with triage and nurse review.
6. Action centre on `care_work_items`.
7. Timesheets, per-shift payment with human review, pay runs and tax configuration.
8. Client app: claimed accounts from care links, request care, visit summaries, family feed, payments.
9. Shared offline primitive (7.5F) and offline visit capture, with before-and-after tests and a device run, since the live assessor depends on it.

Each step is tested on staging before release. The acceptance scenarios from the Connect OS specification (older adult nursing, mother and newborn, child with nanny, emergency replacement, offline failure) become the tests each relevant step must pass.

---

## 12. Open questions

1. Is Connect OS deployed anywhere with real users?
2. One-off visits for brand-new clients: never, or only after a callback and prepayment (recommended)?
3. Which 4 to 6 home visit types, and which Lagos areas, at launch?
4. App addresses: `work.` and `my.`, or other names?
5. Ratify separate apps in place of the Work/Care switcher in `ui-architecture.md` §13.
6. Cancellation fee bands and the worker's share.
7. Rates: base pay by role and work type, premiums, transport policy per engagement.
8. Payout batch times and review deadline.
9. Accountant sign-off on tax configuration, and the pension position.
10. Retention period for journey location data, and legal review of location under the NDPA.
11. Lab testing partner.
12. Who staffs the Today board on evenings and weekends.
13. Default offer radius, first-wave window, and how urgent cover is handled.

---

## 13. Design

Screens for both apps are drafted on the Medic Connect design system (Figtree, navy and blue, square shapes, hard offset shadows, the house illustration library). Medic Connect has its own illustrator; the illustration brief for app moments the library does not yet cover (gate check-in, school-gate handover, door code, wound kit, newborn weighing, payment alert, route pin, worker lanyard, empty states, welcome screens) goes to them. Staff portraits come from real photography of the team.

Inside the apps: no logo and no watermarks on working screens. The logo appears on the app icon, the sign-in screen, the worker ID badge, and anything that leaves the app (receipts, payslips, invoices, shared summaries). Distinctiveness comes from a bespoke icon set and illustrations by the house illustrator, and from giving each kind of thing its own object (the next visit as a ticket, the day as a timeline, offers as postcards, live status as a tag), not from boxed cards.
