# Complete family portal invitation acceptance

## Goal
Replace the dead invitation link with a secure, usable path from the invitation email into the family member's authorised Care access. Keep the existing staff-controlled grant and its journey, clinical and finance scopes unchanged.

## What will be built
1. Add a public invitation page at `/care/invitation/:token` using the existing soft-surface system.
2. Add a narrowly scoped invitation service that:
   - hashes and validates the one-time token;
   - rejects expired, withdrawn or already accepted invitations;
   - reveals only the minimum status needed by the page;
   - requires the invited email address to complete secure email verification;
   - binds the verified account to the existing Care person only when no different account is already linked;
   - marks the invitation accepted without changing the recorded access grant or scopes;
   - records opening, acceptance and failure events for audit.
3. Support both people who already have a Medic Connect account and people creating one from the invitation, without treating email as the person's identity or merging records.
4. Redirect successful acceptance to a bounded Care home screen that shows only information permitted by the existing grant. If the full family portal is still out of scope, this first screen will confirm access and show the authorised journey summary only.
5. Keep resend behaviour on the same invitation, with a rotated secret, and ensure staff see accepted, expired, withdrawn and failed states accurately.

## Security and data rules
- The invitation token is never stored in plain text.
- A signed-in account must verify the invitation's destination before it can be linked.
- An existing `care_people.auth_user_id` can only be reused when it is the same account; conflicts stop acceptance for staff review.
- The access grant remains the sole authority. Acceptance cannot widen journey, clinical or finance scope.
- No matching or merging by email, phone or name.
- No family access is granted automatically.

## Verification
- Invitation URL renders instead of Not Found.
- Valid invitation can complete email verification and acceptance.
- Invalid, expired, withdrawn and already accepted links show the correct state.
- A mismatched signed-in account cannot accept an invitation.
- A linked account cannot be replaced by another account.
- Revoked or suspended grants do not expose Care data.
- Retry links rotate safely and the latest link works.
- Mobile and desktop browser checks pass, with no overflow or console errors.
- Existing Admin access controls, Candidate Portal and pre-assessment routes continue to pass their tests.

## Not included
No change to Care lifecycle logic, permission scopes, automatic family grants, record merging, staffing, visits, medicines administration, invoicing or payments.
