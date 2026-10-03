# Fix the invite record, the campaign counters, and the sign-up error message

Two separate faults, both confirmed in the data.

## 1. "Invited at" is wrong because campaigns never stamp it

What the database shows right now:

- 327 candidate profiles exist. Only **22** carry an `invited_at` date.
- 830 claim invites were sent (827 with a send timestamp).
- Of the invited addresses that do match a candidate profile, **303** still have no `invited_at`.
- **76** people have claimed an account with no `invited_at` at all, which is impossible in real life.

Cause: `invited_at` is only written by the one-at-a-time admin actions (`invite-candidate`, `candidate-claim`, staff conversion). The bulk campaign send writes a row into `claim_invites` and never touches the candidate record. So the admin roster's "Invited / Never invited" filter and the pool counters read a field that the main invite channel never fills.

Second, related fault: `claim_invites.person_id` is empty on **554 of 830** rows, and `claim_invites.claimed_at` is only set when someone arrives through the token link. Five people have claimed accounts that the invite table still calls unclaimed. The invite table and the candidate table are two separate truths that never reconcile.

### Fix

- Backfill: for every `claim_invites` row whose email matches a candidate, set `person_id`, and set that person's `invited_at` to the invite's send date where it is currently empty.
- Reconcile claims: where a person has `claimed_at` but the invite row does not, copy it across.
- Make it self-maintaining: a database trigger on `claim_invites` (insert and update of `sent_at`) that links `person_id` by email and stamps `invited_at` on the candidate; and a trigger on `mu_people.claimed_at` that writes back to the invite row.
- The campaign send path also stamps directly, so a send is recorded as an invite the moment it goes out rather than waiting for a sweep.
- Admin roster: "Invited" stops meaning "an admin pressed a button" and starts meaning "we have emailed this person an invite by any route".

## 2. Campaign engagement counters read zero while the events exist

`campaign_events` holds 161 opens and 27 clicks, yet every campaign row shows 0 opened and 0 clicked, because nothing aggregates events back onto the campaign. The `sent` count is also inflated: 3,939 sent events for roughly 854 real recipients, from repeated logging.

### Fix

- A function that recomputes each campaign's totals from distinct recipients in `campaign_events`, so a duplicate event can never inflate a number.
- The webhook calls it after each event batch, and a backfill runs once over the existing campaigns.
- Campaigns sent before tracking was switched on get labelled "not tracked" rather than showing a misleading zero.

## 3. The sign-up error still blames the password for everything

The breached-password wording is in place, but the fallback branch tells every other failure "check your password meets the requirements". A rate limit, a duplicate phone, or a network fault all read as a password problem, which is exactly the confusion reported. The check also relies on matching words in the error text rather than the error code the backend returns.

### Fix

- Match on the backend's `weak_password` code first, wording second.
- Give each real cause its own sentence: password rejected, address already registered, too many attempts just now, or a fault at our end. Only the first shows the password requirements panel.
- Log failed sign-up attempts (email, reason, timestamp) so a stuck candidate can be found without guesswork instead of being noticed by eye.

## Report back

Once applied I will report: how many candidates gained a correct invite date, how many invite rows were linked to a profile, the corrected open and click figures per campaign, and the list of sign-up failures over the last three days grouped by real cause.

## Technical notes

- Migration: backfill `mu_people.invited_at` / `claim_invites.person_id` / `claimed_at`; triggers `claim_invites_link_person` and `mu_people_claim_writeback`; function `private.mu_sync_campaign_stats(campaign_id uuid)` counting distinct `recipient_email` per `event_type`; new `auth_signup_failures` table with admin-only read and service-role write.
- Edge functions: `send-campaign` (stamp invites on send), `resend-webhook` (call the stats sync).
- Frontend: `src/pages/portal/JoinAccount.tsx` (error branching), `src/pages/admin/Campaigns.tsx` and `CampaignEditor.tsx` (percentages plus "not tracked" label), `src/pages/admin/MatchUniverse.tsx` (invited filter semantics).
