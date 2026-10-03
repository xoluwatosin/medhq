# Documents, verification and one profile per person

Four connected pieces: a better invite email, a real document lifecycle in admin, an automatic verified state, and consolidation of every application into a single profile with conflicts flagged.

## 1. Invite email matches the campaign look

Today the "set your password" email is a plain green box built inline in the invite function. Campaign emails use the shared branded renderer (serif body, brand palette, footer with address and links).

- Rebuild the invite email with the same renderer and footer used by campaigns, so it looks like everything else we send.
- Give it more depth:
  - why the profile exists (we hold their application and CV on file)
  - a plain explanation that we receive client enquiries and deploy from our pool, and that we can only put forward people whose details and documents we can verify
  - a request to keep information current and upload the documents we need
  - a named list of what is outstanding for them personally (missing fields and missing documents)
  - the "Set your password" button, plus a note that the link is personal to their address
- Make the subject and body editable from Admin > Email Templates, alongside the interview and rejection templates, with tokens for name, gaps list and the link.

## 2. Document lifecycle in admin

Replace the current "mark verified / mark rejected" icons and the credential dropdown with one Documents workspace on the person's page.

- **Required documents** per person, derived from their profession: CV and identity always; licence only for professions that require one; qualification; right-to-work and NYSC where relevant. Each shows one of: missing, uploaded and awaiting review, accepted, rejected, expired.
- **Uploads by admin on the candidate's behalf**, for documents that arrive by email or WhatsApp. The upload form requires the document type and a short source note ("emailed 12 Aug"), and records the admin who uploaded it. Both are shown on the document row and written to the person's activity trail.
- **Review** a document with Accept or Reject. Rejecting requires a reason. Accepting can record an expiry date where the document has one.
- **Feedback**: rejecting emails the candidate automatically with the reason and what to send instead, and the same message shows in their portal next to that document. The email is logged on the activity trail.
- **Verification queue** shows every document awaiting review across the pool, so nothing sits unseen.
- No manual "verified" dropdown anywhere. A person's verified badge is computed, never set by hand.

## 3. Verified is computed, not chosen

A person is Verified only when both are true:
- every required document for their profession is accepted and not expired, and
- no outstanding profile gaps (core fields such as profession, experience, state, LGA, availability).

Anything less shows as Not verified with the exact reason listed ("licence not uploaded", "LGA missing"). If a document expires or a field is cleared, the person drops out of verified automatically. Matching keeps using the existing evidence tiers, so this does not change ranking, only the badge and the deployable view.

## 4. One profile per person, all applications parsed in

- Every application route (join application, matchmaker application, any future form) resolves to the same person by email or phone and writes its answers into that person's profile fields, not just into the application row.
- **Latest application wins, conflicts flagged**: the newest answer applies, and where it disagrees with what we already held, the difference is queued for an admin to confirm or revert on the person's page. Nothing changes silently.
- Documents attached to any application are filed against the person and counted towards their required set.
- The applications history (which roles, when, outcome) stays on the profile as attribution, not as a status on the person.

## Technical notes

- `mu_documents` gains: document type, uploaded-by, source note, review outcome, review reason, reviewed-by/at, expiry. The old `verified` / `rejected` booleans are derived from the review outcome so existing reads keep working.
- New `mu_required_documents` mapping profession family to required document types, plus a function returning per-person required-vs-held status.
- `mu_people.verification_state` becomes derived by trigger from that function and `candidate_gaps`; no client write path.
- Reject path calls a `notify-candidate-document` edge function (Resend, shared branded template) and inserts an `mu_activity` row.
- Invite email moves to the shared campaign HTML builder; template body/subject stored in `admin_settings`.
- Conflicts continue to use `mu_field_conflicts`, extended so the person page can accept or revert each one.
- Admin uploads reuse the existing `applications` storage bucket and the `mu_attach_credential_document` RPC so evidence stays on one path.
