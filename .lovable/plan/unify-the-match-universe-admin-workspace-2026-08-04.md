# Unify the Match Universe admin workspace

## Goal

Merge the admin surfaces for **Match Universe** (the talent pool) and **Healthcare Matchmakers Network** (opportunities + applications) into one coherent workspace. Matching should work both ways: opportunity-first and person-first. The public-facing **Healthcare Matchmakers Network** brand, landing pages, and share links stay unchanged.

## Current state

- **Match Universe** lives at `/admin/match-universe`: a roster of people, individual profile pages, and a merge review queue.
- **Healthcare Matchmakers Network** lives at `/admin/matchmakers`: a list of opportunities, an editor for each opportunity, an applications page, and a new Matches page that ranks talent-pool candidates against an opportunity using the deterministic `mu_match_candidates` SQL function.
- Public opportunity pages are served from `/hm/:slug` and keep the Healthcare Matchmakers Network branding.

## What we will build

### 1. One admin workspace with a clear tab structure

Move the admin experience under the **Match Universe** namespace and split it into three top-level areas:

```text
/admin/match-universe
  ├── Roster            (was /admin/match-universe)
  ├── Opportunities     (was /admin/matchmakers)
  └── Merges            (was /admin/match-universe/merges)
```

Each opportunity page becomes a hub with three tabs:

```text
/admin/match-universe/opportunities/:id
  ├── Details           (was MatchmakerEditor)
  ├── Applications      (was MatchmakerApplications)
  └── Matches           (was MatchmakerMatches)
```

### 2. Opportunity-first matching

This already exists in the Matches tab. Keep it exactly as it is conceptually:

- Admin opens an opportunity, reviews required/desirable facets extracted by Claude, edits them, and saves.
- SQL returns ranked candidates from the talent pool with hard-blockers and score breakdowns.
- Admin can shortlist, remove from the shortlist, and request an on-demand "Why" fit note.

### 3. Person-first matching

Add a new **Opportunities** tab to each person profile in the Roster. This shows all opportunities that fit the person, ranked by the same scoring model but reversed:

- Required/desirable facets of every open opportunity are compared against the person's profile facets.
- The list shows score, matched/missing requirements, and blockers from the opportunity side (e.g. the person is below the opportunity's minimum years).
- Admin can shortlist the person to an opportunity directly from the profile.

A new database function `mu_match_opportunities_for_person` will run this deterministically, using the same `mu_match_weights` table so weights stay consistent in both directions.

### 4. Backwards-compatible redirects

Old `/admin/matchmakers` and `/admin/matchmakers/:id*` routes will redirect to the new `/admin/match-universe/opportunities*` routes so bookmarks and public links continue to work.

### 5. Public brand unchanged

- Public `/hm/:slug` pages keep the "Healthcare Matchmakers Network" name and styling.
- Share links, application forms, and opportunity landing pages are not touched.
- Only the admin navigation labels and URLs change.

## Technical work

- Rename and relocate the admin components:
  - `MatchmakerList` → `MatchUniverseOpportunities`
  - `MatchmakerEditor` → `OpportunityDetailsTab`
  - `MatchmakerApplications` → `OpportunityApplicationsTab`
  - `MatchmakerMatches` → `OpportunityMatchesTab`
- Add a new `PersonOpportunitiesTab` component on the person profile page.
- Add a new database function `mu_match_opportunities_for_person` that mirrors `mu_match_candidates` but iterates opportunities against a single person.
- Update `src/App.tsx` admin routes and add redirect rules for the old `/admin/matchmakers/*` paths.
- Update the admin sidebar/navigation labels so the Match Universe section is the single entry point.

## Suggested build order

1. Move the existing admin routes and add redirects.
2. Add the new tab layout inside the opportunity page.
3. Add the person-first matching tab and the database function that powers it.
4. Update the admin navigation/sidebar.
5. Verify backwards-compatibility and that public opportunity pages still work.
