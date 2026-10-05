# Email inventory

Every email the platform sends today, who gets it, and what is missing.
Taken from the edge functions on 5 October 2026. Design comes next.

Shell: all branded emails use one shell, `supabase/functions/_shared/kit-email.ts`
(navy masthead, white card, hairlines, one button style). Campaigns use the
block builder (`_shared/email-kit`). Two senders use neither.

## What exists

### Families and clients

| Email | Sent by | When | Notes |
|---|---|---|---|
| What happens next (care enquiry reply, guide attached) | `send-enquiry-reply` | After a care request | The one families get first. Plain, text heavy |
| A few questions before your visit (pre-assessment link) | `care-token-send` | Staff send the pre-assessment | Also the "additional questions" version for a top-up |
| Open your care record (portal invitation) | `care-portal-invite` | Staff give portal access | |
| Sign-in link | Supabase Auth (default template) | Family confirms the invitation email | **Unbranded Supabase default** |
| Invoice | `send-invoice-email` | Staff send an invoice | |
| Campaigns and newsletters | `send-campaign` | Admin campaigns | Block builder, its own look |

### Candidates and staff

| Email | Sent by | When |
|---|---|---|
| Confirmation code | `candidate-verify` | Sign up and sign in |
| Open your profile | `candidate-claim` | Claiming an imported profile |
| Your candidate profile is ready | `invite-candidate` | Staff invite someone in the Talent Pool |
| Your profile is now open, sign in again | `notify-relink` | Account relinked |
| We need your (detail) | `request-candidate-detail` | Staff ask for one missing detail |
| Documents requested | `request-candidate-documents` | Staff ask for documents |
| Document accepted or rejected | `notify-candidate-document` | Staff review a document |
| Offer or role update | `notify-candidate-offer` | Staff make an offer |
| Follow-up nudge | `send-followup-nudge` | Profile left incomplete |
| Interview invitation, application update | `send-candidate-email` | Staff email from a template | **Not on the shell** (raw template) |
| Your offer of employment, your countersigned contract | `send-contract-email` | Contract issued, countersigned |
| New story on The Bridge | `notify-new-post` | Post published |

### Staff (internal)

| Email | Sent by |
|---|---|
| Admin security code | `admin-otp` |
| Reset your admin password | `admin-password-reset` |
| You are invited to Admin | `invite-admin` |
| Your Admin Centre access | `notify-admin-access` |
| Intake health alerts | `send-admin-alert` |
| New enquiry, creator application, job application | `send-form-notification` |
| Test send | `send-kit-test` |

## What is missing

Families, in journey order:

1. **Request received**, for every request (today only the enquiry reply, which depends on the service line having a reply set up).
2. **Assessment booked**: date, time, who is coming, what to have ready, the ₦35,000 fee.
3. **Assessment reminder**, the day before.
4. **Your proposal is ready**, with a link into the family pages.
5. **Your quote**, if it is sent apart from the invoice.
6. **Payment received** (receipt).
7. **Care is starting**: start date and the carer introduction (the carer ID card).
8. **Carer change**, when a replacement is sent.
9. **Weekly or monthly update**, for families abroad.
10. **Plan review due**.
11. **How are we doing?** (feedback).
12. **Payer emails**: invoice to an organisation's billing contact, and its receipt.

Candidates and staff:

1. **Application received**, when someone joins the network or applies to a role.
2. **Interview reminder**.
3. **Assessment visit assigned**, to the assessor.
4. **First placement details**: where, when, who to ask for.

System:

1. **Branded Supabase sign-in email** (magic link) and password reset.
2. **Interview invitation and application update** moved onto the shell.

## Design, 5 October 2026

The shell (`_shared/kit-email.ts`) now follows the site: one square card with a
navy edge and a blue offset, a navy masthead with a white tag eyebrow, a heavy
title with one word on a blue swipe (`accent`), an optional character or object
(`art`, from `KIT_ART`), the four-colour stripe, heavy navy rules between
sections (`kitSubhead`), numbered steps (`kitSteps`) and square buttons.

Images are served from `public/email-kit/` on the live site. Before this the
shell pointed at `/email-kit/medicconnect-logo-white.png` but no such file was
in the repo, so the logo will only show once this branch is deployed.

Redesigned so far: the care enquiry reply. The other emails pick up the new
shell as they are; each gets its own art and copy pass next.
