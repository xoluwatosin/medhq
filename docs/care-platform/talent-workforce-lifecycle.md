# Talent and Workforce: one person, one account, changing state

13 September 2026. Foundation only. The Workforce portal, HR functionality and
Talent engagement segmentation are later builds.

## Principle

One person -> one account -> lifecycle changes. Never a candidate record copied
into a staff record. A person may move Talent -> Workforce -> Talent again
keeping `mu_people.id`, `auth_user_id`, profile, CV, documents, verification,
applications, availability, preferences, offers, contracts and activity.

## Canonical state

`mu_people.lifecycle_state` is a generated column:

```
workforce  when is_staff is true and staff_status in (pending, active, on_notice)
talent     otherwise
```

It is derived, not writable, so no screen can disagree with it.

## Transitions

| Operation | Rule |
| --- | --- |
| `mu_become_workforce(person, payload)` | Admin only. Requires a signed or active contract. Idempotent: returns `changed:false` if already Workforce. Sets `is_staff`, `staff_status`, start date, clears `staff_end_date`, logs `became_staff`. Grants no capability or role. |
| `mu_return_to_talent(person, reason)` | Admin only. Blocked by live care assignments, requested/scheduled/in-progress assessments, or issued/signed/active contracts. On success closes employment (`exited`, `staff_end_date`), revokes professional capabilities, logs `returned_to_talent`. Cancels and reassigns nothing. |
| `mu_workforce_blockers(person)` | Reports what currently stands in the way. |
| `mu_portal_mode()` | Resolves the signed-in account to `talent`, `workforce` or `none`. |

### Decision: the transition stays an explicit Admin action

Offer acceptance and contract signature are recorded separately. A signed
contract is the gate, but the move into Workforce is still performed
deliberately by an administrator rather than fired automatically on signature,
because onboarding and start date are not reliably represented yet.

## Ownership boundaries

- **Talent owns:** professional profile, qualifications, candidate verification,
  Talent availability and preferences, opportunities, applications, hiring history.
- **Workforce owns:** the active employment relationship, staff status, staff
  contracts, Workforce compliance, professional capabilities, assignments and
  work, later leave/training/payments.
- **The person owns:** identity, the single sign-in, canonical contact details,
  durable history and provenance.

Employment state and capabilities stay separate. Clinical Assessor remains
active Workforce + sign-in + explicit assessor capability, exactly as hardened
in Care Tranche 6.

## Talent pool visibility

The default Match Universe list shows `lifecycle_state = 'talent'`. Workforce
people are filtered out of the default view only; nothing is deleted or
archived, and they remain reachable under "On the Workforce" and "Everyone",
and in Workforce itself.

## Engagement signals already available (for later segmentation)

Reliable, event-backed signals that exist today:

- `mu_people.last_activity_at`, `claimed_at`, `invited_at` (account claim, invite state)
- `mu_activity` rows (actions with actor and timestamp)
- `mu_documents.created_at` (document upload), `mu_cv_parses` (CV supplied)
- `mu_availability_days` / `mu_availability_recurrence` updates
- `mu_work_preferences.updated_at`
- `join_applications` / `matchmaker_applications` submission dates
- `mu_offers` responses and `mu_interview_slots` bookings
- `mu_verifications` (contact verification)

Email opens are not treated as engagement. No score is computed.
