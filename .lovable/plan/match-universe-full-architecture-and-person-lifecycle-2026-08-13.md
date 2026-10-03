# Match Universe: full architecture and person lifecycle

## The one sentence

Match Universe holds one record per human being, assembled automatically from everything they have ever sent us, scored by what we can prove rather than what they claim, and searched deterministically when a client needs somebody deployed.

## The four layers

```text
LAYER 1  INTAKE        forms, files, admin uploads, portal uploads
LAYER 2  RESOLUTION    one person per human, latest truth wins, duplicates queued
LAYER 3  EVIDENCE      claim -> document -> review -> credential tier -> derived state
LAYER 4  DEPLOYMENT    requirements -> deterministic match -> shortlist -> placement
```

Nothing skips a layer. A person cannot be matched on a claim that has not passed through evidence, and no human ever types a verification state by hand.

## Layer 1 — Intake

Four doors, one destination.

| Door | Carries | Trigger |
| --- | --- | --- |
| Join application | full profile answers plus CV and certificates | `mu_link_join_application`, `mu_sync_join_documents` |
| Matchmaker application | role-specific answers plus required documents | `mu_link_matchmaker_application`, `mu_sync_matchmaker_documents` |
| Candidate portal | documents and self-corrections | direct write, then `mu_attach_credential_document` |
| Admin upload | documents received by email or WhatsApp | `mu_admin_upload_document`, always with a source note |

Every arriving file lands in `mu_documents` at `pending`, is typed by `mu_doc_type`, and if it looks like a CV it is queued for parsing.

**Rule:** a document with no trail is not accepted. Admin uploads must record who, when and where it came from.

## Layer 2 — Resolution

`mu_resolve_person` matches on normalised email, then normalised phone. A hit updates the existing person, a miss creates one. Latest application wins for identity fields; older values are never allowed to overwrite newer ones.

Two promotion passes then fill the profile:

- `mu_promote_application_answers` — form answers, highest precedence, fills nulls, disagreements written to `mu_field_conflicts`.
- `mu_promote_parsed_fields` — CV-derived values, lowest precedence, fills only what is still null.

Parsing itself is Claude with tool use, writing a narrative to `mu_cv_parses` and one row per field to `mu_parsed_fields` with confidence and the line of evidence. **Parsed is never verified.** The parser proposes; promotion and review dispose.

Name-only duplicates go to `mu_merge_candidates` for a human decision.

## Layer 3 — Evidence

Each credential is three independent axes, never one flag:

```text
CLAIM        what they told us          (stated | declined | silent)
EVIDENCE     what they sent us          (document, accepted or not)
VERIFICATION what we checked ourselves  (register lookup, reference)
                        |
                        v
DERIVED TIER  unknown -> declined -> self_declared -> documented -> verified
              plus expired and rejected as terminal states
```

`mu_people.verification_state` is computed by trigger from required documents plus remaining gaps. There is no dropdown, and there never will be.

`candidate_gaps` is derived live on every write: a field only appears if it is genuinely null after all promotion, if the credential has not been declined, and if the profession actually expects it. That single derivation drives the portal checklist, the admin banner, and the readiness percentage.

Two numbers, deliberately different:

- **Profile completeness** — how much of the record is filled.
- **Deployment readiness** — how much of it we can prove.

## Layer 4 — Deployment

```text
Opportunity  --Claude parses the brief-->  requirements as facets
                                            (required vs desirable, min evidence tier)
                                                 |
Person       --facets from profile + CV -->      |
                                                 v
                              mu_match_candidates  (deterministic SQL only)
                                 hard filters -> tier scoring -> availability
                                 -> ranked list + explicit exclusion reasons
                                                 |
                                              shortlist
```

The model reads and structures. The model never ranks and never selects. Availability is three-state and unknown never excludes, but stale availability is discounted.

## The person lifecycle end to end

```text
1  APPLIES        form submitted, documents attached
2  RESOLVED       matched or created, one profile, attribution recorded
3  PARSED         CV read, fields proposed with confidence and evidence
4  PROMOTED       form answers win, parsed fills the gaps, conflicts raised
5  INVITED        emailed a personal link to set a password
6  CLAIMED        signs in, sees only what is missing and why
7  COMPLETING     uploads documents, fills gaps, sets availability
8  UNDER REVIEW   each document accepted or sent back with a reason
9  READY          required evidence present, derived state flips to verified
10 MATCHED        appears in ranked results for a live opportunity
11 SHORTLISTED    put forward, client interviewing, placed or withdrawn
12 MAINTAINED     documents expire, availability goes stale, chased back to step 7
```

Step 12 returns to step 7. Nobody is ever rejected from the pool; they simply do or do not currently have provable evidence.

## Where the architecture is not yet honoured

- **391 documents pending review.** The queue exists but throughput is one at a time, so the evidence layer is stalled and 0 people are verified.
- **2,204 parsed fields still pending.** Layer 2 promoted into the profile but the field-level trail was never worked, so nobody can see what the parser claimed versus what we hold.
- **77 open conflicts with no screen.** They are written and never read.
- **7 failed parses and 18 never parsed.** Silent. No retry, no list.
- **0 admin uploads** despite the email and WhatsApp route being real.
- **Shortlist has no stages**, so steps 11 and 12 do not exist in data.
- **No expiry sweep**, so step 12 never fires.
- **Resolution ignores names**, so one person with two email addresses becomes two people.

## What I will build, in lifecycle order

**Intake health page.** Front of the funnel in one screen: arrivals today by door, documents by source, failed and unparsed CVs with a Retry button, people with no CV at all, merge and conflict counts.

**Parsed versus held panel.** One table per person: parser claim, our value, confidence, the evidence line, and Accept / Keep ours per row with bulk accept above a confidence threshold. This clears both the parsed-field backlog and the conflicts through a single control.

**Review queue as the front door.** A persistent count badge in the sidebar, bulk select, accept-many, keyboard next, filters by document type and shortlist pressure, and rejection reason codes.

**Verification tab as a worklist.** Required documents as rows with a status pill, preview, and Accept / Send back inline. Expiry captured on accept where the document type demands it. One banner stating the single reason they are not verified yet.

**One action bar, no loose prose.** Invite / Resend, Request documents, Upload for them, Message, with account controls in an overflow menu. Panel descriptions collapse to a line or a tooltip. Same treatment on the candidate portal.

**Closed lifecycles.** Shortlist stages through to placed or withdrawn, an expiry sweep that returns lapsed documents to the queue, bulk invite plus a chase for invited-not-claimed, and explicit Re-read CV and Re-promote actions on the profile.

## Questions

1. Should a parsed field above a confidence threshold auto-accept, or must a person confirm every one?
2. Two applications sharing a name but neither email nor phone: raise as a merge suspect, or leave alone?
3. Shortlist stages: is `shortlisted -> put forward -> client interviewing -> placed -> withdrawn` your language, or do clients use different words?
4. On accepting a document, always email the candidate, or only on rejection and on becoming fully verified?
5. Which documents carry a mandatory expiry on accept: licence, right to work, anything else?
6. Bulk invite: all 272 uninvited now, or in batches you trigger per profession or state?
7. How long before availability counts as stale, and how long before a verified person needs re-checking?
