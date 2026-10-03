# Mandatory verification, on-brand emails, and a calmer question list

## On the WhatsApp question first

Yes, but not today. The project already has a WhatsApp sender wired to the WhatsApp Cloud API, and it only works if the WhatsApp access token and phone number ID are in place. More importantly, Meta does not allow a business to start a WhatsApp conversation with free text: a one-time code has to go out on an approved **authentication template**, submitted and approved against the WhatsApp Business Account. Until that template is approved, a WhatsApp code would silently fail for most new candidates.

So the build is: **email code now**, with the WhatsApp channel written behind a switch. The moment the authentication template is approved, the switch flips and WhatsApp becomes the first channel with email as the fallback. No rework.

## 1. Verification becomes compulsory

- Remove "Skip" from the verify screen entirely, and remove the fake timers and fake success. Today the screen accepts any six digits and lets people through, so nobody is actually verified.
- A real six-digit code is generated server-side, stored hashed with a ten-minute expiry, and checked server-side. Five wrong attempts burns the code and a new one must be requested. Resend is rate limited.
- Hard block: until the code is confirmed, every portal route bounces back to the verify screen. The only things reachable are verify, resend, and sign out.
- Existing accounts that were let through unverified are marked unverified and meet the same gate on their next sign-in.

## 2. State and LGA, asked properly

- A short "Finish your profile" step runs immediately after verifying, before the portal opens. It asks state, then LGA (the LGA list is driven by the chosen state), and confirms the profession.
- Never dressed up as a CV finding. For someone with no CV the copy is simply "Tell us where you are based" — the current "We could not find this on your CV" line is wrong and will stop appearing where no CV exists.
- The answer is recorded as candidate-stated and treated as the source of truth for the profile: it writes to the profile record, is used by matching straight away, and is only overridden by verified evidence later.
- Because location arrives at the front door, state and LGA stop appearing in the outstanding-questions list at all for new profiles.

## 3. The question list gets tidied

Replacing the repeated stack of identical yellow notices with one calm, logical block:

- **One card, not a card per question.** A single "What we need from you" card holds the outstanding items as rows. Only the row you are answering opens; the rest stay collapsed to a title and a short status.
- **The reason line appears once**, at the top of the card, in the right words for the situation. No CV on file reads "You have not sent us a CV yet, so we are asking these directly." A CV that missed something reads "Your CV covered most of it. These are the gaps."
- **Attention is shown by highlight, not by repetition.** The card border and the row marker carry the urgency; the per-row banner goes.
- **Dependent questions never show a dead end.** LGA does not appear as its own row with a "tell us your state first" note and a Save button that cannot work. It appears nested under state, and unlocks the instant a state is chosen.
- **Only genuine, answerable requests generate a row.** Anything already answered, anything with no way to answer it on that screen, and anything superseded by a document already accepted, drops out.
- The count in the navy header and the dots in the bottom bar are recomputed from that same tidied list, so the number always matches the rows you can see.

## 4. Emails brought up to the standard

- The sign-up confirmation currently comes from the default template on the auth service. That path is retired: sign-up sends no default email at all. The verification code goes out in a Medic Connect email built from the existing kit shell, and password resets for candidates move onto the same kit.
- Audit and bring the remaining senders onto the kit. Confirmed off-kit today: the candidate bulk email sender, the volunteer sign-up email, the account-admin notices, and the claim/token emails. Each gets the navy masthead, the warm-white page, the white card, and the standard footer, keeping its own words.
- Preview screenshots of each rebuilt email before anything goes out.

## Technical notes

- New `mu_verifications` table (person, channel, hashed code, expiry, attempt count, consumed timestamp) with grants and RLS scoped to the owning user; verification state stored on the person record.
- New `send-verification-code` and `verify-code` edge functions. Code generation and comparison happen only server-side; the client never sees the code.
- Signup switches to auto-confirm on the auth service so no default email is emitted; the app's own code becomes the real gate, enforced in a route guard and mirrored by a database check so an unverified account cannot be shortlisted or accept an offer.
- Channel selection lives in one constant: `email` now, `whatsapp` once the authentication template is approved. `send-whatsapp` is extended to take a template name rather than only the invoice message.
- Portal question assembly moves out of the page into one derivation in `usePortal`, with a dependency map (LGA depends on state) and a source-aware reason string, so home, the nav counts, and the details screen all read the same list.
