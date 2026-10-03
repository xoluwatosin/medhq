# Heard Letter Room, mobile refinement, logo and volunteer accounts

## Outcome

- Restore the previous populated Letter Room presentation while retaining the layered letter stack.
- Improve Heard’s mobile layouts and interactions across the consumer experience without redesigning desktop or changing product mechanics.
- Replace the hand-built logo with the approved **Primary horizontal** artwork from the supplied logo variations.
- Add the complete email/password volunteer account journey using the supplied copy, stopping after email verification.

## 1. Letter Room rollback

- Remove the recently added sealed/opened presentation from populated letters: corner and edge state tapes, click-to-open step, opened offset, pinned note, pigeonhole and the extra Letter Room ending treatment.
- Return populated letters to the earlier direct-reading experience: the selected approved letter is visible immediately and “One more letter” continues to select another.
- Keep the three-sheet `HeardLetterStack` behind the letter and keep the existing secure public-letter read path.
- Leave loading, empty and failure states working and accessible.

## 2. Mobile optimisation

- Review every Heard consumer route at phone widths, including long forms, the Letter Room, navigation sheet, footer, confirmation screens and the new volunteer account pages.
- Refine spacing, type hierarchy, touch targets, input sizing, safe-area treatment, stacking order and action placement specifically for mobile.
- Keep Bright White dominant, use Violet Ink, Mute, Late and Pale Sky according to the workbook, and preserve square edges and the restrained Heard visual language.
- Prevent horizontal overflow, clipped marks, cramped buttons, awkward line wraps and keyboard-obscured form actions.
- Preserve reduced-motion behaviour and accessible focus, labels, errors and live status announcements.

## 3. Approved logo artwork

- Extract the supplied Primary horizontal SVG artwork from the uploaded workbook and add it as the canonical Heard logo asset.
- Use the approved light-ground colourway in the Heard header and footer, with responsive sizing and protected clear space.
- Keep the standalone infinity mark for watermarks, dividers and decorative uses only.
- Remove the hand-assembled wordmark so the visible logo matches the supplied master artwork rather than approximating it in text.

## 4. Get involved and role selection

Add Heard-native routes that work both ways:

```text
heard.medicconnect.co/get-involved
<preview host>/heard-preview/get-involved
```

- Build the supplied **Get involved** page with the three roles and their exact descriptions.
- Add a focused role-selection step using the supplied “Choose a role” copy.
- Carry the selected role into account creation and persist it safely.
- Add “Get involved” to appropriate Heard navigation and footer locations without altering Medic Connect or legacy `/heard`.

## 5. Heard volunteer account journey

Build the supplied screens and normal deep links for:

- Create account
- Check your email
- Sign in
- Forgot password request and confirmation
- Reset password form reached from the recovery email
- A verified account landing state confirming the chosen role and that the next application stage is not yet available

Use email/password only. Require separate first and last names, accepted Terms and Privacy Notice, matching passwords and clear validation. Keep redirects host-aware so production remains at the Heard hostname root and preview remains under `/heard-preview`.

## 6. Separate volunteer profile and security

- Add a Heard-specific volunteer account/profile table linked to the authenticated user ID, storing first name, last name, selected role and application state.
- Keep it separate from the generic profile, Care records, candidate records and the existing public volunteer-interest records. Never match or merge by email, name or phone.
- Create the profile through a controlled server-side path after signup/verification, with user-scoped reads and updates and Heard-admin access only where explicitly permitted.
- Enable Row Level Security and explicit grants; anonymous users receive no profile access.
- Treat the authenticated user ID as identity. Email remains contact/sign-in information, not a cross-product identity key.
- Reuse the project’s existing email/password authentication configuration, enabling it only if the current setting requires it. Keep email confirmation on.
- Add password-strength, breached-password, duplicate-account and rate-limit handling consistent with existing Medic Connect account protections.

## 7. Compatibility and documentation

- Preserve hostname routing, `/heard-preview` deep links, the legacy `/heard` page, existing controlled Heard submissions, all existing volunteer records and all Medic Connect routes.
- Do not build the role questionnaire, Heard admin expansion, social features, profiles visible to other users or messaging.
- Update the Heard architecture document with routes, account boundaries, profile ownership, RLS and the deferred questionnaire.

## Verification

- Test populated, empty, loading and failed Letter Room states at desktop and phone widths.
- Test all Heard routes for direct load, refresh, internal navigation, one H1, no overflow and no console errors.
- Test account creation validation, duplicate email handling, verification redirect, sign in, sign out, forgot/reset password, protected landing access and cross-user profile isolation.
- Confirm anonymous users cannot read or write volunteer profiles and one signed-in volunteer cannot access another volunteer’s record.
- Run the relevant automated tests and inspect the latest preview build result.

## Technical details

- Schema changes will be additive and rollback-safe through a managed migration, with grants before RLS policies.
- The existing `profiles` table is generic and stores only `display_name`; the new Heard record will remain a distinct operational domain.
- Existing `heard_volunteers` remains intact for earlier interest submissions and admin history. Account creation will not overwrite or auto-link those rows by email.
