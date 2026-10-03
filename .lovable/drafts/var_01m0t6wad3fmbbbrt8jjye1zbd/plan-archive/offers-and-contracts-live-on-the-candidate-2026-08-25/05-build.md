## Build order

1. **Add the tab.** A new "Offers and contracts" entry on the candidate profile tab rail, with a count of anything waiting on an answer or a signature.
2. **Move offers in.** Lift the existing offers panel into the tab and leave leave-requests and engagements on Work.
3. **Pre-fill the offer composer.** Read profile, preferences, availability and shortlist context and open the form already populated, with each pre-filled value marked as coming from their record so you know what you are overriding.
4. **Add contracts to the tab.** The existing contract list, builder entry point, issue and signature actions, scoped to this person and started from the accepted offer.
5. **One history.** Merge offer events and contract events into a single trail on the tab.
6. **Retire the duplicate entry point.** The Workforce staff screen keeps compliance and the staff roll, and its contract authoring becomes a link into the person's tab.

## Technical notes

- No schema change is needed. `mu_offers`, `mu_offer_shifts`, `mu_contracts` and `mu_contract_events` already exist and already key on `person_id`; this is a front-end reorganisation plus a pre-fill layer.
- The pre-fill reads existing sources only: the person record, work preferences, the availability functions, and the shortlist row when the person arrived from an opportunity. It writes nothing until you send.
- Existing links that point at the old contract entry point continue to work by redirecting to the person's tab.
- The tab is built on the same `MuShell` primitives as the rest of the profile, so the look does not change.

## One open question

You uploaded a Contracts and Signing prototype. Tell me whether that is the visual reference for this tab and I will build against it; otherwise I keep the current profile grammar exactly as it is.
