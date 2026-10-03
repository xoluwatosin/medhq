# Full email tracking: every send, every recipient, every outcome

Today the campaign pipeline already records per-recipient events (sent, delivered, opened, clicked, bounced, complained) through the Resend webhook into `campaign_events`, plus aggregate counters on `campaigns`, plus first-touch UTM attribution on the site. The gaps: we cannot see *which* link was clicked, transactional emails are invisible, there is no per-person timeline, and nothing ties an email to what the person did afterwards. This plan closes all four.

## 1. One event stream for every email

- Extend `campaign_events` into a general `email_events` table (or keep the name and add columns): `event_type`, `recipient_email`, `campaign_id` (nullable), `template` (for transactional sends), `link_url` (which link was clicked), `resend_email_id`, `metadata` jsonb, `created_at`.
- Tag every transactional send (`send-candidate-email`, `notify-candidate-offer`, `send-contract-email`, `request-candidate-documents`, claim invites, etc.) with `template` and `person_id` tags in the Resend payload, the same way campaigns send `campaign_id`. The webhook already parses tags; extend it to route non-campaign events into the same table.
- Enrich the webhook's click handling to store `data.click.link` as `link_url`, and record IP/user-agent from Resend metadata where present.
- Migration adds the columns, indexes on `(recipient_email)`, `(campaign_id)`, `(template)`, and GRANTs: `authenticated` read for admins via existing admin check, `service_role` full.

## 2. Per-person email timeline

- A SQL view or RPC `email_history_for(email)` returning the deduped, chronologically ordered event list across campaigns and transactional sends.
- Admin UI: on the Match Universe person page and the Audience page, an "Emails" section showing every email sent to that person with its status journey (sent to delivered to opened to clicked) and which link they tapped.
- Campaigns list gains open rate and click rate percentages, not just raw counts.

## 3. Click-level insight

- Campaign stats break down per link: which URL, how many unique clickers. This tells you whether the claim link, the WhatsApp link, or the website link is doing the work.
- Follow-up targeting uses this: "resend to people who opened but never clicked the claim link" becomes a one-click audience filter.

## 4. Email-to-outcome funnel

- Join email events to downstream state we already have: `claim_invites.claimed_at`, `mu_people` verification state, offer acceptance. One query per campaign: sent, delivered, opened, clicked, claimed, verified, placed.
- Surfaced as a funnel strip on the campaign editor stats row.

## 5. Deliverability guardrails

- `email_suppressions` already auto-fills on bounce/complaint; add a campaign-level bounce/complaint rate warning (red badge over 2% bounce or 0.1% complaint) so a list problem is visible before it damages sender reputation.
- Weekly digest option later; not in this pass.

## What we deliberately do not do

- No tracking pixel of our own: Resend's open tracking already covers it, and a second pixel adds nothing.
- No device fingerprinting beyond what Resend reports. Open rates remain directional (Apple Mail pre-opens), so the dashboard labels opens as "approximate" and ranks clicks and outcomes as the trustworthy numbers.

## Sequence

1. Migration: columns, indexes, grants on `campaign_events`; webhook tag/link handling.
2. Tag all transactional sends; verify events land.
3. Admin: per-link stats, percentages, per-person timeline, funnel strip.
4. Audience filters built on engagement (opened-not-clicked, never-opened).

## Technical notes

- Files: `supabase/functions/resend-webhook/index.ts`, `send-campaign/index.ts`, the six transactional send functions, `src/pages/admin/Campaigns.tsx`, `CampaignEditor.tsx`, `MatchUniversePerson.tsx`, `Audience.tsx`.
- One migration via the standard migration tool; RLS admin-only read on the events table.
- No new secrets needed; `RESEND_WEBHOOK_SECRET` is already configured.
