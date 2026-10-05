# Care and family: the untangled model

Revision 1, 5 October 2026. Investigation and proposal. It refines
`account-model.md` (Revision 2), whose rules on access, bases and scopes all
stand. What changes is how people, households, care records and
relationships are stored, so each fact lives in one place.

Everything under "What is tangled" was checked against the live database
and the code on 5 October 2026.

---

## 1. The problem in one paragraph

A family enquiring about care involves several humans: the person who will
receive care, the person arranging it, maybe a payer abroad, maybe another
relative who should be kept informed. Today each of those humans can be
stored three or four times, in different tables, with different copies of
their name, phone and address, and with roles and relationships recorded in
up to four places that can disagree. The rules for who may see what are
sound. The records underneath them are not yet tidy enough to hold those
rules safely once families start signing in.

## 2. What is tangled

### T1. The person receiving care often isn't a person

The `clients` row is the person receiving care, but it has no link to a
person record. The link exists only through a care request recipient.

| Fact | Count |
|---|---|
| Care records (`clients`) | 14 |
| Care records reached by a care request | 10 |
| Of those, recipients with no person record | 6 |

So most people receiving care can't be a member of their own household,
can't hold a relationship, and can't be given a sign-in for themselves.
Their name, date of birth and sex live on `clients`, while everyone else's
live on `care_people`.

### T2. The same human is stored several times

- Every contact is stored twice: `client_contacts` carries its own copy of
  name, phone, WhatsApp and email, and also points at a `care_people` row
  that carries the same fields again.
- Household members are listed once per role. The enquirer who is also the
  contact appears twice in `care_group_members` (roles `contact` and
  `enquirer`). All three households with members show this.
- Repeat enquiries create new people and new care records. One email
  address is on 3 person rows and another on 2. Two households and two care
  records share the same name. Most of these are test records, but the
  routing has no step that offers an existing person or household.

### T3. Three addresses

The care record (`clients`), the household (`care_groups`) and the request
recipient each hold an address. In 2 of 10 records the care record and
household addresses already differ, and nothing says which one the carer
should go to.

### T4. One relationship question, four wordings, two directions

| Where it is asked | Wording | Direction |
|---|---|---|
| Public care request form | "Relationship to you" | the person receiving care, to the enquirer |
| Pre-assessment | "Relationship to the person receiving care" | the contact, to the person receiving care |
| Admin, add a client | "Relationship to the client" | the contact, to the client |
| Admin, household tab | relationship terms | either, as chosen |

The answer from the public form is stored in `client_contacts.relationship`
and shown on the care record next to the contact's name. So a son arranging
care for his mother answers "Mother" for her, and the care record then reads
"Mother: [son's name]". The household tab, built by migration 0109, reads
the same word the right way round. The care record and the household tab
can contradict each other on the same family.

There are also two relationship vocabularies: `care_relationship_terms`
(38 terms, for contacts) and `care_group_relationship_terms` (14 terms, for
people).

### T5. Roles in five places

| Role | Recorded in |
|---|---|
| Primary contact | `client_contacts.is_primary` |
| Enquirer | `client_contacts.is_enquirer`, `care_requests.enquirer_person_id` (empty on 6 of 9 requests), `care_group_members.role = enquirer` |
| Payer | `client_commercial.payer_person_id` |
| Authority to act | `client_contacts.may_act_for_client`, `authority_basis`, `authority_evidence_sighted` (old), and `care_access_bases` (ratified) |
| Household member | `care_group_members.role` |

Authority is the dangerous one. The old contact flags and the ratified
access bases both describe who may act for the client. Neither is used yet
(0 rows each), so this can be settled now at no cost.

### T6. Access tokens know too much

A care access token can point at a client, a contact, a person, a request,
a request recipient, a questionnaire session, a document, an onboarding
link and a parent token. That is ten ways for a link to be tied to the
record, which makes it hard to say exactly what a link opens.

### T7. Test data sits in the live tables

Several care records and households are tests ("Test", "Test child Test",
repeat "Olúwatósìn" records). They need clearing before families sign in,
so counts, chases and stages reflect real work.

---

## 3. The untangled model

Five things, each stored once.

```text
Person ──────────── a human. Name, contact details, date of birth, sign-in.
  │                 Every human on the care side, including the person
  │                 receiving care. Never merged by email.
  │
Household ───────── people who live or arrange care together, and the home
  │                 address. Membership only, no roles.
  │
Relationship ────── person to person, one direction, one vocabulary, with
  │                 the inverse recorded alongside.
  │
Care record ─────── one person receiving care, and the service relationship
  │                 with Medic Connect: stage, requests, assessments, plans,
  │                 packages. Points at its Person. Holds a care address
  │                 only when care happens away from the household address.
  │
Roles on a record ─ per care record, per person: primary contact, enquirer,
                    payer, emergency contact. Facts about operations, not
                    authority.

Access (unchanged from account-model.md): grants and bases decide what a
person may see. Nothing above grants anything.
```

### The rules

1. **Every care record has a person.** `clients.person_id`, required.
   Identity fields (name, date of birth, sex) live on the person. The care
   record keeps only care facts.
2. **A human is entered once.** Intake and the admin offer matching people
   and households (by phone, email and name together) for staff to confirm.
   Nothing merges automatically; shared family emails stay legal.
3. **One address for the home.** The household holds it. A care record
   holds a care address only when care is delivered somewhere else, and
   then that one wins for carers.
4. **Relationships are asked as a sentence with both names.**
   "Tobi is Bukayo's ___ ." The answer is stored from the first person to
   the second, the inverse is stored with it, and every screen reads the
   same table. One vocabulary.
5. **Roles are per care record.** One row per person per care record, with
   flags for primary contact, enquirer, payer and emergency contact. Exactly
   one primary contact. The enquirer is always set.
6. **Authority lives only in access bases.** The old contact authority
   fields are retired.
7. **A link opens one thing.** A token is either a form link (one
   questionnaire session for one person) or a portal invitation (one grant).
   The other pointers are derived, not stored.
8. **Membership carries no role.** A household member is just a member.
   Roles belong to care records; relationships belong to people.

### How the awkward cases land

| Case | Model |
|---|---|
| Caring for yourself | One person; care record points at them; they hold every role; access by `self_identity` |
| A parent arranging care for a child | Two people in one household; relationship "Ada is Tolu's mother"; mother holds the roles; access by `guardian_authority` |
| A son arranging care for his mother | Two people; "Tobi is Bukayo's son"; son holds enquirer and primary contact; access by the mother's consent |
| A sponsor abroad who only pays | A person outside the household; payer role on the care record; finance-only grant |
| Twins, or two parents both receiving care | One household, two care records, each pointing at its own person; one request can cover both |
| The same family enquires again a year later | Staff confirm the existing household and person; a new request on the existing care record |
| A relative who is also a Medic Connect carer | Separate care-side and professional records, one sign-in (account-model.md 2.2) |

---

## 4. Getting there

Additive steps first, then retire the old columns once nothing reads them.
Real data is small (14 care records, 17 people, 13 contacts), so each step
can be checked row by row.

| Step | Change | Data work |
|---|---|---|
| 1 | Clear the test records | Staff list which records are tests; delete them with their links |
| 2 | Every care record gets a person | Create the missing person rows from the care record; add `clients.person_id`, then make it required |
| 3 | One relationship direction | Re-read the three intake answers in the direction the form asked; move contact relationships into person relationships; one vocabulary; the care record reads the household table |
| 4 | Roles per care record | Contact rows stop storing copies of name and phone and read the person; add payer and emergency contact flags; backfill the enquirer on the 6 requests missing it |
| 5 | Authority in one place | Retire the old contact authority fields (unused) |
| 6 | One home address | Household address is the home; move differing care-record addresses into a care address only where they really differ (2 records to check) |
| 7 | Membership without roles | One member row per person per household |
| 8 | Matching at intake | Offer existing people and households for staff to confirm; a merge function for care-side duplicates like the talent one |
| 9 | Tokens open one thing | New links reference a session or a grant only; old links keep working until they expire |

Steps 1 to 5 should land before the family portal (Tranche 10) and before
care packages (Tranche 8), because both read roles and relationships.

---

## 5. Decisions needed

1. **Relationship wording.** Ask it as a sentence with both names, stored in
   one direction. Recommended.
2. **Repeat enquiries.** A returning family joins its existing household and
   care record, after staff confirm. Recommended.
3. **Organisation payers.** Some care will be paid by an employer, insurer
   or church rather than a person. The model has no organisation yet. Should
   a payer be able to be an organisation?
4. **Which records are tests.** Staff need to mark them so step 1 can run.
