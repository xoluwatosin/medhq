# Pass 7.5B + 7.5C: episodes, service configuration and delivery assignments

The final foundation before Tranche 8. No package, staffing, roster or visit work.

## Verified current state

- `care_assignments`: 0 rows. Role check still `assessor | named_caregiver | supervising_nurse`, broad `authenticated` DML grants and a `FOR ALL` policy from migration 0010.
- Absent: `care_packages`, `care_episodes`, `care_service_configurations`, `care_delivery_assignments`.
- Latest migration: `0049`. Next numbers are `0050` and `0051`.
- Exactly two live functions read `care_assignments`: `public.care_derive_stage` and `public.mu_workforce_blockers`. The logic originated in 0024/0031/0038/0042, but only these two current definitions need replacing.
- Canonical service vocabulary already exists: `public.services` with `slug`, plus `always_modules` and `conditional_modules`. Service codes will reference `services.slug`; no second vocabulary.
- Canonical capability model already exists: `public.mu_capabilities` with a check allowing `assessor` and `care_worker`. Delivery assignments use a capability code validated against this model; no job-title role strings.
- Module grammar already exists: `private.care_modules_for(definition, service_key, responses)` with `private.care_resolve_modules` as the client-scoped wrapper. The episode resolver reuses this grammar rather than inventing a second one.

## Migration 0050 — 7.5B foundation

`care_service_configurations`: id, `service_code` (references `services.slug`), version, status (`draft` / `published` / `retired`), effective_from, effective_to, `modules` jsonb, supersedes_id, created_at/by, published_at/by. Unique on (service_code, version). Published rows are protected against in-place edit by trigger; a change means a new version.

Module entries express: code, enabled, required, optional age applicability, optional capability applicability, optional family visibility default, and an options payload. No service catalogues are populated — only a fixture used by the tests.

`care_episodes`: id, client_id, service_code, service_configuration_id, service_configuration_version, `configuration_snapshot` jsonb, status (`planned` / `active` / `paused` / `completed` / `cancelled`), starts_at, ends_at, activated_at/by, created_at/by, updated_at. No package column in this pass.

Activation freezes the snapshot: service code, configuration id and version, the resolved module set at activation, and any episode overrides. Reading a historical episode never touches today's configuration. Publishing a new version never mutates an existing episode.

Transitions enforced server-side: planned→active, planned→cancelled, active→paused, paused→active, active/paused→completed, active/paused→cancelled. Completed and cancelled are terminal.

Resolver `private.care_episode_modules(episode, capability)`: reads the frozen snapshot, applies age, episode overrides and requesting capability through the existing module grammar, and returns a deterministic ordered set. A module with `required = true` survives every default, preference and non-safety override. No routing and no service-specific branching.

RPCs (security definer, fixed search path, staff permission checked, actor derived from `auth.uid()`, never from an argument): `care_service_config_draft`, `care_service_config_publish`, `care_episode_create`, `care_episode_activate`, `care_episode_set_status`.

Security on both tables: RLS on, no `anon` privileges, no `authenticated` INSERT/UPDATE/DELETE, least-privilege SELECT following the 0044/0046 pattern.

## Migration 0051 — 7.5C assignment correction

`care_delivery_assignments`: id, episode_id, person_id (`mu_people`), capability_code (validated against the canonical capability model), status (`planned` / `active` / `ended` / `cancelled`), effective_from (required), effective_to, assigned_at/by, ended_at/by, end_reason, created_at. Repeat periods for the same person and capability are separate rows; history is never rewritten. RPCs: `care_assignment_plan`, `care_assignment_activate`, `care_assignment_end`, `care_assignment_cancel`. Same hardened security pattern.

Lifecycle rewrite: `public.care_derive_stage` and `public.mu_workforce_blockers` are replaced in this migration to read `care_delivery_assignments`, counting only `planned` or `active` assignments on a `planned` or `active` episode as staffing. Ended, cancelled and assessor assignments never count. No historical migration file is edited.

Legacy `care_assignments`: revoke `authenticated` INSERT/UPDATE/DELETE, replace the `FOR ALL` policy with staff SELECT only, add a deprecation comment. Not dropped, no new rows. Assessor assignment stays on `care_assessment_work.assessor_person_id`.

## Documentation

Three corrections to `docs/care-platform/delivery-architecture.md`: section 10 rewritten so only the `care_assignments` correction blocks T8 (7.5D/7.5E precede visit UI, 7.5F precedes T9); delivery assignments are stated to hold the episode relationship now with the package relationship added additively in T8; service-configuration immutability against existing episodes stated explicitly.

## Tests

New rollback-safe `supabase/tests/care_delivery_foundation.sql` alongside the existing Care tests, proving: a draft configuration cannot activate an episode and a published one can; publishing v2 leaves a v1 episode untouched; a retired configuration stays readable; a safety-required module cannot be hidden; the resolver is deterministic for the same snapshot and context; valid transitions succeed and invalid ones fail; terminal statuses are terminal; two clients' episodes never cross-read; an active assignment belongs to one episode; capability codes are validated; ending preserves history; ended and cancelled assignments do not satisfy staffing; an assignment creates no access grant, basis, portal or finance right; no `anon` or `authenticated` direct DML on any new table; legacy `care_assignments` starts and stays at zero rows and rejects authenticated writes; and stage output for a full client journey matches the prior behaviour with staffing sourced from the new table.

## Verification

Typecheck, full Vitest, production build, and the rollback-safe SQL suite. No synthetic rows left behind; live records untouched.

## Not in this pass

Packages, pricing, staffing or roster UI, shifts, visits, visit events, monitoring, observations, interventions, medication, thresholds, portal screens, the offline refactor, and anything in Candidate Portal, Workforce, Match Universe or the public site.
