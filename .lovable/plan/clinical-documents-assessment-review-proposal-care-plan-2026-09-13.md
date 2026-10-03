# Clinical documents: assessment, review, proposal, care plan

Four specifications, delivered as one coordinated correction to the journey that already exists: professional assessment → clinical review → care-plan draft, plus a new client-facing proposal. No package, staffing, roster or visit work.

## What I confirmed first

- The published professional assessment definition is version 1 and holds only 2 sections: it is the structural placeholder, not a real questionnaire. The pre-assessment is at version 3 with 26 sections, and the care plan definition already holds exactly 14 sections.
- Live clinical records exist: 1 sent assessment, 1 sent care plan, 1 sent and 2 part-finished pre-assessments. None of these will be touched; each stays pinned to the definition it was answered on.
- Review, accept and return already run server-side with clinical-only authority, immutable sent records and one plan draft plus plan and package work on acceptance. That stays; the review screen is what falls short of the specification.
- The care plan screen already has no Issue action, so nothing is removed there. The server gate behind issuing is what gets audited and strengthened. The one existing sent care plan is historical: it stays immutable, reproducible and labelled as recorded.

## How this will be delivered

Because of its size, the work lands in four build passes, in this order. Each pass ends with its own tests, typecheck and build, and nothing moves on until the previous pass passes.

### Pass A — the professional assessment

- Generate a new immutable assessment definition (version 2) from the specification, using the same generator approach already proven for the pre-assessment: universal sections (visit and identity; consent and participation; presenting situation and outcomes; health history and observations; medicines and allergies; communication and wellbeing; daily living; mobility, falls and environment; nutrition, hydration and continence; skin, wounds and pain; safeguarding and risk; existing network; assessor synthesis; completion) plus service modules for antenatal, postnatal and newborn, post-surgical, eldercare, clinical home care with its sub-modules, nanny and childcare, and children with additional needs.
- Version 1 is retired, never edited. Assessments already started or sent keep their own version.
- Only applicable questions show, decided by the same rules in the browser and on the server (recipient, age band and service), reusing the condition engine built for the pre-assessment.
- Every material carried family answer must be Confirmed or Amended; an amendment records the replacement value, reason, author, time and the evidence it replaces. Family answers are never shown as the assessor's own.
- Offline capture, save states and submission stay on the existing append-only device store. No clinical information in browser local storage. Submission stays idempotent, freezes the record and opens exactly one clinical review.

### Pass B — clinical review

- Rebuild the review screen to show the whole frozen assessment: every applicable section and answer, carried evidence with each Confirm/Amend and its provenance, medicines and allergies, observations, risks and flags, uploads and referenced plans, assessor synthesis, anything left unanswered or not assessed, and earlier versions with their return reasons. No counts-only summary.
- Add the twelve-point structured review checklist, each recorded as Meets requirement / Needs amendment / Not applicable, with a note required whenever amendment is needed.
- Return keeps the frozen source, requires a structured reason with instructions and priority, opens exactly one successor, shows the reason to the assessor, and is safe to retry.
- Accept stays clinical-only, blocks self-approval and coordinator approval, closes review, and opens exactly one plan draft, one prepare_plan and one agree_package. Accept never issues a plan.
- Two note types are kept apart: decision notes that belong to the record, and internal operational notes that never reach a client document.

### Pass C — the client-facing proposal, "Proposed care and support"

- A new versioned projection generated from one accepted assessment and one care-plan draft version, holding only the client-safe content listed in the specification, labelled Proposal on every view, and stating plainly that it is not the final care plan and not worker instructions.
- Internal deliberation, risk scoring, safeguarding hypotheses, matching notes, margins, work state and record identifiers are excluded by construction, not by hiding.
- Each send stores the version, recipient, time and delivery result; regeneration makes a new version and never overwrites a sent one.
- The client records Agree, Request changes or Need a call, with comments tied to the exact version. Requested corrections route back to clinical review; they never edit the plan directly.
- Viewing requires the correct client-scoped clinical grant. Costs are a link to the separate quotation or invoice; the finance pathway itself is not built now. Agreement or payment never issues the plan.

### Pass D — the operational care plan, and closing premature issue

- Keep the 14 canonical sections exactly as they are, and fill out the drafting content each section needs per the specification, with needs, goals and tasks held against the correct plan version.
- No Issue action is added to the screen, and the one already absent is not reintroduced. Instead, audit and strengthen the existing server gate so issuing is refused until every prerequisite genuinely exists: accepted assessment, agreed effective package, confirmed staffing and capabilities, viable cover, final clinical refinement, verified medicines and critical instructions, confirmed equipment, resolved client comments and Clinical Lead approval. The gate stays shut because the package and staffing layers do not exist yet; no placeholder flags are invented to open it.
- A draft is never labelled Issued, and the client is not advanced to a care-running state. The existing sent version-1 plan is left exactly as recorded: not reopened, not relabelled, not migrated.

### Throughout: permissions, versioning, notifications

- Only clinical staff may write assessment content, review decisions, plan content and the needs, goals and tasks tables. A generic admin token must not reach them through direct table writes; this is enforced in the server functions and in row-level policies, and tested by attempting direct writes, not by checking what the screen shows.
- Sent, frozen and issued documents stay immutable, with provenance links, authorship, timestamps and content hashes preserved and superseded versions clearly not current.
- Notifications reuse the existing dispatcher: returned assessment to the assessor, accepted assessment to the clinical planning queue, proposal sent, commented, agreed or changes requested to the owner, and refinement actions to the responsible clinical owner. Deduplicated by event key, carrying no clinical answers, and scoped to the recipient.

## Technical notes

- Additive migrations from `0055` onwards: the assessment definition v2 publication, proposal tables (`care_proposals`, sends, comments) with grants and row-level policies, review checklist storage on the review record, and the permission corrections. No destructive changes.
- Definition generation follows `scripts/pre-assessment/*` and validates through the existing server publication guard before publishing.
- Tests are synthetic only, rolled back or cleaned: SQL suites alongside `supabase/tests/care_t7_correction.sql` for review, proposal and plan behaviour, and Vitest for routing, applicability, Confirm/Amend and offline ordering.
- Screens are checked at 320px and 390px, including the assessor's offline status and bottom actions. Real-device checks stay open.

## Out of scope

Packages, staffing, matching, assignments, roster, worker portal, visits, the full family portal, invoicing and Paystack, wider Admin structure, Talent and Workforce changes, identity merging, and automatic portal grants. The backend key `prepare_plan` is not renamed.
