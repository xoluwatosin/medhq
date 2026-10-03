# Heard consumer experience

Build the finished Heard visitor experience on the routing and data foundation already in place, using the attached element library as the single visual source.

## Visual system

The attachment sets the look: five colours (ink #16132F, violet ink #2C2552, mute #4A4480, pale sky #BFDBF7, bright white #FBFAFF) plus two named tints, Figtree throughout, square corners, no gradients, one accent, generous space, and the infinity mark only ever as a faint watermark.

The current Heard styling is a different palette (blue and serif) and is used by the old prelaunch page, which must not change. So the new look gets its own scope, and the old page keeps the old one.

Elements to build, named as in the attachment:

- Structure: StackFrame (card with an offset pale-sky shadow card), SectionOpener, Divider
- Letters and stories: LetterCard, StoryCard, SealedLetter, Envelope confirmation
- Writing: TextArea, TextField, Choice, Button, TextLink
- Navigation: Header, MobileNavSheet, Pagination ("One more letter")
- States: Notice (confirmed and problem), EmptyState, Skeleton, Modal, SafetyBox, HoursPanel
- Voice: SpeechFragment, EditorialQuote, Footer

Motion follows the attachment and respects reduced motion.

## Pages

All copy comes from your brief, word for word.

- Home: hero "Yapping is so chic." with Be heard, then the four Ways to be heard. Nothing else.
- Write to us: subject, message, email, Send, then "We got it."
- Story Swap: subject, story, sign it as, email, Send, then "Your story is in."
- Letter Room: one approved letter at a time, One more letter, Leave a letter, and the empty state.
- Leave a letter: form, two separate consents (required review and permission, optional receive letters), Preview, then "Before you leave it.", Edit or Leave my letter, then "Left."
- Can you keep a secret: standalone presentation and an offer after leaving a letter, ending "You're in."
- Talk: pre-launch only, email capture, "We'll let you know." No number shown.
- About, Support, Privacy: as written, with the safety language kept to Support.

Navigation carries only Be Heard, Story Swap, Letters, About. Support and Privacy sit in the footer.

## Email layouts

Story Swap and Letter email templates are prepared as layouts only, matching the restrained structure you specified, with no sender email exposed. Actual sending stays for the admin stage.

## Backend

No schema changes. Everything uses what exists:

- Write to us, Story Swap, Leave a letter, letter subscription and phone notifications all go through the existing controlled submission function; the browser never writes to a Heard table.
- The Letter Room reads through the existing safe public-letter path, which returns approved public fields only.
- Required and optional consents are recorded separately with their version.

## Technical notes

- New tokens and element classes live in a Heard-only scope so `/heard` (legacy) and Medic Connect are untouched.
- One route tree, already mounted at `/heard-preview` in preview and at the root on the Heard hostname; all internal links keep the active prefix.
- Wordmark and infinity watermark are extracted from the attachment as project assets.
- Heard pages stay noindex and out of the Medic Connect sitemap.
- Accessibility: labelled fields, errors tied to inputs, visible focus, headings in order, state never signalled by colour alone.

## Checks before reporting

Every preview route opened and refreshed directly, prefix preserved on navigation, Medic Connect routes unchanged, forms exercised on mobile and desktop, anonymous access to Heard tables confirmed blocked, no email or internal field exposed in the Letter Room or Story Swap, typecheck, tests and build green.

## Known gaps to report at the end

- Terms and Conditions link: no Heard legal page exists yet, so it will be a clearly marked internal placeholder pending your URL.
- Privacy: product explanations are included; the full legal notice still needs drafting.
- Moderation, matching and actual email delivery need the Heard admin stage.
