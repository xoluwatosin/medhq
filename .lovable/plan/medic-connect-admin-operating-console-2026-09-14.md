# Medic Connect Admin operating console

## Goal
Reorganise the existing Admin into one coherent console by business domain, without changing underlying Care, Talent, Workforce, Finance, Communications or Programme workflows.

## Confirmed starting point
- The current Admin shell already centralises the desktop rail, mobile navigation, collapsed state, command search, breadcrumbs and permission filtering.
- Existing route URLs can remain in place while their labels and business-domain grouping change.
- Care Requests and Talent Client requests are separate records. Care Requests use the existing Care group/request/recipient structures; Talent Client requests continue to use Match Universe matching records.
- Five live Care Requests currently exist. The request-wide questionnaire tables exist, but no request-wide sessions or recipient rows have been created yet, and the public questionnaire functions still use the legacy single-client authority. This Admin pass will not present unfinished request-wide sending as available.
- The current client record includes working Care tabs plus legacy labels and single-client link controls. This pass will clarify and demote those controls rather than redesign their lifecycle.

## Build

### 1. Reorganise the Admin rail
Use these top-level groups, preserving every existing URL and permission key:

1. **Overview**
   - Overview
2. **Care**
   - Care requests
   - Clients
3. **Talent**
   - Candidates
   - Opportunities
   - Client requests
   - Candidate intake
   - Availability
   - Keep Document review and Duplicates searchable/secondary
4. **Workforce**
   - Workforce
   - Keep Contract templates and Annex library searchable/secondary and linked from Workforce
5. **Programmes**
   - Creator applications
   - Heard applications
6. **Inbox**
   - Enquiries
   - Keep Enquiry setup searchable/secondary
7. **Communications**
   - Campaigns
   - Audience
   - Email library
8. **Content**
   - Blog posts
9. **Finance**
   - Invoices
10. **Insights**
   - Insights
11. **Administration**
   - Settings
   - Admin access for super admins
   - Keep Alert keys, Archive and Approvals searchable/secondary where appropriate

Keep historical terms such as Match Universe, Intelligence, Email templates and Access control as command-search keywords so staff can still find familiar destinations.

### 2. Add a Care Requests work surface
Create `/admin/care/requests` as a compact operational list backed only by the existing Care records and secure read models.

Show:
- Family or care-group name
- Enquirer where recorded
- Recipient count
- Intended services
- Request status
- Readiness or next operational action
- Created/updated timing

Opening a request will use the existing client/group record path rather than introduce a second Care editor. The list will clearly distinguish Care Requests from Talent Client requests.

### 3. Clarify the client record
Make terminology-only adjustments while preserving existing tab keys and behaviour:
- Work → Tasks
- Commercial → Finance
- Link → Pre-assessment link, clearly identified as the current single-client control
- Keep Family and care group, Pre-assessment, Assessment, Clinical review, Care plan, Care proposal, Contacts, Access and Activity unchanged
- Update nearby empty/readiness text so it points to the correct tab and does not imply request-wide questionnaire controls exist

No questionnaire authority, clinical lineage, grants, identity logic or document behaviour will change.

### 4. Replace the passive Overview
Turn Overview into a compact needs-attention surface using existing authorised data only:
- Care work needing attention
- Open enquiries
- Candidate intake/application work
- Unresolved operational alerts
- Pending approvals for super admins

Each row will name the work, show a concise count/state and link to the existing destination. Permission-gated users will only see work they can already access.

### 5. Align page names and supporting navigation
Update only user-facing headings and cross-links needed to match the new architecture, including:
- Intelligence → Insights
- Email templates → Email library
- Access control → Admin access
- Heard volunteers → Heard applications where these records are applications
- Sentence case across affected headings

Preserve storage keys, database values, internal Match Universe names and operational behaviour.

### 6. Preserve compatibility and permissions
- Keep all current Admin URLs working.
- Add redirects only where a new friendly route is useful; do not remove old routes.
- Reuse existing permission keys exactly as stored.
- Preserve profile-only redirect behaviour.
- Keep secondary pages available through contextual links, breadcrumbs and command search.
- Ensure longest-route breadcrumb matching and active states remain correct after regrouping.

## Technical details
- Add a focused Care Requests page and route; no database migration.
- Reuse `care_group_overview`, `care_request_readiness`, existing Care work helpers and current Admin data access patterns.
- Centralise revised rail labels/keywords in the existing navigation source.
- Use the established console table, tabs, record cards, headers and semantic design tokens.
- Add focused tests for navigation grouping, permission visibility, route matching and Care Request presentation where practical.

## Verification
- TypeScript check and focused/full test suite.
- Preview build with no current build errors.
- Authenticated browser checks for:
  - full-permission Admin rail, command search and breadcrumbs
  - collapsed desktop rail
  - mobile navigation
  - profile-only account behaviour
  - Care Requests list opening the correct existing Care record
  - Talent Client requests remaining separate
- Check desktop and phone widths for clipping, overlap and stable navigation.

## Out of scope
- Request-wide questionnaire session completion or new send controls
- Care lifecycle, clinical, identity, access-grant or database redesign
- Talent matching, Candidate Portal or Workforce workflow changes
- T8, packages, staffing, rosters, visits, monitoring, medicines, worker delivery, family portal, finance processing or payment work
- General visual redesign or unrelated cleanup
