# Availability that earns its keep, offers, and an internal workspace

Three connected pieces: make availability answer real questions on the admin side, let admin offer work (shifts or ongoing roles) that the candidate accepts or declines, and give placed people a separate internal workspace with rosters and leave.

## 1. Admin availability: from a read-only calendar to answers

Today the admin profile embeds the same candidate calendar in read-only mode. That shows one person's month; it answers nothing about the pool.

Three new views:

- **Who is free** (`/admin/match-universe/availability`): pick a date or a date range plus a time block (morning / afternoon / evening / night), filter by profession, state and LGA, and get a ranked list of people free in that window. Three states stay honest: available, not available, not said. Not said never hides anyone, it sorts below and is labelled.
- **Coverage on an opportunity**: on the opportunity Matches tab, a date-window strip above the candidate list. Each match row gains an availability chip for that window, and a "coverage" tile shows how many of the top matches are free, unavailable, or silent.
- **Freshness and chasing**: a panel listing people whose availability is stale (over 14 days) or never set, with a select-and-nudge action that sends the existing candidate email asking them to update their calendar.

Admin also gets an editable version of the person calendar (currently read-only), so a phone call can be recorded on the candidate's behalf. Every admin edit writes an activity entry naming the admin.

## 2. Offers: one system for shifts and ongoing roles

A single offer record covers both shapes:

- **Shift offer**: one or more dated slots with start and end times, a rate, a location.
- **Role offer**: an ongoing engagement with a start date, pattern (for example live-in, nights), and a rate.

Flow, with a complete lifecycle on both sides:

```text
draft -> sent -> viewed -> accepted | declined | expired | withdrawn
                    accepted -> engagement (role)  or  booked shift
```

- Admin sends an offer from an opportunity's match list, from a shortlist row, or ad hoc from a person profile. Offers can carry an expiry.
- The candidate sees offers in a new "Offers" tab in their portal with a clear accept or decline, and a reason if declining.
- Accepting a shift writes a booking; accepting a role opens an engagement.
- Declining feeds back into matching as a signal, and never as a penalty on their credential state.

**Auto-blocking**: accepted shifts and approved leave write to the availability calendar as unavailable for those hours, so nobody can be double-booked. These blocks are visibly marked as system-set (booked / on leave), distinct from the candidate's own answers, and are released if the shift is cancelled or leave is withdrawn.

## 3. Contracted people: a separate internal workspace

Recommendation, matching your answer: keep one person record, but change the room they live in.

- When an offer converts into an engagement, the person is flagged as engaged. They stay one profile (one identity, one document set, one credential ladder), but admin sees them under a new **Workforce** area rather than the talent pool roster. The roster stays for sourcing.
- Their portal changes shape too: job-seeking tabs (Offers browsing, looking status, applications) recede while contracted, and internal tabs appear:
  - **My roster**: upcoming shifts and the current engagement.
  - **Leave**: request leave with dates and a reason; admin approves or declines; approved leave blocks the calendar.
  - Documents, credentials and availability stay, because compliance does not stop at placement.
- When an engagement ends, they return to the pool automatically with their history intact, and job-seeking features come back.

This gives internal-vs-external separation without ever forking the person record, which would break the one-profile-per-human rule the whole Match Universe rests on.

## Technical outline

New tables (all in `public`, admin-write via existing admin checks, candidate access scoped to their own `mu_people` row through `mu_my_person_id()`):

- `mu_offers` — person, optional opportunity, kind (`shift` | `role`), status, rate, notes, expiry, sent/viewed/responded timestamps, decline reason, actor trail.
- `mu_offer_shifts` — dated slots on a shift offer (date, start hour, end hour, location).
- `mu_engagements` — person, opportunity, start/end date, pattern, status (`active` | `ended`), created from an accepted role offer.
- `mu_leave_requests` — person, engagement, from/to dates, reason, status (`requested` | `approved` | `declined` | `withdrawn`), approver trail.
- `mu_availability_days` gains a `source` distinction so system blocks (booked, leave) are separable from candidate answers, and are re-derivable rather than destructive.

New functions: `mu_available_people(_from, _to, _blocks, _profession, _state, _lga)` for the pool view; `mu_send_offer`, `mu_respond_offer`, `mu_request_leave`, `mu_decide_leave` as security-definer RPCs with activity logging; triggers that sync accepted shifts and approved leave into availability and reverse on cancellation.

UI: new `AvailabilityBoard` admin page, an editable mode on `AvailabilityCalendar`, coverage strip in `MatchmakerMatches`, an Offers tab and Roster/Leave tabs in the portal, and a Workforce section in the Match Universe shell.

## Sequence

1. Offers and engagements data model plus RPCs.
2. Admin availability board, coverage strip, freshness chasing, editable admin calendar.
3. Offer sending UI (admin) and Offers tab (portal), with auto-blocking.
4. Workforce area, roster and leave, and the contracted portal shape.
