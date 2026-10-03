# System management: plan

Revision 1, 3 October 2026. Draft for approval.

The Admin runs the business well and the system poorly. People, care, talent and content each have a proper work surface; the platform underneath them does not. This plan covers the five things an operator of a growing health business needs from Administration, sized so that one admin can run it today and a team can share it later without a rebuild.

`roadmap.md` carries the checklist. This document explains what each piece is and why it is shaped that way.

---

## 1. Where things stand

| Area | Today | Gap |
|---|---|---|
| Health | Intake spike alerts only (`admin_alerts`, `private.analytics_check_alerts()`, `send-admin-alert` to a hard-coded address) | Seven cron jobs, about fifty edge functions, `care_notifications`, email bounces, parse queues and Paystack webhooks fail silently |
| Audit | Nine separate logs: `admin_access_log`, `admin_login_log`, `care_access_log`, `care_activity`, `mu_activity`, `care_form_revision_events`, `job_key_audit`, `campaign_events`, `mu_contract_events` | No single answer to "what did this person do" or "who touched this record"; settings, templates and invoices changes are not logged at all |
| Configuration | `admin_settings`: three boolean switches | Alert recipients, sender addresses, working calendar, feature flags and maintenance mode live in code or secrets |
| Access | Per-person tick boxes, delegation, password reset, forced sign-out, email OTP at sign-in | No roles, no review, no dormant-account detection, no leaver process, `care_coordinator` and `care_clinical` still unassigned |
| Data | Archive covers five legacy tables | No archive for Care or Talent, no restore or permanent delete, no data-subject export or erasure, no retention |

## 2. Principles

1. **Build on what exists.** `admin_alerts` becomes the one alert table, `send-admin-alert` the one alert sender, `admin_settings` grows into typed configuration, and existing logs stay where they are and are read through one view. Nothing is replaced while it still works.
2. **One source of truth per catalogue,** as `admin-nav.ts` already is for navigation and permissions: health checks, configuration keys, archivable tables and role templates are each declared once and read everywhere.
3. **Every change made from these screens is itself audited.** The tools that manage the system must not become a blind spot.
4. **Permissions per section,** declared in `admin-nav.ts` so they appear in Admin access automatically: `system_health`, `activity_log`, `configuration`, `admin_access` (exists), `data_privacy`. With one admin, the super admin holds them all; with a team, operations can watch health without seeing access or privacy.
5. **Additive migrations only,** in `drizzle/migrations`, numbered from `0117`.

## 3. Section A: System health and alerts

The largest gap and the first build. Goal: nothing that matters to a family, candidate or payment can fail without someone being told within minutes.

### A1. Signals

| Signal | Source | Warn | Critical |
|---|---|---|---|
| Cron job failed | `cron.job_run_details` | any failed run | 3 consecutive failures |
| Cron job overdue | `cron.job` schedule vs last run | 2× interval late | 4× interval late |
| Care notification failed or stuck | `care_notifications` | any `failed`; `sending` over 15 min | failed pre-assessment link or portal invite unhandled 1 hour |
| Email bounces and complaints | `campaign_events`, `email_suppressions` | bounce rate over 5% in 24 h | any complaint; Resend webhook silent 24 h while sending |
| CV and document parsing backlog | parse queues behind `mu-reparse-pool`, `mu-document-parse-sweep` | over 25 waiting or oldest over 1 h | oldest over 6 h |
| Follow-up queue | `followup_queue` | dispatch did not run today | — |
| Edge function errors | new `ops_function_errors` (below) | 5 in 15 min for one function | any error in `paystack-invoice-webhook`, `care-token-send`, `care-portal-invite`, `contract-sign` |
| External services | new `ops-probe` function: Resend, Paystack, Anthropic, Google Maps | slow or degraded | down or key rejected |
| Intake spikes | existing `analytics_check_alerts()` | unchanged | unchanged |

Edge function errors are not queryable from SQL, so a shared `_shared/ops-log.ts` wrapper records unhandled errors and non-2xx outcomes into `ops_function_errors` (function, status, message, request id, no payloads or personal data). Functions adopt it progressively, critical ones first.

Each signal is a SQL function registered in one catalogue table, `ops_checks` (key, label, area, cadence, thresholds, enabled). `private.ops_run_checks()` runs every five minutes from cron.

### A2. Alerts

`admin_alerts` gains `severity` (info, warning, critical), `source`, `dedupe_key`, `occurrences`, `last_seen_at`, `acknowledged_by/at`, `resolved_by`, `resolution_note`. Existing intake alerts keep working and take the defaults.

- A failing check opens one alert per `dedupe_key`; repeats raise `occurrences`, never new rows.
- A check that passes again auto-resolves its alert, noted as "cleared automatically".
- Acknowledging says "I'm on it" and stops escalation; resolving closes it.

### A3. Email

- **Immediate:** a critical alert emails at once. Unacknowledged after 30 minutes, it emails again, then hourly up to four times.
- **Warning batch:** warnings collect and send at most once an hour.
- **Daily digest,** 07:45 Lagos time: overall status, open alerts, what cleared overnight, yesterday's volumes (enquiries, care requests, applications, emails sent, invoices paid) and anything awaiting approval.
- Recipients, digest time and quiet hours come from configuration (C1), not from code. Each recipient chooses critical only, everything, or digest only.

`send-admin-alert` is generalised for all three; the existing intake email becomes one alert source among many.

### A4. Live screen

`/admin/system`, in Administration:

- A status strip per area (Care delivery, Talent, Email, Payments, Scheduled jobs, External services), green, amber or red.
- Open alerts, newest critical first, with acknowledge, resolve and a link to the record or page that fixes it.
- Scheduled jobs: last run, duration, result and next run for every cron job.
- Failed deliveries: failed `care_notifications` and bounced emails, with **Retry** through the existing dispatcher.
- Supabase Realtime on `admin_alerts`, so the screen updates without refreshing.

Across the whole Admin, a header bell shows the open-alert count and turns red on a critical. The Overview gets the same status strip.

## 4. Section B: Activity log

### B1. One view over existing logs

`admin_activity` is a database view that normalises every existing log into one shape: when, who (user and name), action, area, subject type, subject id, subject label, detail, source log. Nothing is migrated or copied.

### B2. Fill the blind spots

A generic `private.audit_row_change()` trigger writes to a new `admin_audit` table (before and after values of changed fields only) on tables that have no log today: `admin_settings` and its successor, `admin_permissions` changes made outside the access screen, email and contract templates, invoices and payments, blog posts, `care_public_holidays`, role templates, archive and purge actions.

### B3. Screen

`/admin/activity`, filterable by person, area, action, record and date, read through a gated `admin_activity_search()` function with cursor paging. Every record page gets a "History" link that opens the log filtered to that record, and each admin row in Admin access links to that person's activity. CSV export of any filtered view.

Clinical record views stay in `care_access_log` and appear here only to holders of `activity_log` and `care_clinical`.

## 5. Section C: Configuration

### C1. Typed settings

`admin_settings` gains a `value_json` column and a description; a catalogue at `src/lib/system-config.ts` declares every key, its type, default, group and who may change it. The Settings page renders from the catalogue, so a new setting is one line of code. Edge functions read through `_shared/config.ts` with a one-minute cache. Every change is audited (B2).

Groups:

- **Alerts:** recipients and what each receives, digest time, quiet hours.
- **Email:** sender name, from and reply-to addresses, the operations inbox (replacing hard-coded `hello@medicconnect.co`), and the existing three notification switches.
- **Working calendar:** working days and hours, and an editor for the existing `care_public_holidays` that the work engine already uses for due dates.
- **Feature flags:** named on/off switches with a description and owner, read through `useFeatureFlag()` in the app and `config.flag()` in functions.
- **Maintenance:** a public-site banner, an admin banner, and a switch that pauses public form submissions with a polite message.

Secrets stay as Supabase secrets. The Settings page shows which are set (never their values) next to Alert keys.

## 6. Section D: Access

### D1. Roles

`admin_roles` holds named templates (for example Care coordinator, Clinical lead, Recruiter, Content editor, Finance, Operations). An admin holds one or more roles plus individual extras; their effective permissions are the union. Editing a role updates everyone holding it, and is audited. Existing per-person permissions remain as extras, so nothing changes for current admins on day one. Assigning `care_coordinator` and `care_clinical` becomes a role assignment.

### D2. Account health

Admin access shows, per person: last sign-in, sign-in method, active sessions, roles and extras. Health checks (A1) add:

- dormant accounts (no sign-in for 60 days)
- access not reviewed for 90 days
- a Workforce leaver who still has admin access
- a super admin count of one, as a standing warning that the business has a single point of failure

### D3. Review and leavers

- **Quarterly review:** a prompt to confirm or trim each person's access, recorded as `last_reviewed_at/by`.
- **Remove access:** one action that revokes roles and permissions, signs the person out everywhere, blocks sign-in, lists their open work items for reassignment, and logs it all. When Workforce marks someone as leaving, the action is suggested automatically.

## 7. Section E: Data and privacy

No specific compliance obligation applies yet, so this section is built last and kept proportionate. It still matters: the business holds health information about adults and children.

### E1. Archive everywhere

A catalogue at `src/lib/archive-registry.ts` declares every archivable table (adding clients, care requests, `mu_people`, opportunities, invoices and contracts to the existing five), its label and its link. The Archive page reads the catalogue. Archived items can be **restored**, or **permanently deleted** by a super admin after a typed confirmation, and deletion is blocked where finance or clinical records must be kept.

### E2. Data requests

`privacy_requests` records a request to see, correct or erase a person's data, with requester, identity check, due date and outcome. **Export** assembles everything held about a person across Care, Talent and Programmes into one file. **Erase** redacts personal fields and keeps the minimum needed for financial and clinical records, with the reason recorded.

### E3. Retention

Retention periods per kind of record are configuration (C1). A nightly job reports what has passed its period. It runs report-only until the rules are approved; deleting is a separate, later decision.

## 8. Order of work

1. **A, Health and alerts:** A1 and A2, then A4, then A3. Ship the live screen as soon as the first signals exist.
2. **C1, Configuration,** the alert and email groups only, because A3 needs recipients.
3. **B, Activity log.**
4. **The rest of C.**
5. **D, Access.**
6. **E, Data and privacy.**

Each step ends verified: migrations applied to a Supabase branch first, then production, with unit tests for the catalogues and checks, and a populated browser walkthrough at phone and desktop widths.

## 9. Decisions for approval

1. Alert recipients to start: the operations inbox (currently `hello@medicconnect.co`) plus your own address?
2. Digest at 07:45 Lagos time, every day including weekends?
3. The thresholds in A1 are starting values; they become configuration once C1 exists.
4. A second super admin: recommended before the business scales, even if they rarely sign in.
