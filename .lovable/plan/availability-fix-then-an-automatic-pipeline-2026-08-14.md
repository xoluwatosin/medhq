# Availability fix, then an automatic pipeline

Pass 1 is diagnosed. This plan covers the Pass 1 fix and the sequence for Passes 2 to 4, with the points where I stop and wait.

## Pass 1 — Availability board (build now)

The board was never broken; its default 14-day window simply contained none of the two stored days (13 Aug, yesterday; 1 Sep, five days past the window end).

- Default window stays at fourteen days. A wide default would dress three people ninety days out as coverage.
- When nobody matches, the empty state says so in words and lists the closest people with their next free date after the window.

- `saveTemplateDay` in the portal calendar currently ignores a failed write; it will show the same error toast the day save already shows.
- No change to `mu_available_people`, RLS, or the save shape.

Files: `src/pages/admin/MatchUniverseAvailability.tsx`, `src/components/portal/AvailabilityCalendar.tsx`, plus one new read-only SQL function for next-free-date.

## Pass 2 — Make the pipeline run itself

1. **Parse on arrival.** A trigger on `mu_documents` for CV-typed rows calls the `parse-cv` function through `pg_net`, guarded by a `parse_status` state machine so the same document cannot fire twice, with a retry sweep for anything left in flight. Verified by inserting a test CV and watching a `mu_cv_parses` row appear unaided.
2. **Promote automatically.** `mu_promote_application_answers` fires on application insert; `mu_promote_parsed_fields` fires immediately after a successful parse. Precedence is unchanged and now stated as an invariant rather than left as a side effect: form answers win, parsed values fill nulls only, and promotion never overwrites a value a candidate has corrected in the portal. First number reported back: how many of the 275 existing profiles change once promotion runs over the backlog.
3. **Settle parsed fields.** Promotion marks each row `promoted` or `conflicted`; genuinely undecided rows stay `pending`. One-off backfill of the existing 2,204 pending rows, with before and after counts.
4. **Scheduler.** Cron, with `CRON_SECRET` generated at the same time: expiry sweep daily 02:00 UTC, duplicate scan weekly Sunday 03:00 UTC, parse requeue hourly with a cap of three attempts per document, after which the document is left alone and surfaced on intake health. The overnight expiry sweep only flags documents; any candidate messaging it triggers is queued and sent during Lagos working hours.


## Pass 3 — Move the work to the candidate

**Threshold: 0.85.** Distribution across 2,207 parsed fields:

```text
0.95 - 1.00   1,937   88%
0.85 - 0.90     181    8%
0.75 - 0.80      87    4%
0.70              2  0.1%
```

At 0.85, 89 items go to candidates as questions, everything above promotes silently. Revisit after the first fifty candidates: raise the line if answers mostly confirm the parser, lower it if corrections are common.

**Validity is a separate test from confidence.** A shape check runs alongside the threshold and routes a field to the candidate regardless of score: a state field containing a separator ("Abuja, Lagos"), a phone number that fails format, a licence number that does not match its body's pattern.

Also in this pass:


- Failed parses split into two messages: a file the parser cannot open asks for a PDF; a PDF with no text layer asks for a clearer or typed copy and says why. Counts per bucket reported.
- One email after parsing and promotion finish, linking to the portal with a count of items needing attention. No email when there is nothing to answer. Tested end to end on Frank-Dobi Munachim.
- Candidate answers stay claims: confirming a parsed value must not lift a credential above self_declared. I will show the line that guarantees it.

## Pass 4 — Orphans (proposal only, nothing built)

- A minimal screen for the 77 open rows in `mu_field_conflicts`.
- One authoritative source for document requirements, currently split between `mu_required_documents` and `mu_expects_licence`.
- Making an expiry date mandatory at review time for Licence and Right to work, where 0 of 397 documents currently carry one.

