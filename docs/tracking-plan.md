# Medic Connect — Website Data Tracking Plan

**Version:** 1.0  
**Date:** 10 September 2026  
**Owner:** Growth & Product  
**Status:** Current implementation captured; new events proposed

---

## 1. Purpose

This document maps every important business question to the data we already collect or need to collect. It keeps tracking decisions explicit, consistent, and privacy-conscious.

It covers:
- Anonymous behaviour (Google Analytics 4 + Google Ads).
- Returning-visitor memory stored on the device.
- Backend records created by form submissions and admin actions.
- Proposed additions for drop-off, scroll, and funnel measurement.

---

## 2. Principles

1. **Commercial intent first.** Track signals that show someone is likely to become a client, candidate, or partner before tracking vanity metrics.
2. **No invented data.** Every event must correspond to a real user action or a real backend record.
3. **Privacy by default.** Personal identifiers live in form submissions and local device memory; analytics events use anonymous IDs unless someone explicitly consents.
4. **One source of truth per question.** If a metric matters, it has one defined event and one defined calculation.
5. **Review quarterly.** Retire events that no longer answer business questions.

---

## 3. What We Track Today

### 3.1 Anonymous behaviour — GA4 + Google Ads

| Event | Fires when | Properties | Answers |
|-------|-----------|------------|---------|
| `page_view` | Every route change | `page_path`, `page_title` | Which pages attract traffic? Where do people enter? |
| `select_item` | Service interest signalled | `item_list_name`, `item_id` (service line), `source` | Which service lines are most popular? Which CTAs work? |
| `generate_lead` | Contact form submitted | `method` (source) | How many leads come from the contact page vs other routes? |
| `submit_form` | Care request submitted | `form_name`, `service_line` | How many care requests do we receive? By service line? |
| `sign_up` | Join-network account created | `method`, `track` | Which candidate track converts best? |
| `contact` / `outbound_click` | WhatsApp, phone, or email link clicked | `method`, `destination` | Are people preferring WhatsApp over phone or email? |
| `conversion` (Google Ads) | Lead/sign-up/care request | `send_to`, `value`, `currency` | Which paid campaigns drive revenue? |

### 3.2 Returning visitor memory — `mc_visitor_v2`

Stored locally in the browser. Never sent anywhere until the visitor submits a form.

| Field | Purpose |
|-------|---------|
| `name` | Greet returning visitors by first name. |
| `dial` / `phone` | Pre-fill WhatsApp/phone fields. |
| `email` | Pre-fill email and route enquiry replies. |
| `consent` | Skip re-asking for contact permission. |
| `interests` | Last 8 service lines viewed or selected, with timestamps. |
| `lastRequestAt` | Avoid asking the same person to submit twice in one session. |
| `greetedAt` | Control how often the welcome pop-up appears. |

### 3.3 Backend records

Every meaningful action creates a timestamped row.

| Record | Table | Use |
|--------|-------|-----|
| Care request | `contact_submissions` | Enquiry desk follow-up, service-line routing, conversion counting. |
| Join application | `join_applications` | Candidate pipeline, source attribution. |
| Campaign send | `campaign_events` / `matchmaker_email_log` | Email open, click, sign-in rate analysis. |
| Admin login | `admin_login_log` | Security audit, usage analytics. |
| Contract lifecycle | `mu_contract_events` | Time-to-sign, drop-off stage. |
| Document status | `mu_documents` | Compliance and verification funnel. |

---

## 4. Business Questions & Event Mapping

### 4.1 Acquisition

| Question | Primary source | Event / metric | Notes |
|----------|---------------|----------------|-------|
| How many people visit the site? | GA4 | `page_view` sessions | Filter by `page_location`. |
| Where do visitors come from? | GA4 | Default `session_source` / `session_medium` | UTM tags must be consistent. |
| Which paid campaigns convert? | Google Ads | `conversion` events with `value` | Value defaults to ₦35,000 care assessment fee. |
| Do people return? | GA4 + local memory | Returning vs new sessions; `mc_visitor_v2.greetedAt` | GA4 handles cross-device; local memory handles same-device. |

### 4.2 Service interest & conversion

| Question | Primary source | Event / metric | Notes |
|----------|---------------|----------------|-------|
| Which service lines attract demand? | GA4 + backend | `select_item.item_id` + `contact_submissions.service_line` | Compare anonymous interest to actual enquiries. |
| What is the enquiry-to-visit ratio? | Backend | `contact_submissions` → clinical client records | Requires manual stage tracking today. |
| How urgent is demand? | Backend | `contact_submissions.urgency` | “Within 48 hours” flag. |
| Are CTAs on service pages effective? | GA4 | `select_item` with `source` = page path | Proposed: add `cta_location` property. |

### 4.3 Candidate pipeline

| Question | Primary source | Event / metric | Notes |
|----------|---------------|----------------|-------|
| How many people start the join flow? | GA4 | `page_view` on `/join` | Add `join_start` event (proposed). |
| Which track do they choose? | GA4 + backend | `sign_up.track` + `join_applications.track` | Track at account creation. |
| Where do candidates drop off? | GA4 (proposed) | `join_step` events | Step number + track. |
| How many complete a profile? | Backend | `mu_people` records linked to `join_applications` | Use `created_at` vs `join_applications.submitted_at`. |

### 4.4 Engagement quality

| Question | Primary source | Event / metric | Notes |
|----------|---------------|----------------|-------|
| How far do people scroll on key pages? | GA4 (proposed) | `scroll` / `scroll_depth` | 25%, 50%, 75%, 90%. |
| Do people read blog posts? | GA4 | Time on page + `page_view` | Proposed: `blog_post_read` at 30 seconds. |
| Do people click to WhatsApp? | GA4 | `contact` event | Already tracked. |
| How often does the welcome pop-up appear? | Local memory + GA4 | `welcome_show` event (proposed) | Throttle via `greetedAt`. |

### 4.5 Operations & compliance

| Question | Primary source | Event / metric | Notes |
|----------|---------------|----------------|-------|
| Who logged into the admin centre? | Backend | `admin_login_log` | Captured on any admin route entry now. |
| Which contracts are stuck? | Backend | `mu_contract_events` | Stage + days since last event. |
| Which documents are pending? | Backend | `mu_documents.status` | Compliance dashboard source. |
| Are nudges being sent? | Backend | `followup_queue` + `mu_activity` | Already tracked. |

---

## 5. Proposed New Events

### 5.1 Care request funnel

Add these inside `CareRequestDialog.tsx` to diagnose drop-off.

| Event | When | Properties |
|-------|------|------------|
| `care_request_start` | Dialog opens | `source`, `prefilled_service_line` |
| `care_request_step` | Each step completes | `step`, `service_line`, `subject` |
| `care_request_submit` | Submission succeeds | `service_line`, `urgency`, `subject`, `returning` |
| `care_request_error` | Validation or submit fails | `step`, `error_type` |

### 5.2 Join flow funnel

Add these inside the four-track join flow.

| Event | When | Properties |
|-------|------|------------|
| `join_start` | Track selected | `track` |
| `join_step` | Each step completes | `track`, `step_name`, `step_index` |
| `join_account_created` | Account created | `track`, `method` |
| `join_profile_submitted` | Full profile submitted | `track`, `days_since_start` |

### 5.3 Scroll & engagement

| Event | When | Properties |
|-------|------|------------|
| `scroll_depth` | User reaches depth threshold | `page_path`, `depth` (25/50/75/90) |
| `blog_post_read` | 30 seconds on a blog post | `post_slug`, `author` |
| `file_download` | Brochure/CV/policy PDF clicked | `file_name`, `topic` |
| `welcome_show` / `welcome_dismiss` | Welcome pop-up action | `source`, `returning` |

### 5.4 Service CTA attribution

Enhance existing `select_item` events with `cta_location`.

| Property | Values |
|----------|--------|
| `cta_location` | `hero`, `sticky_nav`, `service_card`, `cta_section`, `footer`, `welcome_popup`, `whatsapp_widget` |

---

## 6. Funnel Definitions

### 6.1 Care request funnel

1. **Awareness:** `page_view` on a care service page.
2. **Interest:** `select_item` for that service line.
3. **Intent:** `care_request_start`.
4. **Completion:** `submit_form` / `care_request_submit`.
5. **Qualified lead:** `contact_submissions` row with valid phone + consent.
6. **Client:** Clinical client record created.

### 6.2 Candidate acquisition funnel

1. **Awareness:** `page_view` on `/join` or a careers page.
2. **Track choice:** `join_start`.
3. **Account:** `sign_up` / `join_account_created`.
4. **Profile:** `join_profile_submitted`.
5. **Verified:** `mu_verifications` passed.
6. **Placed:** `mu_engagements` or `mu_offers` created.

### 6.3 Admin content funnel

1. **Draft:** `blog_posts` or `campaigns` created.
2. **Review:** Status changed to `review`.
3. **Approved:** Status changed to `approved`.
4. **Published / Sent:** `campaign_events` or public post.
5. **Engagement:** `page_view` / `blog_post_read` / campaign click.

---

## 7. Consent, Retention & Privacy

### 7.1 Consent

- **Analytics cookies:** GA4 operates under implied consent for basic measurement. If we add advertising pixels or remarketing, we must surface a consent banner.
- **Form data:** The contact questions explicitly ask for consent to hold details. That consent is stored in `mc_visitor_v2` and `contact_submissions`.
- **Local memory:** Device-stored data is not shared until a form is submitted.

### 7.2 Retention

| Data type | Retention | Rationale |
|-----------|-----------|-----------|
| GA4 data | 14 months (default) | Sufficient for seasonal comparison. |
| Local visitor memory | Until cleared by user | Convenience for returning visitors. |
| `contact_submissions` | 8 years | Brand identity / regulatory record-keeping. |
| `admin_login_log` | 2 years | Security audit trail. |
| Campaign email logs | 2 years | Performance analysis and suppression. |

### 7.3 What we must never track in analytics

- Medical diagnoses, care needs, or health details.
- Candidate BVN, passport, or identity numbers.
- Contract salary figures in plain analytics events.
- Admin actions that reveal private client or candidate data.

---

## 8. Implementation Priority

### This week
1. Add `care_request_start`, `care_request_step`, and `care_request_submit` events.
2. Add `cta_location` to existing `select_item` calls.

### Next 2 weeks
3. Add `join_start`, `join_step`, `join_account_created`, `join_profile_submitted`.
4. Add `scroll_depth` on service landing pages.

### Next month
5. Build a lightweight dashboard that joins GA4 events to backend records for true lead-to-client conversion.
6. Review whether a consent banner is needed if remarketing is switched on.

---

## 9. Appendix: Event Reference

### 9.1 Existing events (src/lib/measurement.ts)

```typescript
pageView(path: string, title?: string)
gaEvent(name: string, params?: Record<string, unknown>)
trackContactForm(source?: string, value?: number)
trackCareRequest(serviceLine?: string, value?: number)
trackServiceInterest(serviceLine: string, source: string)
trackJoinApplication(track: string)
trackOutboundClick(href: string, type: "whatsapp" | "phone" | "email")
```

### 9.2 Existing visitor fields (src/lib/visitor.ts)

```typescript
interface VisitorRecord {
  name: string;
  dial: string;
  phone: string;
  email: string;
  consent: boolean;
  interests: { line: string; at: string }[];
  lastRequestAt: string | null;
  greetedAt: string | null;
}
```

### 9.3 UTM parameters we expect

| Parameter | Used for |
|-----------|----------|
| `utm_source` | Where the visitor came from (e.g. `google`, `instagram`). |
| `utm_medium` | Channel (e.g. `cpc`, `email`, `organic_social`). |
| `utm_campaign` | Specific campaign name. |
| `utm_content` | Ad or creative variant. |
| `utm_term` | Keyword for paid search. |

---

## 10. Review Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-10 | Initial plan: current state, proposed events, priorities. |
