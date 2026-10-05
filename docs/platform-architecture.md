# Medic Connect platform architecture

Revision 1, 5 October 2026. The whole platform in one place: what exists,
how the parts fit, the decisions that hold it together, how the data moves,
and the order of work. It sits above the detailed care documents in
`docs/care-platform/`, which stay the source for clinical and access rules,
and above `roadmap.md`, which stays the execution list.

Everything marked "verified" was checked against the live database
(project medic-connect-hq) or the code on 5 October 2026.

---

## 1. The platform at a glance

Medic Connect runs three businesses on one system:

| Business | What it does | Who uses it |
|---|---|---|
| Care at home | Enquiry to assessment to agreed care, then delivering that care | Families, clients, assessors, carers, nurses, care office |
| Staffing and talent | Recruiting nurses, carers and doctors; placing them with facilities and families | Candidates, staff, facilities, recruitment office |
| Programmes | Creator | Creators, programme leads |
| Public presence | Website, The Bridge, SEO pages, campaigns | The public, marketing |

**One database, four front doors.**

```text
                 ┌──────────────────────────────────────────────┐
                 │  One Supabase project: medic-connect-hq       │
                 │  Postgres + auth + storage + server functions │
                 └──────────────────────────────────────────────┘
                   ▲            ▲              ▲             ▲
   Public site     │  Admin     │  People app  │  Family     │
   (anyone)        │  (office)  │  (candidates,│  portal     │
                   │            │  staff,      │  (clients,  │
                   │            │  assessors,  │  relatives, │
                   │            │  carers)     │  payers)    │
```

- **Public site and Admin** are today's web app.
- **People app** is today's candidate portal and assessor workspace,
  growing into the carer's working tool. It is one front door for one person,
  whatever hats they wear. It is built mobile first and offline capable, and
  is the part that is packaged as a native app later.
- **Family portal** is the `/care` area of the website, scoped by access
  grants.
- **Heard** has moved to its own project and is outside this
  architecture. Its leftover code and tables here are listed for removal in
  section 7.

---

## 2. Where things stand (verified)

| Area | State |
|---|---|
| Public site | Redesigned. Live. |
| Talent: intake, pool, documents, opportunities, matching | Built and in daily use. 389 people, 778 documents, 216 posting applications. |
| Talent to Workforce lifecycle | Built (migration 0042). One person row gains an employment side. |
| Contracts | Built: templates, annexes, issue, sign, countersign. 9 contracts. |
| Candidate portal | Built and redesigned. |
| Care: enquiry, care groups, requests, pre-assessment | Built. 14 clients, 9 care requests. Pre-assessment v5 in progress. |
| Care: assessment, offline assessor workspace | Built (0030 to 0041). Awaiting device acceptance. |
| Care: clinical review, care plan, proposal | Built (0043 to 0069, 0111). Awaiting populated acceptance. |
| Care: family access grants | Built (0017 to 0021). No grants issued yet. |
| Care delivery foundation: episodes, service configuration, delivery assignments | Built (0050 to 0053). Empty. |
| Care package, roster, visits, observations | Not built. Designed in `docs/care-platform/delivery-architecture.md`. |
| Family portal | Proposal view and invitation only. |
| Finance | Paystack invoices (3), invoice catalogue, care quotes and commercial terms. No recurring billing, no reconciliation, no worker pay. |
| Heard | Moved to its own project. Leftovers remain here: routes, admin screens, 2 server functions, 10 tables, access keys. |
| Scheduled jobs | **All 12 paused** since the move off Lovable Cloud (migration `recreate_cron_jobs_paused`, 3 October). |
| Schema history | **Two migration trails**: `supabase/migrations` (173 files) and `drizzle/migrations` (117 applied). |

`docs/care-platform/implementation-plan.md` still says "No tranche started".
That is out of date: Tranches 1 to 7 and Pass 7.5A to 7.5C are built.

---

## 3. Decisions

Each decision is stated, then checked: what else was considered, what could
go wrong, how we prove it holds, and the verdict.

### D1. One database for everything

**Decision.** Care, talent, workforce, finance and content share one
Postgres database and one sign-in pool.

**Considered.** A separate care database with sync; buying a care-delivery
product and integrating.

**Why.** A carer is a talent and workforce person with contracts and
documents. A client comes from an enquiry and a care plan built here. A
package is priced from the same catalogue the invoices use. Splitting means
copying people, clients, plans, staff and prices both ways, forever.

**QA.**
- *Risk: clinical data sits beside marketing data.* Mitigated by row-level
  security on every table, writes only through checked server functions for
  care tables (already the rule from migration 0044), and per-scope access
  grants. Test: the existing `supabase/tests/care_*.sql` security suites.
- *Risk: one bad migration affects everything.* Mitigated by D2 (one
  migration trail, tested from scratch) and Supabase point-in-time recovery.
- *Risk: a partner or regulator demands separation later.* The care tables
  are already prefixed and accessed through functions, so they can move to
  their own schema without changing callers.
- **Verdict: hold.**

### D2. One migration trail, rebuildable from the repo

**Decision.** Freeze both trails. Take a baseline of the live schema into
`supabase/migrations`. Every new change goes there, through the Supabase
CLI.

**Why.** Today the schema is split: care tables (and the Heard leftovers) live only in the
Drizzle trail, talent tables only in the Supabase trail, and the two are
run by different tools. Dashboard and MCP tooling write to the Supabase
trail, so it keeps growing while the Drizzle trail stays separate. Nobody
has yet proved that the two together rebuild the live database.

**QA.**
- *Proof:* build a fresh database from the repo and compare its schema with
  live. Zero differences is the gate.
- *Risk: baselining loses history.* The old files stay in the repo,
  read-only, for reference.
- **Verdict: hold. First item of work.**

### D3. Four front doors, not one app per audience

**Decision.** Public site, Admin, People app, Family portal. Each is a set of
routes with its own shell. They share code and the database.

**Considered.** One app per role (candidate app, carer app, assessor app).

**QA.**
- *Check against the ratified rule.* `architecture.md` section 10 says one
  person sees one portal whose capabilities are resolved from their records.
  A separate carer app would break that for a candidate who becomes a carer.
  So the carer tool lives in the People app. **Earlier advice in this
  conversation to build a separate carer app is revised to this.**
- *Check: family members who are also staff.* `account-model.md` keeps
  professional records and family access separate on one sign-in. The People
  app and Family portal are different doors for the same login; a switcher
  appears only for someone holding both.
- **Verdict: hold.**

### D4. The People app is offline first and native later

**Decision.** Build the People app mobile first as an installable web app
on the shared offline layer. Package it with Capacitor for Android, then
iPhone, once visits work in the field.

**Considered.** React Native from the start; fully native.

**QA.**
- *Risk: background location needs native.* Visit verification is three
  tiers (QR, then GPS, then attestation) and never blocks care, so the web
  version works without background location. Capacitor adds it when needed.
- *Risk: Capacitor proves too limited.* The shared core (D5) moves to React
  Native unchanged; only screens are rebuilt.
- *Proof:* Checkpoint D, a worker records a visit offline and it syncs, on a
  low-end Android phone.
- **Verdict: hold.**

### D5. A shared core with no screen code in it

**Decision.** Create `src/core/` now: types, business rules, server function
calls, the offline sync engine, and adapter interfaces for storage,
location, camera and notifications. A lint rule forbids React and browser
imports inside it. It becomes a workspace package only when the People app
is packaged.

**Considered.** Moving to a monorepo now.

**QA.**
- *Risk: big-bang restructure breaks the live site.* Avoided: code moves into
  the folder piece by piece, starting with new delivery code.
- *Proof:* core has its own unit tests, which run without a browser.
- **Verdict: hold.**

### D6. Every write to care and delivery data goes through a server function

**Decision.** No screen writes care tables directly. Each action is a named
function that checks permission and capability, and takes an idempotency
key.

**QA.**
- Already the rule for care since 0044. Talent screens still write tables
  directly through the admin client. That is acceptable for office-only data
  but every new delivery, finance and family-facing write follows D6.
- *Proof:* security tests assert no `authenticated` write privilege on new
  tables.
- **Verdict: hold.**

### D7. Facts are appended, never overwritten

**Decision.** Visit events, observations, interventions and goal evidence
are append-only. A correction is a new row pointing at the old one. Visit
state is a projection of its events.

**QA.** Required for offline sync and for clinical defensibility. Already
designed in `delivery-architecture.md`. **Verdict: hold.**

### D8. One agreement record

**Decision.** "Agreement to commence care" is one record: the care package,
status agreed. It is created by a single function only when the proposal
response is accepted and the quote is accepted (and, if the commercial terms
require it, the deposit is paid).

**Why.** Today acceptance is recorded in two places,
`care_proposal_responses` and `care_quotes.accepted_at`, and nothing joins
them. The package is the hinge between pre-agreement care (admin) and
delivery.

**QA.**
- *Check: proposal revised after acceptance.* A new proposal version
  supersedes; the package records which proposal and quote versions it
  rests on; a revision creates a successor package, never edits the agreed
  one.
- **Verdict: hold. Part of Tranche 8.**

### D9. One price catalogue

**Decision.** One governed catalogue of services and fees with effective
dates. Invoices, quotes, packages and public SEO prices all read it.

**Why.** Today there are three: `invoice_services`, `service_fees` (public
prices) and quote lines typed per quote.

**QA.** *Risk: changing a price rewrites history.* Effective dates, and
quotes and invoices snapshot the price they used. **Verdict: hold.**

### D10. One notification dispatcher

**Decision.** All outbound email, SMS and WhatsApp goes through the
`care_notifications` pattern: a durable record, deduplication, retry and
visible failure. Templates come from the Email Library.

**Why.** Today there are 15 separate send and notify functions, some reading
templates that have no editor, and the Email Library is used by nothing.

**QA.** Migrate one sender at a time; each keeps working until moved.
**Verdict: hold.**

### D11. Scheduled jobs are visible

**Decision.** Re-enable the paused jobs one at a time, each writing a run
record. Add last-success timestamps and missed-run alerts (roadmap Tranche
12 item, brought forward).

**QA.** *Risk: switching all 12 back on at once floods email or reparses
everything.* Turn on in order: publish scheduled posts, document expiry,
orphan account linking, parse sweeps, duplicate scan, analytics, then
follow-up nudges last, after checking the queue. **Verdict: hold, urgent.**

### D12. Sign-in by code for the People app

**Decision.** A six-digit code by email (SMS later) is the main way into the
People app and Family portal. Links stay as a convenience.

**QA.** Links need extra setup to open inside a native app; codes work
everywhere. Admin already uses codes. **Verdict: hold.**

---

## 4. The data model

### 4.1 Five spines

**People.** One human may hold several records that are never merged and
never joined by email:

- `mu_people`: a professional (candidate, staff, assessor, carer). Gains
  capabilities (`mu_capabilities`: assessor, care worker).
- `care_people`: a human on the care side (client, relative, payer).
- `auth.users`: the sign-in, linked to either or both.

**Care.** `care_groups` (a household) → `care_requests` →
`care_request_recipients` → `clients` (each person receiving care) →
assessments and documents → care plan → proposal and quote →
**care package (agreement)** → `care_episodes` → roster → visits → visit
events → observations, interventions, goal evidence → reviews → next plan
version.

**Work.** `mu_people` → contracts → workforce state → capability →
`care_delivery_assignments` (home care) or `mu_engagements` (facility
placements) → shifts and visits → verified time → pay.

**Money.** catalogue → quote → package rate → invoices → payments →
reconciliation. On the cost side: verified time → pay run.

**Audience and content.** enquiries, audience groups, campaigns, posts, SEO
pages. Reads prices from the catalogue; never reads clinical data.

### 4.2 Who owns what

| Data | Owner (only writer) | Readers |
|---|---|---|
| Person (professional) | Talent and Workforce functions | Admin, People app (own record) |
| Person (care side), access grants | Care office functions | Family portal (own grants) |
| Assessment answers | Assessor, through capture events | Clinical staff; family by grant |
| Care plan, proposal | Clinical lead | Family by clinical grant |
| Care package (agreement) | Care coordinator, through the agreement function | Finance, roster, family |
| Roster, assignments | Care coordinator | Assigned worker, family (who is coming) |
| Visit events, observations | Assigned worker, through sync | Clinical staff; family by visibility and grant |
| Invoices, payments | Finance functions and the Paystack webhook | Payer by finance grant |
| Prices | Catalogue (governed) | Everything |
| Notifications | Dispatcher | Admin |

### 4.3 Rules every new table follows

1. Row-level security on, no direct writes for signed-in users.
2. Writes through named functions with an idempotency key.
3. A visibility value on anything a family might see:
   `family`, `care_team`, `professional`, `safeguarding`.
4. Corrections create successors; nothing clinical is deleted.
5. Dates and prices snapshot what they were at the time.
6. One owner per table; everyone else reads.

---

## 5. How the data moves

### 5.1 From enquiry to service user

| Step | Record created or changed | Who |
|---|---|---|
| Enquiry arrives | `contact_submissions` | Public site |
| Routed to Care | `clients`, `care_groups`, `care_requests`, recipients; enquiry linked | Care office |
| Pre-assessment sent and returned | `care_documents` (pre-assessment), work items | Family by link |
| Assessment visit | `care_assessment_work`, capture events, assessment document | Assessor, offline |
| Clinical review | review decision on the assessment work | Clinical lead |
| Care plan | plan document, needs, goals, tasks | Clinical lead |
| Proposal and quote | `care_proposals`, `care_quotes` | Clinical lead, finance |
| Family accepts | proposal response, quote acceptance | Family portal |
| **Agreement** | **care package, agreed** (D8) | Agreement function |
| Episode starts | `care_episodes` activated with frozen configuration | Coordinator |
| Staffed | `care_delivery_assignments`, roster | Coordinator |
| Plan issued | plan version states who is coming and when | Clinical lead |
| Client is a service user | stage derives to "care running" | Derived |

### 5.2 During care

Roster generates visits. A visit snapshots the plan version it was made
from. The carer checks in (QR, GPS, attestation), records observations and
tasks done, writes notes, checks out. Events sync when signal returns.
Escalations raise `care_flags`. Notes are internal until a coordinator
promotes them for the family. Reviews read observations and goal evidence
and produce the next plan version.

### 5.3 Money

The package carries the rate. Invoices are generated per billing period
from the package and, where billing is by attendance, from verified
visits. Paystack confirms payments through the webhook, matched on
reference. Verified visit time becomes the worker's timesheet, which feeds
a pay run. Worker pay is not designed yet and needs its own design pass.

### 5.4 What crosses between doors

| From | To | What | How |
|---|---|---|---|
| Admin | People app | Assignments, rota, plan tasks | The worker reads their own assignments through functions |
| People app | Admin | Visit events, observations, notes, time | Offline sync into append-only tables |
| Admin | Family portal | Plan, proposal, notes promoted for family, invoices | Grant-scoped read functions |
| Family portal | Admin | Answers, acceptances, comments, payments | Functions and the Paystack webhook |
| Talent | Care | A worker with the care-worker capability | Capability grant on `mu_people` |

---

## 6. Code architecture

```text
src/core/             no React, no browser APIs; unit tested
  types/              generated database types plus domain types
  rules/              pure business rules (late visit, scope checks, rates)
  api/                one function per server action
  offline/            event queue, sync, conflict rules (from care-offline.ts)
  adapters/           interfaces: storage, location, camera, notify, clock
src/                  today's web app: public site, admin, portals
  platform/web/       browser adapters (IndexedDB, browser location)
later: apps/people/   Capacitor shell with native adapters
```

- Screens call `core/api`, never the database client directly.
- The offline layer talks only to the storage adapter.
- The People app keeps a minimum supported version in the database and
  checks it on launch.

---

## 7. Risks found while writing this

| Risk | Effect | Fix |
|---|---|---|
| Scheduled jobs all paused | Scheduled posts don't publish, documents don't expire, CV parsing and nudges don't run | D11, now |
| Two migration trails | No proof the repo can rebuild the database; two tools to run | D2, now |
| Implementation plan says nothing started | New work may duplicate built work | Update its position section |
| Two acceptance records | No single moment care is agreed | D8 |
| Three price sources | Public price, quote and invoice can disagree | D9 |
| No worker pay design | Carers' pay is manual | Design pass before Tranche 9 ends |
| Contracts issued from three places are not emailed or checked | Staff never receive their contract | Admin fix, see `admin-ux-inventory.md` |
| Email Library unused, system emails read templates with no editor | Staff can't change what is sent | D10 |
| Raw care tokens in session storage | Token exposure on shared devices | Roadmap "required before scale" |
| Heard leftovers | Two copies of Heard if this deployment still serves it; stale tables and access keys | Confirm the Heard domain no longer points here, export the 9 Heard rows, then remove the code, functions, tables and keys |
| Data protection | Health data under the Nigeria Data Protection Act 2023 | A data map, retention rules and a data protection impact assessment before family portal launch. Take legal advice. |

---

## 8. Scenario check

The architecture walked through real situations.

| Scenario | Handled by | Gap |
|---|---|---|
| A relative of one client is also a carer for another | One sign-in, separate records, two doors (D3) | None |
| A carer in Ibadan loses signal mid-visit | Offline events, sync later (D7) | Needs device acceptance |
| A finance-only payer opens the portal | Finance-scope grant shows invoices only | None |
| The family asks for more hours after care starts | New proposal version, successor package (D8) | None |
| A carer leaves mid-package | Assignment ends with reason; coordinator reassigns; history kept | Workforce return-to-talent blocks while assignments are live, which is correct |
| Two profiles turn out to be one carer | Merge function moves every linked row | None (shipped 5 October) |
| A carer's phone runs a months-old app | Minimum version check; backward compatible functions | Needs the version table |
| A price changes mid-package | Package and invoices snapshot the price | Needs D9 |
| A safeguarding concern is noted on a visit | `safeguarding` visibility, flag raised | Escalation links are Pass 7.5E |

---

## 9. Data roadmap

Each phase ends at a checkpoint that proves the data works end to end.

| Phase | Data built | Checkpoint |
|---|---|---|
| 0. Foundations | One migration trail; jobs back on with run records; `src/core`; minimum app version table | A fresh database built from the repo matches live; every job shows a last success |
| 1. Finish pre-agreement care | Pre-assessment v5, assessment v3, populated acceptance of review, plan and proposal | **C**: enquiry to accepted assessment to drafted plan, on a real record |
| 2. Agreement and service user | Care package and the agreement function (D8); one price catalogue (D9) | A family accepts; one agreed package exists; stage reads "care running" once staffed |
| 3. Delivery data model | Monitoring plans (7.5D); observations, interventions, goal evidence (7.5E) | Security tests for every new table pass |
| 4. Roster and visits | Roster, visits, visit events (Tranches 8 and 9); shared offline layer (7.5F) | **D**: a worker records a visit offline and it syncs |
| 5. Family portal | Scoped plan, visit notes and invoices (Tranche 10) | **E**: three scopes across two clients each see exactly their own |
| 6. Money | Recurring invoices from packages; Paystack reconciliation; timesheets and a pay run design (Tranche 11) | Every payment matched to an invoice; every verified visit on a timesheet |
| 7. Native People app | Capacitor Android, then iPhone; code sign-in (D12) | Store release; the same visit flow passes on device |
| 8. Reviews and reporting | Form Library, governed configuration, outcome reporting (Tranche 12) | **F**: configuration managed without a developer |

The admin work in `admin-ux-inventory.md` (list standard, merges, fixes)
runs alongside phases 0 to 2 and does not block them.

---

## 10. Checklist

### Phase 0: foundations
- [ ] Baseline the live schema into `supabase/migrations`; freeze the Drizzle trail
- [ ] Prove a fresh build from the repo matches live
- [ ] Re-enable scheduled jobs in order, each writing a run record
- [ ] Add last-success and missed-run alerts for jobs
- [ ] Update the position in `docs/care-platform/implementation-plan.md`
- [ ] Create `src/core/` with the lint boundary and its first tests
- [ ] Add the minimum supported app version table
- [ ] Remove the Heard leftovers once the Heard domain is confirmed off this deployment

### Phase 1: pre-agreement care
- [ ] Pre-assessment v5 catalogue and coordinated session
- [ ] Assessment v3 with grouped visits
- [ ] Populated acceptance of review, plan and proposal screens
- [ ] Device acceptance of the offline assessor workspace
- [ ] Assign `care_coordinator` and `care_clinical` to real people

### Phase 2: agreement
- [ ] Care package table and the single agreement function
- [ ] One price catalogue with effective dates; quotes and invoices snapshot prices
- [ ] Care-worker capability grants with audit
- [ ] Stage derivation reads the package

### Phase 3: delivery data
- [ ] Monitoring plans and items (7.5D)
- [ ] Observations, interventions, goal evidence with correction provenance and escalation links (7.5E)

### Phase 4: roster and visits
- [ ] Extract the shared offline layer into `src/core/offline` (7.5F)
- [ ] Roster and visit generation (Tranche 8)
- [ ] Visit events and the People app visit screens (Tranche 9)
- [ ] Visit verification: QR, GPS, attestation
- [ ] Same-day emergency alerting

### Phase 5: family portal
- [ ] Scope-aware routing and cache keys (10A)
- [ ] Journey, clinical and finance surfaces (10B)
- [ ] Code sign-in for families
- [ ] Data map, retention rules, data protection impact assessment

### Phase 6: money
- [ ] Idempotent Paystack webhook and reconciliation
- [ ] Recurring invoices from packages
- [ ] Timesheets from verified visits; pay run design
- [ ] All notifications through one dispatcher and the Email Library

### Phase 7: native People app
- [ ] Capacitor shell with native storage and location adapters
- [ ] Play Store release; then App Store
- [ ] Push notifications for rota changes

### Phase 8: reviews and reporting
- [ ] Form Library with versioned publishing
- [ ] Governed configuration with effective dates
- [ ] Outcome reporting against plan goals
