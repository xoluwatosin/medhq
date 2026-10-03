# Care records: rebuild the spine, the layout and the skin

## What I found in the live records

Bukayo's file `MC-2609-0082` is attached to **two separate care requests**:

- one auto-created legacy record, its own group named "Oluwabukayomi Bolanle", recipient row with no linked person
- one created at onboarding, group "Oluwatobi Belewu care group", with Tobi recorded as the enquirer and Bukayo as the linked person

Tobi exists as a person record with her email and phone, but there is **no relationship row** joining her to Bukayo. The relationships table is empty for every family in the system, and only one group member row exists in total. So nothing in the interface can say "Tobi is Bukayo's mother" — hence the split view.

Two further gaps confirmed by reading the code:

- Website care request submissions land in the submissions table and **stop there**. No code creates a care request or client file from them. The column meant to record that link is never written.
- There is **no close or archive action** on a client file. Closed/paused fields exist in the database but nothing in the interface sets them.

## The target model

```text
 PERSON FILE (the spine - every person has one)
 ┌──────────────────────────────┐   ┌──────────────────────────────┐
 │ Oluwatobi Belewu             │   │ Oluwabukayomi Bolanle        │
 │ Client / Enquirer / Payer    │◄─►│ Care recipient               │
 │ email, phone, contact prefs  │   │ DOB, sex, clinical record    │
 └──────────────┬───────────────┘   └───────────────┬──────────────┘
                │      mother of / son of           │
                └───────────────┬───────────────────┘
                                ▼
 HOUSEHOLD FILE (created only where people are cared for together)
 ┌──────────────────────────────────────────────────────────────┐
 │ Belewu household      Address, LGA, state, access notes      │
 │ Members: Tobi (client), Bukayo (care recipient)              │
 │ Joint care: postnatal + newborn delivered as one arrangement │
 └───────────────┬──────────────────────────────────────────────┘
                 ▼
 CARE REQUEST  ──►  one request, both recipients, one pre-assessment
                 ▼
 EPISODE ──► PROPOSAL ──► CARE ──► CLOSE / ARCHIVE
```

A person file is the primary record. A household file is created only where it earns its place, principally postnatal and newborn care delivered together. Opening either shows the other in one click, with shared documents, shared pre-assessment and one joint timeline.

## Stages

Enquiry → Care request → Pre-assessment → Assessment → Proposal → Care started → On hold → Closed → Archived. Existing stored values keep their names; only the presentation and the movement rules change.

Each stage shows: who owns it, what is outstanding, what happens next. Movement between stages is explicit and recorded, never silent.

## Screens

1. **Care requests** — one row per request, showing household or person, all recipients, services, stage, owner, next action.
2. **Person file** — identity, linked people, care requests, pre-assessment answers, documents, contracts, invoices, activity. Linked people banner sits directly under the name.
3. **Household file** — members with roles and relationships, joint address and access, joint care requests, combined document set.
4. **Enquiries → Care requests routing** — website care request submissions create an enquiry record automatically, with a staff step to convert it into a care request and either attach to an existing person/household or create new ones. Matching on email and phone is a signal only; staff confirm, nothing merges itself.
5. **Close and archive** — close a care request with a reason, put a file on hold, archive a closed file. Archived files stay readable and appear in the Archive area.

## The skin

The care screens take the brand kit treatment already used on the pre-assessment: Figtree, warm white and navy, square corners, generous section rules, the same field, notice, step and status components. Applied across care requests, person file, household file, enquiries and archive so the whole area reads as one product.

## Technical notes

- Additive migrations only. New relationship and household-role structures, no dropped columns, no renamed stored values.
- Bukayo and Tobi are corrected as part of the work: the duplicate legacy request folds into the onboarding request, the mother/son relationship is written, a Belewu household is created. Done as a data correction with the new build in place, not as a merge tool.
- New security-definer functions for relationship writes, household membership, request close/archive and submission conversion. RLS and grants on every new object; no direct browser writes.
- Routing conversion runs server-side and is audited: who converted, from which submission, into which person or household.
- No changes to Heard, Match Universe, Workforce, marketing pages or the public care request form itself.

## Order of delivery

One combined push, in this internal order so nothing sits half-built: relationships and household structure → routing and close/archive → screen layouts → skin → verification of every care route on desktop and mobile.
