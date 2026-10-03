# Intake Health becomes a behaviour intelligence layer

Verified before writing this:

- 325 of 327 candidates now carry an invite date (the backfill and triggers worked). The two without were never emailed.
- `signup_failures` exists and is empty, so the new logging is live but has not caught anything yet.
- The three claim campaigns show `tracking_enabled = false` and genuinely have no opens or clicks recorded. The 161 opens and 27 clicks in the system belong to transactional sends and carry no campaign id. So "Not tracked" is the correct label for those three, and it is what the dashboard should be showing.

## 1. Verify the live dashboards

Drive the published admin Campaigns and Campaign Editor pages in a browser session and confirm, with screenshots:

- Delivered shows 273/276 and 548/551 with the failed count beside it.
- Opened and Clicked read "Not tracked" for the three pre-tracking campaigns rather than a misleading zero.
- Match Universe roster: "Invited" now returns the full invited population, not 24 people.

Anything that does not match gets fixed in the same pass.

## 2. Follow-up emails to invited but silent candidates

- A saved definition of "silent": invited more than 48 hours ago, no account, or an account with no profile save, no document, no preference set.
- A branded follow-up in the same navy grammar as the campaign emails, one send per person, recorded so nobody is emailed twice.
- Queued by a scheduled job that runs daily and sends only to people who cross the 48 hour line, with an admin screen to review the queue and hold it back before it sends.

## 3. Admin report: invited but no profile or account

A new admin page listing every invited address with what actually happened to it: no account created, account created but no profile, profile open but untouched, or fully active. Where a sign-up failure was logged, the row shows the real reason (password rejected, already registered, rate limited, invalid address). Exportable to CSV.

## 4. Alerts on sign-up failure spikes

- A rolling count of failures per reason per hour.
- A threshold rule (for example five of the same reason within an hour, or any single hour above the trailing daily average) that raises a banner on the admin home and emails the admin address.
- Visible history so a spike can be read after the fact, not only in the moment.

## 5. The behaviour database

One place that answers "what is actually happening", built from data the backend already holds and refreshed automatically.

**Candidate behaviour** — sign-up, verification, profile saves, preference changes, availability edits, document uploads, questions answered and abandoned, time from invite to claim, time from claim to a usable profile, the exact step each stalled person is stuck on, and repeat verification code requests as a struggle signal.

**Campaign behaviour** — per campaign and per link: sent, delivered, opened, clicked, bounced, complained, unsubscribed, then claimed, verified and placed. Which link did the work. Which audience segment converts. Bounce and complaint rates flagged when they threaten sender reputation.

**Website behaviour** — first-touch and last-touch source, medium and campaign already captured by the UTM layer, tied to whichever form or sign-up the visit ended in, so a campaign can be traced from send to submitted enquiry.

**Health** — a single intake health screen with the funnel end to end, the drop-off between each pair of steps, and a named list behind every number so a count is always clickable through to the actual people.

Refresh runs on a schedule so the screens are current without anyone pressing anything, and every figure states when it was last computed.

## Sequencing

1. Live verification of the dashboards.
2. The invited-but-inactive report plus the sign-up failure reasons.
3. Alerts.
4. Follow-up email queue.
5. The behaviour warehouse and the intelligence screens, largest piece, built on the tables the first four steps establish.

## Technical notes

- New rollup tables in a private schema, refreshed by `pg_cron`: `analytics_candidate_journey` (one row per person, milestone timestamps), `analytics_campaign_daily`, `analytics_signup_failure_hourly`, plus a materialised funnel view. Sources: `mu_people`, `mu_activity`, `mu_parsed_fields`, `mu_documents`, `mu_verifications`, `claim_invites`, `campaign_events`, `signup_failures`, `contact_submissions`, `join_applications`.
- Read paths through security-definer RPCs with admin-only access; no new client-side table grants.
- New edge function `send-followup-nudge` and a `cron` job for the daily queue; alerting reuses the existing Resend sender.
- New admin routes under `/admin/intelligence` with tabs for Candidates, Campaigns, Acquisition and Health, following the existing MuShell grammar and `adminDb()` access.
- No new secrets. No visual redesign of existing pages.
