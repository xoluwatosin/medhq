# SEO governance: hardening and acceptance pass

Findings at HEAD (migration `0088_seo_governance_foundation.sql`, no later commit touches SEO):

- `seo_claim_effective_state` is declared `IMMUTABLE` but reads `now()`.
- Every SEO table grants full insert/update/delete to `authenticated`; only RLS holds the line.
- `seo_fee_refs` allows both page and module owners at once (only an `OR` check exists).
- `clinical_review_required` is a `NOT NULL boolean` seeded per page category, and the gate never looks at attached modules or claims.
- Confirmed defect for section 8H: once a page is `indexable`, nothing re-checks it. If a required claim expires or a market is suspended afterwards, the page stays labelled `indexable`.
- No SEO database tests exist; the project convention is a rollback-safe `BEGIN … ROLLBACK` script under `supabase/tests/`.

## What this pass changes

### 1. Claim state function
Redeclare `seo_claim_effective_state` as `STABLE`. Logic unchanged.

### 2. Privileges (least privilege)
- Revoke `INSERT, UPDATE, DELETE` from `authenticated` on all ten SEO tables. Keep `SELECT` (RLS still admin-only). `anon` keeps nothing. `service_role` unchanged.
- Add `SECURITY DEFINER` write functions using the existing `private.seo_can_write()` admin check: `seo_page_save`, `seo_claim_save`, `seo_market_save`, and link functions for page↔module, page↔claim, page↔market, page↔service and fee references. Module writes already go through `seo_module_save`.
- Point the four registers (and the page detail screen) at those functions instead of direct table writes. No visual redesign.

### 3. Fee-reference ownership
Replace the `OR` check with the XOR rule `(page_id IS NOT NULL) <> (module_id IS NOT NULL)`, enforced at database level.

### 4. Clinical review becomes derived, not guessed
- Add `requires_clinical_review boolean NOT NULL DEFAULT false` to `seo_modules` and `seo_claims` (the governed source of the requirement).
- Add a nullable `clinical_requirement text` on `seo_pages` with values `required` / `not_required`; `NULL` means not yet determined. The existing boolean stays in place but is no longer treated as an editorial decision.
- `seo_page_blockers` now blocks when: the page is explicitly `required` and unreviewed; **or** any required attached module or claim requires clinical review and has no recorded approved clinical review; **or** the page requirement is still undetermined while clinical components are attached.
- No clinical decisions are fabricated for the 25 seeded pages; they stay undetermined.

### 5. Indexable pages cannot silently rot (section 8H)
Smallest robust correction:
- Add a re-check trigger on `seo_claims`, `seo_modules`, `seo_markets` and the link tables: when a dependency changes, any `indexable` page that now has blockers is demoted to `noindex` with the reason recorded in `notes`.
- Add a stable `public.seo_page_publishable(page_id)` guard and a `seo_indexable_pages` view that returns only pages with zero live blockers, so sitemap and public rendering can never read a stale label.

### 6. Acceptance test suite
New rollback-safe `supabase/tests/seo_governance.sql` following the existing care-test style (synthetic fixtures, deterministic dates, `BEGIN … ROLLBACK`), covering A–H exactly as specified: indexability gate (each blocker separately, then a fully satisfied page), claim expiry, clinical inheritance from module and from claim, market serviceability both ways, module revision history with actor/timestamp/prior content and loss of stale approval, authorisation for anon / ordinary authenticated / admin, fee-reference XOR, and the full transition matrix including dependency invalidation after indexing.
Client-side mirror tests in `src/lib/seo-registry.test.ts` are extended so the TypeScript blocker logic matches the corrected server rules.

### 7. Seed boundary
No seed data is added or rewritten. The 25 page records and 16 module shells keep their IDs; no prose, claims, market availability or indexable pages are created.

### 8. Admin check (no redesign)
Verify the four registers and the page detail screen show: page state plus the principal blocker, module review state with clinical requirement and last revision, claim approval and effective/expired state with evidence, and market state with serviceability and evidence. Only add a missing column or status where one of these is not currently visible.

## Technical notes

New migrations: `0092_seo_governance_hardening.sql` (volatility, grants, XOR, clinical columns, corrected blockers, write RPCs, demotion triggers, publishable view). Types regenerated. Admin components edited only where a direct write must become an RPC call.

## Acceptance report at the end
Files changed, migrations, exact privilege model, clinical inheritance rules, XOR enforcement, tests added, test results, SEO table counts, count of indexable pages (expected zero) and remaining governance risk. No page generation.
