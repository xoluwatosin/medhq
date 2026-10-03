# Priority 1 readiness audit (25 page briefs)

State at the end of the pricing-registration and clinical-gate pass. No page has been
generated, approved, published or indexed.

## Registry counts

| Item | Count |
| --- | --- |
| Page briefs | 25 |
| Indexable pages | 0 |
| Module shells | 16 (all unapproved) |
| Claims | 33 (all unapproved) |
| Markets | 5 (4 serviceable, Port Harcourt/Rivers research) |
| Public current fees | 34 (20 fixed, 14 from) |
| Fee references | 44 across 18 pages |
| Quote-only pages (no public price attached) | 7 |

## Publication gate now in force

A page is blocked unless: publication state is ready or published, every required
claim is approved and in date, every required module is approved, an attached market
is serviceable where relevant, and any quoted price is backed by a fee record that is
current, public and priced. Clinical risk is retained as governance metadata and is no
longer an independent publication dependency.

## Readiness by page

All 25 pages: **BLOCKED — CONTENT/GOVERNANCE**.

Common blockers on every page:
- Publication not ready (all briefs remain `planned` / `candidate`; no title, H1, meta,
  CTA or schema has been written).
- Required claim not approved (3–13 attached claims per page, none approved).
- Required module not approved (3–9 attached modules per page, none approved).

Page-specific notes:
- `/guides/what-does-an-omugwo-caregiver-do` — no market attached, so it also has no
  market dependency; it is the only brief without the four served markets.
- 18 pages carry governed public fees and are **not** blocked on pricing.
- 7 briefs (`/event-medical-cover`, `/careers`, `/for-facilities`,
  `/ngo-healthcare-staffing`, `/nurse-staffing`, `/careers/nursing`,
  `/guides/what-does-an-omugwo-caregiver-do`) carry no public price and remain
  quote-based by policy; they are not blocked on pricing.

No page is **BLOCKED — PRICING**, **BLOCKED — MARKET** or **BLOCKED — TECHNICAL**.
No page is **READY AFTER GOVERNANCE** yet, because no brief has been written up or
approved.

## Markets

Served and serviceable: Lagos, Abuja / FCT, Ogun State, Ibadan / Oyo.
Port Harcourt / Rivers remains research and is attached to no page.

## Pricing mapping

All 34 approved tariff rows were registered against existing services as public,
current operational fee records with `PUB-*` SKUs. No service was created, no amount
was altered, no package price was calculated and no internal or worker rate was made
public. Live-in, 24/7, overnight, Omugwo package, managed nanny, palliative, complex
long-term, diaspora managed care, institutional, NGO, research and bespoke B2B
arrangements remain quote-based.

## Verification

- Rollback-safe acceptance suite `supabase/tests/seo_governance.sql` updated: clinical
  metadata never blocks; only current, public, priced fees satisfy the pricing gate.
- Suite exercised against the live schema inside a rolled-back transaction: passed.
- Client mirror `src/lib/seo-registry.ts` and tests aligned: 23 files, 211 tests passed.
