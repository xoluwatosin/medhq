# Admin access, brought up to date

Today the access list is stale, it only matches part of the current admin structure, and a staff member who already has a sign-in cannot be given admin access at all. This fixes all three.

## What changes

**1. Staff can be given admin access, even with an existing sign-in**

On a staff record, "Give admin access" will:
- create an invitation when the person has no sign-in yet, as now;
- grant access to their existing sign-in when they already have one (candidate or portal account), instead of failing.

One person keeps one login. Access can also be withdrawn from the same place, and restored later without a new invitation.

**2. The area list matches the current admin**

The checkbox list is rebuilt from the same source as the left-hand navigation, grouped by the eleven areas: Overview, Care, Talent, Workforce, Programmes, Inbox, Communications, Content, Finance, Insights, Administration. Missing areas are added (Finance/Invoices is currently absent), and areas that no longer exist are dropped. Each group has a select-all control so granting a whole area is one tick.

**3. A named delegate can manage access**

A new "Manage admin access" permission lets one or two trusted people add, edit and withdraw admin access. Only the super admin can grant that permission itself, and nobody can change their own access or the super admin's. Every grant, change and withdrawal is recorded with who did it and when, shown on the access screen.

**4. Tidier access screen**

Each person shows one clear line: name, email, their areas, account state (Not invited, Invited, Active, Withdrawn) and last sign-in. Editing opens a single panel with the grouped areas and the approval switches. Works on a phone.

## Technical notes

- Single source of truth: derive the area catalogue from `src/lib/admin-nav.ts` (`perm` keys plus domain labels) in a new `src/lib/admin-access.ts`, so navigation and access can no longer drift. Care-specific keys stay as a separate group.
- `supabase/functions/invite-admin`: look up the email first; if a user exists, upsert `user_roles` + `admin_permissions` and link `mu_people.auth_user_id` rather than calling `inviteUserByEmail`. Return which path was taken so the UI reports "Access granted" vs "Invitation sent".
- Authorisation in that function changes from super-admin-only to super admin OR a caller holding the new `admin_access` permission, verified server-side; granting `admin_access` itself stays super-admin-only. Self-edit and super-admin-target edits rejected server-side.
- Migration: audit table `admin_access_log` (actor, target, action, before/after permissions, timestamp) with admin-only RLS and grants; no changes to existing permission storage.
- `ControlCentre.tsx` rewritten against the grouped catalogue; `WorkforceStaff.tsx` access panel reuses the same component.
- `isNavItemActive`/`visibleDomains` untouched; `superAdmin: true` on the Admin access nav item becomes `perm: "admin_access"` with super admin implicitly included.
- Tests: catalogue covers every `perm` key used in navigation; delegate cannot grant `admin_access`; existing-user grant path.

Out of scope: no changes to sign-in, two-factor, Care, Talent, Workforce or Finance behaviour.
