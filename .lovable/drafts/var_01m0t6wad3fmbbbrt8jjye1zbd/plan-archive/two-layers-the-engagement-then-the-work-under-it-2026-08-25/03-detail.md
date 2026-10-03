## What you would see on the candidate

The tab becomes **Engagements**, and it reads in two blocks.

**1. Engagements.** Usually one live entry, sometimes a history of past ones. Each shows type, period, status, and the signed document. Opening it gives one page:

- **Terms** — pay basis, period, scope of work, hours, place, notice. Written at proposal.
- **Their answer** — accepted or declined, when, and anything they said.
- **The paper** — wording, annexes, signature, countersignature, filed PDF. Drafted automatically from the terms when they accept, so you review and issue rather than author from a blank.

There is no "build a contract" step that starts over. The engagement is one record from first draft to filed PDF.

**2. Work under this engagement.** The shift and assignment offers, newest first, each with its dates, hours, rate and their answer. These need a live engagement to exist. If someone has none, the panel says so and points at creating one, rather than letting you offer work that rests on nothing.

## How the types differ

| Engagement type | Period | Paper | Work offers under it |
| --- | --- | --- | --- |
| Employment | Open ended | Full contract, both sides sign | Rota allocations, booked not negotiated |
| Placement | Fixed term with a client | Full contract, both sides sign | Assignments within the term |
| Bank / locum | A scope for a stated period | Agreement covering the scope | Shift and assignment offers, rate per offer |

Rates: employment and placement carry the rate on the engagement, so a work offer inherits it and only rarely overrides. Bank and locum carry no standing rate, so every work offer states its own.

## Where templates fit

A template belongs to an engagement type plus a role. Choosing it at proposal prefills terms, wording and annexes at once, so the single hire and the batch run start from the same source. Batch issuance stays as it is; it creates engagements rather than bare contracts.

## Technical notes

- No table merge. `mu_offers` keeps both layers, separated by a new `engagement_type` on the record: `employment`, `placement`, `bank` establish an engagement; `shift` and `assignment` are work under one. A `parent_offer_id` links work offers to their engagement.
- `mu_contracts` gains `offer_id`, tying the document to the engagement offer it came from. Signing, tokens, PDFs and events are untouched.
- Accepting an engagement offer drafts its contract from the type's template, prefilled from the terms, instead of leaving an empty "build contract" action.
- Work offers skip the document layer entirely and keep their current accept/decline behaviour in the portal.
- `ContractEditor` stays the document surface, opened from inside the engagement.
- Existing data: offers with shifts become `shift` work offers; other existing offers become `placement` engagements; contracts without an offer show as engagements that start at the paper stage.
- Schema changes are additive and apply when this draft is accepted.
