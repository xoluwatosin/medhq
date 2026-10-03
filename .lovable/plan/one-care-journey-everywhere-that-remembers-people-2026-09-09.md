# One care journey, everywhere, that remembers people

Right now there are three different-looking forms: the welcome pop-up, the WhatsApp widget, and Request care. Only Request care files a clean enquiry with a service line. This makes the other two match it, connects service page buttons to it with the service already chosen, and gives the site a memory of who someone is and what they came for.

## 1. A shared look

Pull the Request care shell into reusable pieces: the navy cap, the segmented progress, the question heading and helper line, the choice card, the quiet field caption, and the footer with Back and Continue. All three forms are built from these, so they read as one family.

## 2. The welcome pop-up, optimised

Today it asks name, email, phone, an interest, and a free note, then drops the person at a page. It is long for a first greeting and its answers arrive as loose text.

New version, three light screens in the Request care style:

1. What brings you here today? Choice cards, the same care kinds as Request care plus "Just looking around".
2. Who may we call you? Name and WhatsApp number, with the country code picker.
3. Would you like a care adviser to reach out? Yes takes them straight into the Request care journey with what they have already given carried over, so nothing is asked twice. No thanks closes politely and takes them to the page for the care they picked.

Only a completed Yes files an enquiry, so the desk stops filling with half-formed intake rows. What they picked is remembered either way.

## 3. The WhatsApp widget

Stays short: name, WhatsApp number, what kind of care, anything else. Restyled with the same shell, and the care options become the same named care kinds rather than free text, so a WhatsApp lead lands under the right service line instead of a `WhatsApp: ...` string. Ends as it does now, opening WhatsApp with the message written out.

## 4. Service pages ask, then fill in

On a service page, Request care opens on a confirmation screen: "You are on our eldercare page. Are you requesting eldercare?"

- Yes: the service is set, the who-needs-care and kind-of-care questions are skipped, and the chosen service shows as a chip they can change at any point.
- No, something else: the full journey runs as normal.

Buttons updated to open this instead of pointing at the contact page:

- Hero "Book a consultation" on every care service page.
- The service page CTA band, which already opens Request care, gains the confirmation.
- Contact page keeps its form and gains the same Request care action.
- Facility pages (hospital staffing, hospital support, for facilities) keep their enquiry routes unchanged, as they are a different conversation.

## 5. Remembering people

One visitor record held on their own device: name, country code and number, email, consent, the services they have shown interest in with dates, and whether they have already sent a request.

What it changes:

- Returning visitors are greeted by name, and the welcome pop-up does not reappear.
- Request care skips the contact questions it already knows, showing a short "Still Adaeze on +234 812 345 6789?" line with an edit option, so a repeat request is three taps.
- If they viewed eldercare last week and open the form on the postnatal page, the confirmation names the page they are on, and their earlier interests ride along with the enquiry.
- The WhatsApp widget prefills the same way.

Every interest, whichever door it came from, is also tracked as an event so the enquiry desk and analytics can see which services pull people in and which ones they abandon.

# Technical notes

- New `src/components/request/` module: `RequestShell.tsx` (dialog, navy cap, progress, footer), `Choice.tsx`, `FieldLabel.tsx`, `DialCodeField.tsx`, and `care-kinds.ts` holding `CARE_KINDS`, `WHO_LABEL`, `SOON_OPTIONS` and the route to service-line map currently duplicated in `CTASection.tsx`.
- `CareRequestDialog.tsx` refactored onto the shell; step list becomes dynamic so a confirmed service line removes steps 5 and 6, and known contact details remove steps 0 to 3. Progress counts the steps actually shown.
- `WelcomeIntake.tsx` and `WhatsAppQuestionnaire.tsx` rebuilt on the shell. The welcome pop-up hands off by opening `CareRequestDialog` in controlled mode with a `prefill` prop. The WhatsApp widget switches its insert to `submitCareRequest` with a real `serviceLineKey`, source `whatsapp_widget`.
- Visitor memory: `src/lib/visitor.ts` with a versioned `mc_visitor_v2` record (`name`, `dial`, `phone`, `email`, `consent`, `interests: {line, at}[]`, `lastRequestAt`), read and write helpers, and migration from the existing `mc_visitor_v1` and `mc_wa_lead_v1` keys. Purely client-side, no schema change.
- Tracking: extend `src/lib/measurement.ts` with `trackServiceInterest(line, source)`, fired on service page view, on pop-up choice, and on care-kind selection. Existing `trackCareRequest` unchanged.
- Enquiry payload gains `answers.prior_interests` and `answers.confirmed_from_page`; `contact_submissions` already stores `answers` as jsonb, so no migration.
- Service page edits are limited to swapping the hero consultation link for a `CareRequestDialog` trigger with `serviceLineKey`: Eldercare, PostnatalCare, AntenatalCare, PostSurgicalCare, ClinicalHomeCare, PediatricCare, NannyChildcare, CareFromAbroad, CareAtHome, NeighbourhoodCare, AgencyVsPrivateNurse.
