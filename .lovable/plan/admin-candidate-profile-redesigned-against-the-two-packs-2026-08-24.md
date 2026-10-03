# Admin candidate profile, redesigned against the two packs

The two uploads are visual references, not build orders and not a copy source. Layout, proportion, type scale, colour discipline and interaction shape come from them; every word on screen stays the app's existing live copy. The candidate pack sets the type scale and the one-navy-surface rule, the admin pack sets the admin furniture. Neither pack draws the candidate profile page itself, so this build applies their layout grammar to it.

Work in this pass: `/admin/match-universe/:id`, its six tabs, and candidate names in the roster. No queries, RPCs or edge function calls change.

## Layout grammar taken from the packs

- One navy surface per screen. Headings weight 600, negative tracking, Figtree, no serif.
- Rows read as a title, then state, then one action. No percentages, no rings, no zero counts.
- Pills: tint for settled, amber for anything needing attention or recoverable, grey for closed. Red is reserved for overdue money, so it leaves this page entirely.
- Cards carry the name, then profession and location on one line, one status pill, then two facts as chips.
- Mobile: tables become cards, tabs scroll sideways rather than wrap, the primary action stays in thumb reach, and nothing is desktop only.
- Existing wording is kept. Where a row has no sentence today, it is written in the project's own voice, not lifted from the packs.


## 1. The hero

One navy surface, watermark bled off the right corner.

```text
+--------------------------------------------------------------+
| NAVY                                                         |
|  CANDIDATE  (eyebrow)                                        |
|  Joyce Ayamke                    [ Invite to their profile ] |
|  Registered nurse, Ikeja                                     |
|  ------------------------- hairline ------------------------ |
|  Email        | Phone        | Location      | Experience    |
+--------------------------------------------------------------+
|  WHITE strip, three sentences divided by hairlines           |
|  Verification        Documents           The record          |
+--------------------------------------------------------------+
```

- Name at 30px, weight 600, tracking -0.03em, white. No initials tile.
- Contact facts become a labelled grid on navy, dim labels and white values, vertical hairlines on desktop, stacked rows on phone.
- One primary action (invite, or open the staff record when they are staff). WhatsApp and the overflow menu become white outline secondaries.
- The white strip holds three plain sentences in ink, no chips.

## 2. The tab rail

Six navy blocks become one quiet hairline rail: active tab in ink at weight 700 with a 2px navy underline, the rest muted, a count marker only where a decision is waiting (documents awaiting review, offers awaiting an answer). Sticky, sideways scrolling on phone, 44px targets. Tab keys and the existing alias map stay, so saved links keep working.

## 3. The six tabs

Shared shape: one section per idea, a sentence description, rows as title then plain-language state then chip or a single action on the right.

- **Verification** Leads with the decision surface, stated as the document review screen states it: what is outstanding, how long it has been outstanding, and what acceptance would settle, with accept and return on the row. Then documents, credentials, references, account access.
- **Profile** Two columns on desktop: the canonical record on the left as a label and value table with hairline rows and no zebra striping, the CV read on the right so a reviewer compares instead of scrolls. Provenance sits as a quiet line under the value.
- **Matching** Opportunity fit first, then work preferences as chip groups instead of a form dump, then availability. Each section says in one sentence what the matcher does with it.
- **Work** Offers, current engagement and leave as three titled sections, sentence states, one action per row.
- **Applications** One row per application: what they applied to, when, outcome as a pill. Attribution and answers open inline, not as nested accordions.
- **Activity** One dated stream with notes above it, one sentence and one actor per entry, no email versus activity split.

## 4. Roster names

In the candidates list a name becomes a strong ink link at weight 700 with profession and location as the quiet second line, matching the pack's card, rather than muted or oversized dark text.

## Gaps between the packs and the app

Listed for a decision, not built in this pass.

1. **No Today screen.** The admin pack opens on Today: items requiring a decision, then a candidate pool strip. The app opens on a dashboard with no decision queue.
2. **Rail shape differs.** The pack groups fourteen items as Today, Work, Queues, Care, Audience, Settings with counts on Document review and Intake. The app has Overview, Match Universe, Staff, Inbox, Content, Data and carries no counts.
3. **Candidate list cards.** The roster is a desktop table; the pack specifies cards at 375 points with one pill and two chips.
4. **Document review is not a single task screen.** The pack makes it one document at a time, with position ("1 of 39"), what acceptance establishes, and a return sheet with fixed reasons. The app reviews inside panels.
5. **Requests is not staged.** The pack runs four ordered stages from first contact to care agreed, with the assessment fee invoiced on booking.
6. **No placements or client care record** in the pack's shape: one chronology per household with assessment, plan, who is assigned, reviews, and invoices behind their own tab.
7. **Long tasks are not stepped.** Writing a brief, raising an invoice and recording a placement are one question per screen with a draft saved after each step.
8. **Colour discipline.** Red is used for several attention states today; the pack reserves it for overdue money.
9. **Candidate side, smaller gaps.** The join flow lacks the pack's number confirmation step as drawn and the guided one-question-per-screen build; the portal home does not lead with a single named next thing.

## Technical notes

- Files: `src/pages/admin/MatchUniversePerson.tsx`, `src/components/admin/mu/MuShell.tsx` (add hero, tab rail and row primitives, retune `MuSection`, `MuTable`, `MuStatus`), `src/pages/admin/MatchUniverse.tsx` (name treatment), and presentational passes on `DocumentsPanel`, `CredentialsPanel`, `CvDataTab`, `PersonOpportunitiesTab`, `WorkPanel`, `WorkPreferencesPanel`, `CandidateAccountPanel`, `ReferencesPanel`.
- Only tokens already in `src/index.css` and `tailwind.config.ts` (`navy`, `body-navy`, `muted-navy`, `desk`, `line`, `line-soft`, `warn-*`, `tint`). No new hex values in components.
- No changes to `load()`, database reads, RPCs or functions.
- Verified after build with a desktop and a phone screenshot of each of the six tabs.
