# Admin Centre: function inventory

5 October 2026. What each admin screen does, what is broken, missing,
redundant or slow, and what should merge. This is about function, not the
look; the visual kit is a separate piece of work. It follows the defect
fixes already shipped (merges, confirmations, approvals, silent failures,
route access) and complements `docs/admin-inventory.md`.

Data volumes today are small (389 people, 778 documents, 965 audience
contacts, 97 enquiries, 9 care requests). Loading a list whole and filtering
in the browser is fine at this size. The exceptions are noted under
Efficiency.

## Done (5 October)

- Filters that remember, with chips and Clear all: Talent Pool, Clients,
  Enquiries, Document review. Talent Pool folded to five views, everyday
  filters up front and More filters.
- One way to issue a contract, with checks and the signing email, from
  all four places. Signed contracts are countersigned, not marked active.
- One requirements editor on a staffing request.
- Availability's Offer work opens the right tab; shortlists that moved on
  can't be erased from the person record; bulk accept keeps failures;
  campaign copies keep their layout; catalogue reset asks first; closed
  postings keep their close date; dead Auto-send button removed.

- Unsaved edits are protected on contract templates, the annex library and
  posting details. Staffing requests can be removed, and Last matched is
  recorded. Staff leave through Return to Talent. Overview counts match the
  pages they open.

## Done (5 October, evening): the kit and the merges

- One admin look (`docs/admin-kit.md`) in the shared layer and on all 60
  screens: square, navy, heavy headings, square chips, flat tiles, empty
  states with clip art, load errors that are not empty states, sentence case.
- Lists past 1,000 rows read a page at a time (campaign sends, Audience,
  email analytics, invoices, the invoice client picker, Talent pool).
- Administration is one page: People and access, Notifications, Alert keys.
- One Care list: Requests is a view, with Paused and Closed views added.
- Route to Care is on the enquiry, with Open care record once routed.
- Programmes is the Creator page.
- Intake tiles open the list behind the number; legacy applications link
  to the person they made.
- A Contracts register across everyone, under Workforce.
- One application stage on the posting screen (through
  `mu_set_application_stage`).
- One shortlist control on the role's Matches and the person's
  Opportunities.
- Availability shown once on the person record.
- Audience groups made one way (a same-name group is reused), and they can
  be renamed and deleted.
- Each list has its own Archived view; the central Archive page is retired.
- Talent pool header cut from ten buttons to three.

Kept on purpose: Staffing requests stay separate from Opportunities;
Profession and Specialty stay as two filters (they are different things:
what someone is, and what they are good at).

Still open from section 2: matching ranks staff and paused people (a
database function change, after cutover), and the Email Library (unused
by campaigns and system emails).

## The verdict

1. **Filters have no memory, anywhere.** Every filter, search, view tab,
   sort and page number on every admin list lives in throwaway component
   state. Open a record, press back, and the list is reset. Reload, and it
   is reset. No list can be bookmarked or sent to a colleague. No screen
   has a "clear filters" control or shows which filters are on.
2. **The pipeline has two editors for the same thing in several places,**
   and they disagree: requirements on a staffing request, shortlisting,
   application status, contract issuing, document review.
3. **Contracts issued from three of the four places are never emailed or
   checked.** Only the contract editor runs the pre-issue checks and sends
   the email.
4. **Several links lead nowhere,** and some features exist only as dead
   code.
5. **Counts on the Overview don't match the screens they open.**
6. **The Email Library saves emails that nothing uses.**

## 1. Filters

### What is wrong

| Problem | Where |
|---|---|
| No memory: lost on back, reload, tab switch | Every list. Only the person record tab, client record tab, SEO section and opportunity sub-tab live in the URL. |
| Back links go to a fixed address, not history | Person, client, SEO page, contract and staff records all link back to the bare list. |
| No clear-filters control, no active-filter summary | Every screen. |
| No filtered result count | Everywhere except Talent Pool, posting applications and Document review. |
| Too many filters, some overlapping | Talent Pool: 6 view tabs plus 18 filters plus sort, every one of them drawn twice (desktop and phone). |
| Views and filters that duplicate each other | Talent Pool: Dormant view vs Engagement "dormant"; Unavailable view vs Looking status; Needs completion view vs Readiness; Unclaimed view vs Account. |
| Combinations that always return nothing | Talent Pool: Active view with Lifecycle "Workforce"; Needs completion with Readiness "Ready"; Dormant with Engagement "recent"; Unclaimed with Account "claimed". |
| Options that can never match | Talent Pool Profession list is fixed, not drawn from the data. Enquiries service filter includes switched-off lines. |
| Two rules for one filter | Talent Pool "Documents" guesses type from the file name. Document review uses the stored type. |
| Selection survives filter changes | Talent Pool and Audience: rows hidden by a filter stay selected and are acted on. |
| Lists with no filters at all where they are needed | Clients (no name search), Care requests, Campaigns (no status or search), Invoices (no search, status or date), Blog posts (no status, search or category), Email Library, Opportunities (draft and open mixed), Staffing requests, Admin access, SEO modules, claims and markets. |
| Filters missing a key dimension | Enquiries has no owner or stage filter though both are edited there. Clients tabs cover 4 of 11 stages; paused and closed can't be found. Document review has no "on a live shortlist" filter though it counts them. |

### The fix: one list standard for every admin screen

One shared piece of code, used by every list, so the behaviour is the same
everywhere:

1. **The address bar holds the filters.** Every filter, view, sort and page
   is written to the URL. Back, reload, bookmarks and links to a colleague
   all work.
2. **Each list remembers your last view.** Arriving at a list with a bare
   address restores the filters you last used there, per admin, on that
   device.
3. **Back means back.** Record pages return to the list you came from, with
   its filters, not to the bare list.
4. **You can always see what is on.** Active filters appear as removable
   chips above the list, with "Clear all" and "Showing 23 of 389".
5. **Few filters up front, the rest folded away.** Each list shows its two
   or three everyday filters. Everything else sits under "More filters",
   with a count of how many are set.
6. **Views and filters never overlap.** A view tab is a saved set of
   filters. Pick a view and the chips show what it set.
7. **Options come from the data.** Pickers only offer values that exist,
   with a count beside each.
8. **Selection follows the filter.** Changing filters clears the selection,
   or the bar says "3 selected, 1 hidden by filters".
9. **Saved views on Talent Pool.** Name and keep a filter set, such as
   "Lagos nurses, live-in, verified", shared with the team.

### Talent Pool filters, folded

From 6 views plus 18 filters to 5 views plus 4 everyday filters plus
"More".

- **Views:** Active, Needs completion, Not looking, Not signed in, All.
  These absorb the four duplicate filters.
- **Everyday filters:** Search, Profession, State and LGA, Route.
- **More filters:** care type, live-in, minimum years, availability
  freshness, readiness, documents, referees, verification, channel,
  lifecycle, account.
- Remove Specialty or Profession, whichever the team uses less. Today
  there are both and they disagree.

## 2. Broken or leading nowhere (verified)

| Problem | Effect |
|---|---|
| Contracts issued from the candidate's Offers tab, the staff record and a contract template are not emailed and not checked | The person never hears about the contract. Only the contract editor emails and runs checks. |
| "Mark active" on a contract skips countersigning | No countersigned PDF is made or filed. |
| Availability "Offer work" opens the person's Work tab | The offer composer is on the Offers and contracts tab. Four links on Availability go to the wrong tab. |
| Staffing request page has two requirement editors writing the same fields from separate copies | Whichever Save is pressed last wins; the other edits are lost. |
| Matching ranks everyone, including staff and paused people | The ranking ignores lifecycle, staff status and looking status, which Talent Pool hides by default. |
| Shortlist on/off on the person record deletes the row whatever its stage | Unticking a "placed" shortlist erases it. |
| Person record's Matching tab lists binned postings and client requests | They link to the posting editor. |
| Application status set on the posting never reaches the candidate's stage | Two fields, one-way sync. "Withdrawn" shows a blank badge on the posting. |
| Staffing requests "Last matched" | Always blank. Nothing ever writes it. |
| Staffing requests can't be deleted or binned | The list hides binned ones, but no screen can bin one. |
| Staff record "New contract" dialog | Dead code; nothing opens it. The staff record cannot create a contract. |
| Staff status can be set to "exited" in a dropdown | Bypasses Return to Talent and its checks. |
| Contract editor back link always goes to the staff record | For a candidate who isn't staff yet, it lands on the wrong page. |
| Duplicating a campaign | Loses the block layout and the preheader. |
| Email Library | Saved emails are used by nothing. Campaigns start only from built-in recipes. System emails read old templates that have no editor. |
| Overview counts | "Care requests" and "Enquiries" count different things from the pages they open. |
| Invoice catalogue "Reset to defaults" | Deletes every service and category with no confirmation. |
| Contract template "Issue" | Uses the last saved version, ignoring unsaved edits, with no warning. |
| Annex library | Picking another annex throws away unsaved edits. Renaming an annex code breaks "Refresh from library" on templates. |
| Posting editor | Leaving the Details tab loses unsaved edits. Re-saving a closed posting overwrites its close date. |
| Bulk accept in Document review | Removes every picked row even if some failed. |
| Insights "Auto-send at 09:00" | A disabled dead button. |

## 3. Merge

| Merge | Why |
|---|---|
| **Applications (join) into Talent Pool and Intake** | Every join application already creates a person. The old screen has its own statuses, no notes, no link to the person and no way to see archived rows. Agreed earlier. |
| **Creator into Programmes** | Programmes is a page of counters. Make it the Creator screen. Heard has moved to its own project, so its admin screen leaves this one. |
| **Care requests and Clients into one Care list** | Same next-action engine, same destination (the client record), two different meanings of "Needs attention". One list with views: Needs attention, Awaiting responses, Assessment, Care running, Paused, Closed, Archived. |
| **Route to Care onto the enquiry** | Today an enquiry can only be sent to Care from a dialog on the Clients page, which also lists facility enquiries. Put "Route to Care" on the enquiry itself and show the client link once it is routed. |
| **One contract list** | The candidate's Offers tab and the staff record each show contracts with different actions. One shared list, and one issue path with checks and email. Add an "All contracts" register: issued and awaiting signature, across everyone. |
| **One application status** | Posting status, candidate stage, shortlist stage and join status are four vocabularies for one journey. One stage list, set from either side. |
| **One shortlist control** | The stage dropdown from Matches, used on the person record too. |
| **One requirements editor on a staffing request** | Keep the embedded matching editor and drop the page's chip editor, or the reverse, with one Save. |
| **Intake into Talent Pool** | Intake is a health board whose tiles don't link anywhere. Its numbers become Talent Pool tiles that open the matching filter. The maintenance buttons move to a Tools menu. |
| **Availability shown once on the person record** | Today it appears in three tabs. |
| **Administration into one page** | Settings (three switches), Alert keys and Admin access are three pages with three separate audit trails. One page with tabs: People and access, Notifications, Job keys, Audit. |
| **Audience groups managed in one place** | Groups are created in three places with different duplicate rules, and none can be renamed or deleted. |
| **Archive** | Either the central Archive covers everything (it misses clients and postings), or each list gets an Archived view and the central page goes. The second is simpler. |

## 4. Redundant or retire

- **Applications (join)** and **Creator** as standalone screens, once merged.
- **Programmes** as a counter page.
- **Intake** as a separate page.
- **Settings**, **Alert keys**, **Admin access** as separate pages.
- The editor's own Applications and Matches buttons on a posting, which
  repeat the tabs above them.
- The third way to archive a posting, via the status dropdown.
- The Specialty or Profession filter (keep one).
- The Heard admin screen and its access keys, now that Heard has moved to its own project.
- Old routes kept as redirects (`/admin/matchmakers`, `/admin/talent`,
  `/admin/match-universe/workforce`) can stay; they cost nothing.

## 5. Missing

**Everywhere**
- Column sorting. No admin table can be sorted by clicking a header.
- Record search in the command palette. It finds pages, not people,
  clients, posts or invoices.
- Notes with history. Notes today are one overwritable box per record;
  join applications and creator applications have none.

**Talent**
- Link from a posting application and a join application to the person.
- History of merged and rejected duplicate pairs.
- A "contracts awaiting signature" register.
- Bulk "ask to update availability" from the stale list.
- Busy and unknown people on Availability are counted but never listed.

**Care and Inbox**
- Name search on Clients.
- Paused and closed client views.
- Owner on enquiries as a pick from staff, not free text, and an owner
  filter.
- Enquiry notes, and replies logged instead of a mail link.
- Previous and next on the client record.

**Content and communications**
- Blog post search and status filter; SEO fields on posts (meta
  description, canonical). The SEO registers don't link to posts.
- Campaign status tabs and search; scheduling (a "scheduled" state exists
  but nothing sets it).
- Real recipient counts in the campaign audience picker, and engagement
  slices as a send target.
- Rename and delete audience groups; an unsubscribed state.
- Campaigns that start from a saved Email Library email; one editor for
  system emails.

**Finance**
- Invoice search, status and date filters, totals, export, an invoice
  detail view, and access to invoices older than the latest 200.
- A searchable client picker on new invoices (it stops at 300 clients).

**Administration**
- One audit log across access, settings and job keys.
- Notification recipient address.

## 6. Efficiency

| Issue | Where | Fix |
|---|---|---|
| Lists stop at 1,000 rows without warning | Audience contacts (965 today), campaign engagement events (10,470), activity, documents, all applications on postings | Page or count on the server for these. Audience is first. |
| One request per row | Care requests readiness; SEO bulk approve | One query for the set. |
| Whole view downloaded to count it | Overview care count | A count query. |
| Every change reloads the whole record | Client record (about 13 queries, and fires twice because realtime sees its own activity row); person record; Insights (11 calls after each nudge) | Update the changed part; ignore the screen's own writes. |
| Every load runs CV parsing and settles parsed fields | Talent Pool and person record | Run on a schedule or when a CV arrives. |
| Matching runs twice per ranking | Matches: top 50, then 500 again only to count exclusions | One call returning both. |
| Whole tables loaded to count one column | Opportunities loads every application to count per posting; post editor scans every post for categories | A grouped count. |
| `select("*")` pulling large unused columns | Campaigns list (full email bodies), Settings (reads email templates and annex library to show three switches) | Name the columns. |

## Suggested order

1. **The list standard** (section 1), built once and applied to Talent
   Pool, Clients, Enquiries and Document review first. This is the
   biggest daily win.
2. **The broken items** in section 2. Most are small. Contract emailing
   and the request double editor first.
3. **The merges**, in this order: Care list, contracts, application stage,
   Applications and Creator, Administration, Intake.
4. **The missing pieces** by domain, alongside the new kit.
5. **Efficiency**, starting with the Audience row cap.
