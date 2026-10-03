# Intake Integrity Correction

One correction pass across the existing journey: pre-assessment, professional assessment, clinical review, proposal, care-plan draft. No Tranche 8, monitoring, visits, medication, roster or staffing work.

## What I confirmed against the live system first

- Latest migration is `0060`. New work starts at `0061`.
- `private.care_plan_draft` returns **any** draft care plan for the client and ignores the assessment it was built from. The already-accepted branch of `care_assessment_accept` picks the earliest draft or submitted plan by client, not by `_w.document_id`. Both confirm the lineage defect.
- `private.care_plan_issue_ready` currently returns true on accepted assessment + active episode + active delivery assignment + sent proposal. The gate is open and must be closed.
- `anon` and `authenticated` both hold SELECT, INSERT, UPDATE and DELETE on `care_proposals`, `care_proposal_sends` and `care_proposal_comments`. Only row-level rules stand in the way today.
- Assessment service routing runs through `private.care_service_key`, which reads `clients.service_id` — the original enquiry route, not the service confirmed at pre-assessment.
- Assessment applicability in the assessor workspace only understands `when.module`, while the questionnaire engine in `src/lib/care.ts` supports service, recipient, age, field-value, allOf, anyOf and not.
- Review state (checklist, decision, reviewer, reason) lives on `care_assessment_work`, one row per work item, reused across returned and resubmitted assessment versions.

## Delivery order

Six passes. Each ends with its own SQL tests, Vitest, typecheck and build; nothing moves on until the previous pass is green.

### Pass 1 — Document-bound clinical review

- New `care_assessment_reviews`, one review per submitted assessment document version: work, document and client links, controlled status and decision, checklist, decision reason, return category, return instructions, return priority, decision notes, reviewer, started, completed, timestamps.
- Submission opens exactly one review for that exact document, idempotently. Returning freezes that review; the successor submission opens a fresh one. A version-1 checklist can never become the version-2 checklist.
- The existing columns on `care_assessment_work` stay as a current-state projection kept in step by the server, and are documented as such. Nothing is dropped.
- Keep the twelve checks, `met` / `not_met` / `not_applicable`, a note required for `not_met`, acceptance needing all twelve decided and none unmet. Return requires category, instructions and priority as separate structured fields, not one textarea.
- Self-review stays blocked.
- Review screen shows the review bound to the version being read, with earlier reviews listed as history rather than merged in.
- `care_assessment_reviews` has every default privilege revoked from `anon` and `authenticated`, with only the minimum SELECT needed by its clinical-only row policy granted back. Every review write goes through a SECURITY DEFINER function.

### Pass 2 — Proposal access, responses and privileges

- Reading proposal clinical content requires both an active client-scoped clinical grant and that exact proposal version having been sent to that person. Delivery assignment grants nothing. No new scope is introduced.
- Journey-only users never hold row access to anything carrying the proposal content. They read status through a dedicated function or view returning non-clinical metadata only — version, status, sent time, response state. Hiding fields in the browser is not treated as a boundary.
- New version-bound response record: `agreed`, `changes_requested` (comment required) or `call_requested` (comment optional), with person, time and provenance. Agreement applies to that version only; a new version carries no inherited agreement. Agreement does not issue a plan or start care. Requesting changes routes clinical work and never edits the plan.
- Revoke all privileges on `care_proposals`, `care_proposal_sends`, `care_proposal_comments` and the new response table from `anon` and `authenticated`, then grant back read only where a policy needs it. All writes go through SECURITY DEFINER functions with explicit `search_path` and server-derived actor.
- Client-facing wording: Agree, Request changes, Need a call. "Sent" is never shown as "Agreed".

### Pass 3 — Carry-forward classification and active evidence

- Add a governed field-level carry classification to the definition grammar: `clinical_evidence`, `context`, `operational`, `authority_consent`, `not_carried`, validated at publication. It is never inferred from section names in the browser.
- Publish pre-assessment v4 with the classifications applied; retire v3. Existing drafts and submissions stay pinned to their own version and are never migrated.
- At pre-assessment finalisation, derive and freeze an active evidence projection from the frozen definition, final responses, final recipient facts, final service routing and applicability. Raw responses stay untouched, including answers hidden by later routing changes.
- Only active `clinical_evidence` requires Confirm or Amend, enforced identically in the browser and on the server.
- Assessor screen separates Clinical evidence to verify (Confirm/Amend), Context from the family (read only) and Authority and consent. No single long list.

### Pass 4 — Confirmed intake service and assessment applicability

- Keep three distinct meanings: enquiry service (historical, never rewritten), confirmed intake service (resolved from the submitted pre-assessment; the routing truth for the professional assessment), and episode service (later, on the episode).
- On assessment start, resolve confirmed intake service, recipient and age facts and applicable modules from the exact source pre-assessment, and freeze them onto the assessment document. Stop depending on `clients.service_id`.
- Assessment applicability uses the one existing condition grammar on both sides — service, recipient, age, module, field value, allOf, anyOf, not. No second conditional language.
- The frozen route stays frozen mid-visit. An explicit reroute action records old and new routing facts, requires a reason, preserves provenance and decides whether a new document version is required.

### Pass 5 — Assessment → plan → proposal lineage

- One accepted assessment document version maps to exactly one care-plan draft built from it. `private.care_plan_draft` resolves by `built_from_id`, not by client and status.
- Retrying acceptance returns the same linked plan; the already-accepted branch resolves from `_w.document_id`. An unrelated existing draft is never silently adopted — the conflict is handled explicitly under the current versioning model.
- Proposals are projected from the plan tied to the accepted assessment being worked, never "latest plan for client". Lineage from pre-assessment document through work, assessment document, review, plan document to proposal version is always reconstructable.

### Pass 6 — Close the issue gate, tests and documentation

- `private.care_plan_issue_ready` returns false again, with a comment naming the layers that will replace it. No placeholder booleans, no Issue action in the UI. The existing historical issued plan is untouched.
- Rollback-safe SQL tests plus Vitest covering: review versioning and the acceptance and return rules; carry-forward classification behaviour and hidden-answer preservation; the Nanny enquiry resolving to Children with additional needs at intake while history is preserved; age, recipient and module applicability matching between browser and server; lineage across two assessments; proposal access, version-specific agreement and comment requirement; direct anon and authenticated insert, update and delete failing on every proposal and review table while RPC paths still work; and the issue gate still refusing.
- Update the Care architecture and roadmap documents for every one of these decisions. No future work is marked complete.

## Technical notes

- Additive migrations from `0061`. No historical migration is edited, no clinical record is migrated, no second document system is created, assessor assignment stays out of delivery assignments, and measurement fields are not turned into observation storage.
- Everything listed under "existing architecture to preserve" stays as it is.
- Later care-plan Pass D work — section payload schemas, issued snapshot, content hash over needs, goals and tasks, Clinical Lead approval, medicines and equipment verification, package and staffing gates, final refinement — is out of scope here.

## Not in this pass

Tranche 8, monitoring, visits, medication, roster, staffing UI, and the remaining 7.5D–7.5F work.
