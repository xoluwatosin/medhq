# Document consolidation pass

Documents only. No product code, schema, screens, styles, routes or configuration.

Target structure:

- Logic review: what we discovered. Evidence document, untouched.
- Account model: agreed identity and access model.
- UI architecture: agreed interface model.
- Architecture: final system contract incorporating both.
- Roadmap: execution order only, no independent product decisions.

## Step 1. Open decisions in the account model

Revision 2 of `account-model.md` needs these settled. Each carries a recommendation; tell me
where you disagree and the rest is written as recommended.

1. **One person table or two.** Recommendation: keep `care_people` separate from `mu_people`,
   matched on normalised email, because a candidate record carries employment and compliance
   weight a relative should never inherit.
2. **Who may create a grant.** Recommendation: staff only at launch. A family member with
   authority may request one, which becomes work for a coordinator to approve.
3. **When the six digit code is required.** Recommendation: never for the pre-assessment, always
   before clinical detail or money, then once per device for thirty days.
4. **What revocation reaches.** Recommendation: one action ends that person's links, account
   access to that client and pending invitations, and writes to `care_activity`. Other clients are
   untouched. Sub-question: block revoking the primary contact until another is made primary.
5. **Payer and finance.** Recommendation: `payer_person_id` is the billing fact, the `finance`
   scope is the viewing fact; set together by default, allowed to differ.
6. **Enquirer at promotion.** Recommendation: promotion creates the person and an active family
   member grant scoped to `plan_summary`, with authority recorded as not yet established.
7. **Referrer expiry.** Recommendation: referrer grants end the day care starts and become
   revoked rather than silently empty.
8. **Client switcher and identity.** Recommendation: scope resolves per client on every view and
   is never cached across a switch.

## Step 2. Rewrite account-model.md as Revision 2

Same structure, restated as agreed decisions rather than recommendations. Adds the settled
answers, the grant lifecycle state table, the scope vocabulary as a fixed list, and one
consolidated technical-change section the architecture can reference without restating.

## Step 3. Rewrite ui-architecture.md in place as Revision 2

One file, edited in place, Revision 1 superseded. The repository audit, file references, UI debt
and lineage decisions in Revision 1 are preserved and refined, not discarded.

New or corrected content:

- Client and family UI owns Cx shell, navigation, spacing, controls, rows, cards, action
  hierarchy, status, mobile and responsive conventions, but develops its own care patterns: care
  journey, current and next care, active care recipient, visit context, care team, upcoming care,
  family updates, pre-care versus active-care states, payment and Fund context.
- One identity, two contexts: Work and Care. Desktop and mobile switching, switch shown only when
  both exist, deep links, notification targeting, remembered context, revoked context, and the
  rule that professional access to a client never leaks into family access to the same client.
- Multi-client care profiles from day one: active recipient placement, switching on both
  breakpoints, deep links, refresh, default profile, revocation, single-profile and self-care
  cases, long and similar names, and leak prevention between records.
- Care plan lineage replaced with a dedicated issued-plan reader across the canonical fourteen
  sections, informed by but not built from `PortalContractDoc.tsx`.
- Family payments lineage replaced: reuse invoice calculation, money formatting, state and due
  dates; compose in Cx around what is owed, what for, when due, what is paid, what is needed.
- Care Fund kept as an optional substantial module: balance, contributions, contributors, share
  links, pots, allocation, history and payment, using Fund interactions and none of its skin.
- Shared component contract for the full `src/components/field/*` list, each with source of truth,
  width, overflow, responsive, focus, validation, error, disabled, read-only, loading, keyboard,
  touch target, long label, long value, missing data, offline and accessibility behaviour. Date
  overflow is solved once in `DateField`.
- WCAG 2.2 AA as a platform standard, written into the component contract.
- Full responsive architecture across the five bands, with 320px kept as the failure floor, and
  explicit answers for tables, rails, fact grids, tabs, sticky actions, alerts and document
  navigation.
- State vocabulary extended with newer version available, offline, queued and action blocked.
- Navigation documented for each capability combination, professional under Work, family under
  Care, context switching rather than one overloaded tab bar.
- Implementation guardrails and a definition of done phrased as the questions a developer must be
  able to answer from the document alone.

Final structure follows the twenty-two sections in your brief, headed `Medic Connect Care — UI
Architecture`, Revision 2.

## Step 4. Fold both into architecture.md as Revision 4

Changes confined to identity, access, permissions and interface ownership:

- Person, grant, scope and account replace the contact based access wording.
- Permissions restated as capability for staff, grant scope for everyone else.
- Client and family portal section set to link first, code before clinical, account last.
- Notes visibility resolves through `notes_shared`.
- Work and Care contexts and the one account to many clients rule added to the system contract.
- Additive tables from the account model added to the data contract.
- Revision history entry recording what Revision 4 changed and why.

## Step 5. Reorder roadmap.md

Execution order only, product decisions stripped out. Sequence follows the documents: account
model implementation, shared field layer and state components, Console into Mu, token cleanup,
then derived stage, age and vocabularies, then work engine, portals and Fund. Completed entries
stay.

## Technical notes

- Five files at most: the four documents and `roadmap.md`.
- `logic-review.md` gets no content change beyond, at most, a one line pointer noting its
  recommendations are now carried by the architecture contract.
- No second UI document is created and no migration is written in this pass.
