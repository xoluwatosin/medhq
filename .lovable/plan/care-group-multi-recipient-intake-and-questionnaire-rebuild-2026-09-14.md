# Care group, multi-recipient intake and questionnaire rebuild

Change-detection guard: the code has moved four commits past the audited version, but every change is the candidate-portal PDF-only upload fix and none of it touches Care. The database is unchanged — latest migration is still 0069. Proceeding on this baseline as agreed.

You asked for stage-by-stage approval, so this plan covers **Stage 1 only** in full detail, with the later stages listed so the shape of the whole build is visible. Each stage ends with tests and a report, and I will bring you the next stage's plan for approval before starting it.

---

## Stage 1 — The multi-person foundation

Today one care record means one person and one service. This stage introduces the structure needed to describe a real family — several people, several recipients, several services, one visit — without disturbing a single existing record.

### What gets built

**Family and care group.** A container that joins related people, recipients, requests and shared arrangements. It has a display name, a main address where one applies, a status and a record of who created it. It is not an account and grants nobody access to anything.

**Members and relationships.** People are joined to a group, and directional relationships between them are recorded from a governed list: mother of, father of, parent or guardian of, child of, spouse or partner of, sibling of, grandparent of, relative of, friend of, professional representative of, payer for, emergency contact for, and other with supporting text. Relationships describe people. They never grant clinical, journey or finance access, and nobody is ever merged because they share an email address.

**Care request.** The request records who got in touch, which group it concerns, the original enquiry details, status, source, callback details and notes. The enquirer, the payer, the authorised representative and the person receiving care can all be different people.

**Request recipients.** Each recipient on a request resolves to one person record and one canonical care record, with their role, their own address where it differs, and display order. One group can therefore hold several care records; clinical information stays with each recipient separately.

**Service intentions.** Instead of one service per record, a request carries structured service intentions: a service code, a proposed/confirmed/declined state, whether it is shared or individual, its reason and source, and a link to one or several recipients. This makes postnatal care for a mother and twins, nanny support shared by three siblings, and eldercare for a grandparent in the same family all expressible.

**Grouped assessment visit.** A visit can cover several recipients, holding the shared facts: time, location, assigned assessor, request context. Each recipient still keeps their own assessment work, document, routing snapshot, review and plan lineage. No recipient's clinical answers are ever combined with another's.

### Existing records

Nothing existing is rewritten. Every current care record keeps its ID, contacts, access grants, documents, assessment work, reviews and plan lineage, and nobody's stage changes. Each existing record gains a matching one-recipient group. The current single service field stays as the original-service projection for code that still reads it, and its status is documented.

### Permissions

All new tables get row-level security, least-privilege grants and controlled write functions with an explicit search path and a server-derived actor. Membership of a group and a family relationship grant nothing. Access stays an explicit grant for one exact recipient and one exact scope — so one relative can have clinical access to one person and journey-only access to another, and a payer can have finance access with no clinical access at all.

### Tests

Rollback-safe database tests proving: one group holds several people and several care records; an enquirer need not be a recipient; a shared email does not duplicate a person; relationships create no access; access stays recipient- and scope-specific; a mother and twins can share postnatal support while the twins also share nanny support and a grandparent has eldercare in the same group; one recipient can hold several valid service intentions; an incompatible service and recipient combination is rejected or flagged for clinical resolution. Plus typecheck, full test suite and production build.

### Technical detail

- Additive migrations beginning at `0070`. No historical migration is edited and no clinical document is mutated.
- New tables: `care_groups`, `care_group_members`, `care_person_relationships`, `care_requests`, `care_request_recipients`, `care_service_intentions`, `care_service_intention_recipients`, `care_assessment_visits`, plus a nullable visit reference on `care_assessment_work`.
- Relationship and service-intention vocabularies are table-backed and versionable, following the existing `care_relationship_terms` pattern.
- Backfill is additive only: one group per existing `clients` row, created deterministically, with `clients.service_id` preserved untouched.
- Writes go through SECURITY DEFINER RPCs with `search_path` set, a permission helper, request/client scoping and idempotency on retry. Direct writes by ordinary roles stay blocked.
- `private.care_plan_issue_ready(...)` stays deliberately closed.
- New SQL suite `supabase/tests/care_group_foundation.sql`, synthetic fixtures only, cleaned up completely.

---

## Later stages (outline only — each needs its own approval)

**Stage 2 — Admin intake and preparation workspace.** Compact grouped sections for Request, People, Recipients, Relationships, Services, Assessment visit and Questionnaire; a route summary shown before sending; correction with a reason; one coordinated questionnaire journey sent. Plus the Restart on latest questionnaire action for unsubmitted drafts, with versions shown, a required reason, the old draft superseded rather than deleted, and submitted documents never eligible.

**Stage 3 — Pre-assessment v5.** New immutable version, v4 retired and untouched. Routing conversation first, multi-select recipient-bound services, extended condition grammar evaluated identically in browser and server, the stray childcare question removed from the adult route, guided one-question-at-a-time screens with restrained section covers, tappable numbered navigation, proper controls for names, dates, conditions, medicines, allergies, hospital and professional information, real private uploads with server acknowledgement, appointment preferences that resolve weekdays into real future dates and period-appropriate times, and a grouped review before submission.

**Stage 4 — Professional assessment v3.** New immutable version, v2 retired and untouched. The 165 narrative boxes reviewed and replaced with structured clinical capture where appropriate, optional notes retained where explanation adds value; recipient and service routing; a recipient switcher on grouped visits; carried evidence split into clinical evidence to verify, context from the family, and authority and consent, with a section-level Confirm remaining unchanged that records actor and time per item.

**Stage 5 — Assessor home and preparation.** The visit list showing recipient names, group, date and time, address, services, location kind, status and offline state. Opening a visit becomes a read-only preview that does not start anything: separate Prepare for offline use and Begin assessment actions, with an explicit at-the-location confirmation before the start call. Offline capture scoped by user, visit, recipient and document, with honest acknowledged states.

**Stage 6 — Documentation and final report.** Care architecture, questionnaire engine, UI architecture, implementation plan and roadmap updated. T8 and later stay unstarted and unmarked.

Out of scope throughout: packages, prices, staffing, matching, roster, visits, check-in, delivery records, medicines administration, longitudinal vitals, incidents, the full family portal, invoicing, Paystack and care-plan issuance.
