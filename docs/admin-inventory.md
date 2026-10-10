# Admin Centre inventory

5 October 2026. A UX and logic inventory of every Admin Centre screen, taken
from the code on branch `claude/stoic-clarke-xwp2ql`, the live data counts in
`architecture-audit.md`, and the earlier findings in
`care-platform/ui-architecture.md` and `care-platform/logic-review.md`. Where
those earlier findings have since been fixed it is noted.

## The verdict

The Admin Centre is about 33,000 lines across 60 screens in 11 domains. The
underlying model is sound: one person, one account, derived lifecycle state,
work and activity tables. The problems are almost all in the operating layer
staff use every day:

1. **Four visual systems on one site.** Screens were built in four grammars
   (Mu card, Mu record and ledger, Console, raw shadcn), so lists and the
   records they open look different, page titles come in three typographies,
   and 136 raw dropdown triggers, 52 rounded corners and 22 pills sit beside
   square house components.
2. **The candidate pipeline is split across six screens and three stage
   vocabularies.** A candidate can be "hired" on the opportunity, "offer made"
   on their record and "placed" on the shortlist at the same time. No screen
   answers "where is this person in the pipeline".
3. **The busiest screens are overloaded.** Talent Pool has 18 filters, 6 view
   tabs and 10 header buttons. The client record is 1,220 lines with 13 tabs.
   The person record has 7 tabs and nests the same work panel twice.
4. **Irreversible actions have no confirmation.** Moving someone to the staff
   register, merging two people, cancelling an invoice, approving a campaign
   (which sends it), archiving an enquiry, deleting catalogue items.
5. **Several screens fail quietly.** Load errors become "No care requests" or
   zero counts; saves ignore errors; Settings reports success without writing.
6. **Access is only enforced in the menu.** Routes are wrapped in
   `ProtectedRoute` only; four pages re-check permissions themselves.
7. **Half the model has never run in production.** `mu_offers`,
   `mu_engagements`, `mu_shortlists`, `mu_leave_requests` and
   `mu_merge_candidates` all have zero rows, so the offer, contract, workforce
   and leave screens have never been used with real data.

## Numbers

| Measure | Value |
| --- | --- |
| Admin code | 33,067 lines (19,816 in pages, 13,251 in components) |
| Screens | 60 routes in 11 domains plus My profile |
| Files over 600 lines | 11 (ClientRecord 1,220; MatchUniverse 1,162; ContractEditor 1,083; WorkPanel 984; MatchUniversePerson 978; MatchmakerMatches 942; DocumentsPanel 897; CampaignEditor 830; WorkforceStaff 829; Intelligence 788; PostEditor 752) |
| Raw shadcn `SelectTrigger` | 136 |
| Modals (Dialog, Sheet, AlertDialog) | 57 |
| Spinners (`Loader2`) | 205 |
| `window.confirm` | 7 (the only confirmations outside AlertDialog) |
| Status colour maps | 5 separate ones |
| Date formatting | 9 hand-rolled `toLocaleDateString` plus 28 `date-fns` calls |
| Empty-state copy | 15 different sentences for the same state |
| Permission keys | 15 |
| Live data (from the audit) | 275 people, 397 documents (394 still pending review), 2,204 parsed fields pending, 77 field conflicts unresolved, 214 opportunity applications, 67 enquiries, 14 campaigns, 4 posts; 0 offers, engagements, shortlists, leave requests, merge candidates |

## The frame (`AdminLayout.tsx`, `admin-nav.ts`)

**What it is.** A navy rail of 11 domains (Overview, Care, Talent, Workforce,
Programmes, Inbox, Communications, Content, Finance, Insights, Administration),
collapsing to icons. A sticky top bar with breadcrumb, Jump to (command
palette over every item and its keywords) and the account menu. A sticky tab
row inside domains with more than one page. On phones a two-level full-screen
navigator; detail routes swap the menu button for a back arrow.

**What works.** One nav source of truth feeds the rail, tabs, breadcrumb,
palette and phone navigator, so nothing goes missing between them. Permission
filtering hides whole domains cleanly. The command palette is good.

**Problems.**
- Nav filtering is the only gate: typing a URL gets past it (`App.tsx:274`).
  Only Dashboard, ClientRecord, Programmes and one more page re-check
  `permissions.includes`. No 403 state.
- Care pages use the `dashboard` permission, so anyone who sees Overview sees
  full care records.
- Breadcrumb leaf is always "Details", never the record name
  (`AdminLayout.tsx:288`); ClientRecord adds its own back link, so two back
  affordances.
- On phones a detail route has no menu button, so you cannot change domain
  without going back first (`AdminLayout.tsx:270`).
- "Inbox" holds only Enquiries; Applications is in Talent, Creator in
  Programmes, Approvals a super-admin aside. So it is not an inbox.
- Settings are spread over Settings, Alert keys, Enquiry setup, Control
  Centre toggles and Workforce invites.
- No admin 404: a bad `/admin/...` URL drops staff onto the public site.
- Verification, Duplicates, Contract templates, Annex library and Alert keys
  are "aside" items: reachable only by search or a button on another screen.

## Domain by domain

Columns: what it does; data; staff actions; states; problems. File line counts
in brackets.

### Overview

**`/admin`** Dashboard [94]. Counts of work needing attention with arrow links.
Reads care next actions, new enquiries, new join applications, alerts, pending
posts and campaigns.
- Bug: the "Intake" row counts legacy `join_applications` but links to the
  intake dashboard (`Dashboard.tsx:33` vs `:60`); the number and the
  destination do not match.
- Failed queries show 0 silently. No empty state. Every row weighs the same, so
  a zero and an urgent item look alike. No due or overdue split.

### Care

**`/admin/care/requests`** CareRequests [202]. Requests with readiness and next
action. States: draft, open, questionnaire_sent, responses_returned,
assessment_booked, closed.
- A request has no page of its own: "Open request" goes into the first
  recipient's client record (`:177`); a request with no recipients cannot be
  opened.
- One readiness RPC per row (`:122`). No search. No "New request" action. Load
  errors read as "No care requests".

**`/admin/clients`** Clients [511]. Clients by derived stage
(awaiting_pre_assessment, pre_assessment_received, assessment_booked,
care_running, archived). Actions: add client (manual or link), route care
requests, open record.
- A 150-line create form lives inside the header's `action` prop (`:283-439`).
- Rounded-2xl choice cards (`:293`) in a square console.
- 7 filter tabs plus a table whose "Action" column is a full-width "Open
  record" button (`:486`); the row should be the link.
- Client and contact inserts are not atomic (`:183-227`). Validation is toast
  only. "Route care requests" (turning enquiries into care) is here instead of
  in Enquiries. No search.

**`/admin/clients/:id`** ClientRecord [1,220]. The full care record: about 12
tables read at once, 13 tabs in 6 groups, Flags above every tab, overview
split in two blocks, three CareSheets stacked on the page.
- Uses the Mu record shell while the list uses Console, so list and record
  look different.
- Plain-text loading and not-found.
- The stage is now read-only and derived (the old "free dropdown" finding is
  fixed).

**Care sections** (`components/admin/care/`, 3,989 lines in 14 files).
GroupSection [661] is where requests are actually edited, through about 15
`care_*` RPCs and four sheets. WorkSection hides complete, reschedule and
cancel in a ⋯ menu. AccessSection, AssessmentSection, ClinicalReviewSection,
CarePlanSection, CareProposalSection and CareFinanceSection each open 2 to 4
modal sheets. CareFinanceSection creates Paystack invoices separately from
Finance › Invoices, so there are two invoice paths.

### Talent

**`/admin/match-universe`** Talent Pool [1,162]. The candidate register.
Reads every row of 7 tables, plus readiness and review-count RPCs; calls
`parse-cv` in the background on every visit (`:260`). States: lifecycle
(talent, workforce), verification (unverified, in_review, verified, failed),
looking status, readiness, dormant after 90 days.
- 18 filters plus search in one grid (`:630-797`), copy-pasted for mobile
  (`:801-984`). No "clear filters".
- 6 view tabs overlap the lifecycle, engagement and readiness filters: two ways
  to say the same thing.
- 10 header buttons with no primary action (`:540-585`); "Tidy documents" is a
  maintenance job sitting beside navigation and uses `window.confirm`.
- No pagination: the whole pool loads at once. Load errors are ignored. Bulk
  invite sends one by one with no progress.

**`/admin/match-universe/:id`** Person record [978] plus WorkPanel [984],
DocumentsPanel [897], HirePanel [321], CredentialsPanel [322]. Hero, strip and
7 tabs. States: documents (pending, accepted, conditional, rejected, missing,
expired); offers (draft, sent, viewed, accepted, declined, withdrawn,
expired); contracts (draft, issued, signed, active, ended, withdrawn);
applications (applied through offer_made, not_taken_forward, withdrawn).
- The Verification tab stacks 4 sections. "Offers and contracts" embeds
  WorkPanel and "Work" embeds it again (`HirePanel.tsx:128`).
- The offer composer is a 330-line dialog (`WorkPanel.tsx:648-978`).
- "Move to staff register", the most consequential action on the page, is in a
  ⋯ menu and fires with no confirmation (`:164`, `:599`).
- Back link says "Match Universe" while the nav says "Talent Pool".

**`/admin/match-universe/intake`** [257]. Called Intake, but it is health
statistics plus maintenance buttons (requeue parse, expire documents, scan
duplicates). There is no queue of new arrivals to triage anywhere.

**`/admin/match-universe/verification`** Document review [624]. States
pending, accepted, rejected, held. The accept and return logic is duplicated in
DocumentsPanel. An aside in the nav, though 394 of 397 documents are waiting.

**`/admin/match-universe/merges`** Duplicates [198]. The merge is four client
side updates in `Promise.all` with no error checks, then a delete
(`:101-118`), no confirmation, and it does not move references, facets, offers
or contracts. Data can be lost.

**`/admin/match-universe/availability`** [403]. Who is free. `COVERAGE_BLOCKS`
duplicated in MatchmakerMatches.

**`/admin/match-universe/requests`, `requests/:id`** Staffing requests [243,
275]. Client briefs stored as opportunities with `kind='request'`, with their
own list and editor; the request page mixes Mu sections with a shadcn card.

**`/admin/match-universe/opportunities`** [315] and **`opportunities/:id/*`**
(MatchmakerEditor [562], MatchmakerApplications [563], MatchmakerMatches
[942]). States: draft, open, closed, archived, bin. Three unrelated candidate
pipelines: application status (new, reviewing, shortlisted, rejected, hired),
application stage on the person record, and shortlist stage (shortlisted,
put_forward, client_interviewing, placed, withdrawn). Duplicate h1s, serif
headings, status writes with no error handling (`MatchmakerApplications:227`).

**`/admin/applications`** Legacy join applications [277] and
**`/admin/creator-applications`** [306] are near copies of each other
(status, archive, filter, dialog, pagination). Updates ignore errors.

### Workforce and contracts

**`/admin/workforce`** [344]. Staff register. States: staff_status (pending,
active, on_notice, exited) plus contract status. "Add staff" inserts a new
`mu_people` row directly (`:160-173`), bypassing `becomeWorkforce` and the
duplicate check, against the one-identity principle.

**`/admin/workforce/:id`** WorkforceStaff [829]. Overview, Documents,
Contract, Access, Activity. Contract buttons duplicated from HirePanel
(`:597-620`); "New contract" bounces back to the Talent record; shadcn tabs
plus a native select on phones, unlike the person record's tab rail. Grants
admin access through `invite-admin` with both approval flags hard-coded,
separately from the Control Centre.

**`/admin/contracts/:id`** ContractEditor [1,083]. Three panes, up to 9 header
actions, 5 dialogs. States: draft, issued, signed, countersigned, active,
withdrawn. Back link hard-wired to the staff record even when started from
Talent (`:560`). "Chase" ignores errors; "Withdraw" asks nothing (`:312`).
Rounded-3xl surfaces in a square shell.

**Contract templates** [136, editor 603] and **Annex library** [332] are
reachable only from Workforce buttons or search; both use `window.confirm`.

### Programmes

**`/admin/programmes`** [84]. Landing with counts. The Heard count reads the
legacy `heard_volunteers` table while the Heard page's main tab is
`heard_volunteer_applications`, so the numbers disagree (`:33`). "No
programmes" flashes before data loads.

**`/admin/heard`** [402]. Applications, Legacy interest, Phone waitlist.
Applications are read-only; only legacy rows can change status. Filters
duplicated for desktop and mobile. Serif heading, rounded-xl, no page shell.

### Inbox

**`/admin/enquiries`** [359]. Contact-form leads; views Unanswered, Open, Care
started, All; status new or read. Stage, owner and archive writes ignore
errors (`:77-93`). Archive is one click from an unlabelled icon, no confirm or
undo. Owner is free text saved on blur. Detail is a dialog with no deep link.
No "start care request" here; that lives in Clients. Everything loads client
side.

**`/admin/enquiries/setup`** [328]. Service lines, brochures, reply questions.
Own two-pane layout, serif heading, an aside in the nav.

**`/admin/approvals`** [129]. Super admins approve or reject pending posts and
campaigns. Approving a campaign sends it immediately with no confirmation.
Reject asks for no reason. No preview before deciding.

### Communications

**`/admin/campaigns`** [156]. "New Campaign" inserts a row immediately,
leaving "Untitled Campaign" rows behind (`:43`). Resend to failed has no
confirm. `approval_status` is never shown, so pending or rejected campaigns
are invisible.

**`/admin/campaigns/:id`** CampaignEditor [830]. Block editor, audience,
attachments, test send, send. Approval gating checks `!isSuperAdmin`
(`:798`) rather than `requiresCampaignApproval`, so the Control Centre toggle
does nothing. Pending or rejected state is never shown. Group creation is
nested in the editor and duplicates the Audience dialog. The send dialog says
"all contacts", not a number. Save draft, test email, Send test and Send sit
at equal weight.

**`/admin/audience`** [370]. Three dialogs, four header buttons that do not
wrap on phones, search and filters written twice, delete member with no
confirm, groups shown only as count pills with no rename or delete.

**`/admin/email-templates`** [409] plus Builder [710]. The editor is component
state, not a route; "All emails" drops unsaved work. Load ignores errors, so
the screen flashes "No emails yet". No delete or archive. How it relates to
Campaigns (both are email builders with different editors) is never
explained.

**`/admin/archives`** [139]. Restore on one click with no undo; five raw
tables in an accordion, no mobile layout; filed under Administration rather
than next to the content it holds.

### Content

**`/admin/posts`** [146]. Two status badges per post (status and approval).
No search, filter or sort. Archive and Delete are hidden on phones (`:112`).

**`/admin/posts/:id`** PostEditor [752]. Autosave writes title and content
straight to the row every 2 seconds, including on published posts, for
editors who need approval (`:130-157`): the live post changes without
review. The action bar is copied twice (`:432`, `:705`). "Notify
Subscribers" emails the whole list with no confirm. Schedule versus publish is
decided by a date picker far down the form and the button label changes
silently. New posts have no autosave and no unsaved-changes guard. Template,
polaroid, drop-cap and image-slot controls crowd the writing area.

**`/admin/seo`** and **`/admin/seo/pages/:id`** [47 plus four registers of
262, 235, 310, 242; record 379]. Four registers with tabs in the URL. This is
the cleanest area and the model to copy. Shares the `blog` permission, so
blog and SEO access cannot be separated.

### Finance

**`/admin/invoices`** [54] plus InvoiceList [141], InvoiceBuilder [283],
CatalogueTab [271]. Opening the page silently seeds default catalogue data
(`Invoices.tsx:15-19`). "New invoice" is a tab, not a button. Each invoice is a
card with 4 to 5 equal outline buttons. Cancel has no confirm. No filters,
search, totals or overdue view. Client picker is a plain select over every
client. Catalogue deletes have no confirm. Not linked from the client record,
while CareFinanceSection creates invoices separately.

### Insights

**`/admin/intelligence`** [788]. Six tabs of reporting plus operational work
(follow-up nudges, resolving alerts). `loading` is set but never rendered, so
zeros show while data loads (`:106`). Tab state not in the URL.

**`/admin/alert-keys`** [293]. Job keys, rotation, test alert. A settings
screen separate from Settings; an aside.

### Administration

**`/admin/settings`** [84]. Three notification toggles. Load errors ignored.
Toggling a key with no row writes nothing but toasts success (`:35-43`).

**`/admin/control-centre`** Admin access [539]. Where permissions are managed.
Each admin is one card holding edit areas, resend invite, reset password, sign
out everywhere, withdraw, two approval switches and a history. Approval
switches save on toggle with no confirm. WorkforceStaff also grants access with
different defaults. The permission list is now in one shared file (the old
duplication is fixed).

**`/admin/me`** [411]. Staff self-service: details, documents, contract
signing in a 240mm dialog with nested tabs, cramped on phones.

## The candidate pipeline, end to end

1. **Intake.** CVs arrive through join or opportunity applications. Intake is a
   dashboard, so new arrivals are found through the Pool's "Needs completion"
   or "Unclaimed" views.
2. **Verification.** Document review queue or the person record's
   Verification tab, each with its own copy of the logic. Duplicates on the
   Merges page.
3. **Matching.** Opportunity Matches tab moves people through shortlist
   stages; the Applications tab sets a separate status; the person's
   Applications tab sets a third stage.
4. **Offer.** Composed in WorkPanel's dialog on the person record. Never used
   in production.
5. **Contract.** Started from HirePanel, edited in ContractEditor whose back
   link goes to Workforce. Issued, signed, countersigned, active.
6. **Workforce.** "Move to staff register" in a ⋯ menu, then WorkforceStaff,
   where the contract actions are repeated.

Six screens, three stage vocabularies, two places for document review, and no
screen that shows where a person is.

## Defects to fix regardless of design

Ordered by risk.

1. Merges: non-transactional, no confirmation, loses child records
   (`MatchUniverseMerges.tsx:101-118`).
2. PostEditor autosave edits published posts without approval
   (`PostEditor.tsx:130-157`).
3. CampaignEditor ignores `requiresCampaignApproval` (`:798`).
4. "Move to staff register" has no confirmation (`MatchUniversePerson.tsx:164`).
5. Approving a campaign sends it with no confirmation (`Approvals.tsx`).
6. Workforce "Add staff" bypasses `becomeWorkforce` and duplicate checks
   (`Workforce.tsx:160-173`).
7. Routes have no per-page permission guard; Care uses the `dashboard` key.
8. Settings toasts success without writing (`Settings.tsx:35-43`).
9. Overview Intake count and link disagree (`Dashboard.tsx:33`, `:60`);
   Programmes Heard count reads the wrong table (`Programmes.tsx:33`).
10. Silent failures: Enquiries, Applications, Creator, EmailTemplates,
    Campaigns delete, Chase, Intelligence loading.
11. Invoices seeds catalogue data on open (`Invoices.tsx:15-19`).
12. No admin 404 inside the shell.

## Proposed order of work

**Phase 1. One kit, every screen.** Build the admin kit the earlier UI
architecture document already specifies, on the house style (square, navy,
firm fields): page header, tabs, table with phone list, record hero with tab
rail, ledger rows, status, one select, one date and phone field, confirm
dialog, empty, loading and error states. Then move the 60 screens onto it and
delete the Console set, the raw shadcn cards and the serif headings. This is
the "BIG ux/ui work" and it also removes most of the duplication.

**Phase 2. Fix the defects above.** Small, mostly logic. Do the merge RPC,
the approval gating, the confirmations and the route guards first.

**Phase 3. Talent Pool and the pipeline.** One stage model from applied to
hired. A stepper in the person-record hero with one primary action per stage.
Pool filters cut to search plus 4, the rest in a drawer, with pagination.
Person record cut to 5 tabs with one Employment tab. Intake becomes a real
queue of new arrivals.

**Phase 4. Care and Inbox flow.** Care requests get their own page. Client
record cut to about 6 tabs with Flags as a banner. "Start care request" on
the enquiry. Enquiry detail as a deep-linked drawer with an owner picker.
Invoices linked from the client record, one invoice path.

**Phase 5. Content, Communications, Administration.** One action bar for the
two big editors with explicit Publish or Schedule. Approval state visible in
lists and editors, Approvals next to them. Email library as routes. Settings,
Alert keys and approval defaults on one Administration screen; Control Centre
the only place access is granted.

## Decisions needed

1. Phase order: kit first, or defects first.
2. Whether to retire the legacy Applications and Creator screens into the
   Pool and Programmes, or keep them.
3. Whether Staffing requests stay separate from Opportunities or become one
   list with a type.
4. Whether admin keeps a plainer register than the public site (recommended:
   square and navy, no tilt, no tape, clip art only in empty states).
