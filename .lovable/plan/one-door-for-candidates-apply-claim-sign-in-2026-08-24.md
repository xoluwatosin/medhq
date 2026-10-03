# One door for candidates: apply, claim, sign in

Right now there are two separate ways in and they do not meet:

- New people go to `/join`, create an account, and land in the portal.
- People already in Match Universe only get in when an admin presses "Invite" on their profile, one person at a time.

If someone already on file signs up at `/join` with the same email, one of two bad things happens: the sign-up is rejected as "already registered" (if an admin ever invited them), or a brand new auth account is created that is not attached to their existing record, so the portal shows them an empty profile and we get a duplicate person.

The Locum clinical assessor blast is a good forcing function. The answer is not to bundle "here is a job" and "here is your password" into one confusing email, but to make one door that behaves correctly whoever walks through it.

## How it should work

**One rule: the email address is the identity.** Any time an account is created or claimed, we look for a person on file with that email and attach to it rather than creating a second one.

Three journeys, one destination:

1. **Never heard of them.** `/join` → pick track → create account → new person record → complete profile.
2. **On file, never had a password.** They enter their email at `/join` or `/portal/login`. We recognise it, do not create a second record, and email them a set-password link. They land on their existing profile with everything we already hold, and are asked to confirm or correct it.
3. **On file, has a password.** Straight sign-in. If they arrived from a job, they go back to that job after signing in.

## The Locum clinical assessor send

A job-led email only converts the people who want that job. Everyone else reads it, decides it is not for them, and stays unclaimed. So the job is the hook, not the only door.

- Publish the role as a normal opportunity page.
- Send it to the list as a job email: here is the role, here is what it pays, here is what we need. Primary button **Apply for this role**, secondary link **Not this one? Open your profile and tell us what you do want**. Both carry the same per-person claim token, so either click claims the account.
- Whichever they click, setting a password happens inside the flow, not as a chore before it.
- The claim token lives on their record and stays valid, so a later click on any subsequent email still claims them. Claiming is never a one-shot chance tied to one job.
- Because the second link is about their own preferences rather than this role, the uninterested reader still has a reason to click. They land on their profile, confirm what they hold and set what they are actually looking for, which is worth more to us than a declined application.
- Second wave, seven days later, to non-claimers only: no job in it, just "here is what we hold on you and what is outstanding" with the same token. This is the invite email we already have, sent in bulk rather than one at a time.
- Third wave is human: the roster shows who is still unclaimed after both sends, and those go to a WhatsApp or call list rather than more email.

Result: the job send converts the interested, the profile link converts the curious, the follow-up sweeps the rest, and every applicant arrives with a profile already attached rather than a blank form.



## Applying with a profile on file

Applications become an act of a signed-in person, not an anonymous form:

- Anonymous visitor hits Apply → account step first (create or sign in), then the application.
- Signed-in person hits Apply → the form is pre-filled from their profile. They only answer what is specific to this role, plus anything still outstanding on their profile that the role requires.
- The application is stored against their person record, so it appears in their portal Applications tab and in the admin roster, and their documents come with it.

## Technical shape

1. **Claim path (backend).** A public edge function `candidate-claim` takes an email. If a person exists with that email and has no account, it generates an invite/recovery link (same hashed-token pattern as `invite-candidate`, so mail scanners cannot burn it) and emails it. If no person exists, it returns "not on file" without leaking anything, and the UI falls through to normal sign-up. It never confirms or denies account existence in the response text.
2. **Attach on first sign-in.** In `PortalAccount`, when no `mu_people` row matches `auth_user_id`, look up by the signed-in user's verified email and attach `auth_user_id` + `claimed_at` to that row instead of creating a duplicate. Add a matching `mu_claim_person_by_email` security-definer function so the client cannot attach itself to an arbitrary row.
3. **`/join` recognises returning people.** On sign-up failure with "already registered", and on a positive `candidate-claim` lookup, switch the card to "We already have you on file" with a sign-in field and an "email me a link" button, instead of the current bounce to `/portal/login`.
4. **Bulk invite from Admin.** On the candidates roster, multi-select plus **Invite selected to their profile**, running the existing `invite-candidate` per person through a bounded batch (rate-limit aware, records `invited_at`, logs to `mu_activity`, skips anyone already claimed). This is the mechanism the Locum send uses.
5. **Job-blast template.** A new recipe in the email kit: role summary, pay, location, shift pattern, a primary CTA to `/hm/<slug>/apply` and a secondary link to `/portal`, both carrying the same per-person claim token.
6. **Apply gate.** `/hm/:slug/apply` requires a session. Signed-out visitors see the account step first with the destination remembered, then the pre-filled form.
7. **Claim tracking and the follow-up.** `mu_people` already holds `invited_at` and `claimed_at`. Add a roster filter for "invited, not claimed" so the second wave and the call list are one click, and record the claim source (job blast, follow-up, self sign-up) on `mu_activity` so we can see which door actually works.


## Not doing

- No separate "candidate registration" for people we already hold. One record per person stays the rule.
- No password-setting email that does not also tell them why. Every claim email carries a reason: this job, or this outstanding document.

## Questions before build

- Should the Locum blast go to the whole candidate list, or only clinical professions with the relevant experience?
- Do you want applications from unclaimed accounts blocked outright, or accepted with a "confirm your profile" chase afterwards?
