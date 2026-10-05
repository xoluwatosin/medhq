# Care and family: the untangled model

Revision 1, 5 October 2026. Investigation and proposal. It refines
`account-model.md` (Revision 2), whose rules on access, bases and scopes all
stand. What changes is how people, families, homes, care records and
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
Family ──────────── the people who arrange care together, wherever they
  │                 live. Membership only, no roles, no address.
  │
Home ────────────── an address. A family can have several (a son in London,
  │                 his mother in Lagos; parents who live apart). Care
  │                 records under one roof share one.
  │
Care record ─────── one person receiving care, and the service relationship
  │                 with Medic Connect: stage, requests, assessments, plans,
  │                 packages. Points at its Person and at the Home where care
  │                 happens, which is the address carers go to.
  │
Contacts on a ──── per care record, per person: their relationship to the
record              service user (the clinical convention, "Tobi Belewu,
                    Mother"), and flags for primary contact, next of kin,
                    enquirer, payer and emergency contact. Facts about
                    operations, not authority.

Access (unchanged from account-model.md): grants and bases decide what a
person may see. Nothing above grants anything.
```

### The rules

1. **Every care record has a person.** `clients.person_id`, required.
   Identity fields (name, date of birth, sex) live on the person. The care
   record keeps only care facts.
2. **A human is entered once.** Intake and the admin offer matching people
   and families (by phone, email and name together) for staff to confirm.
   Nothing merges automatically; shared family emails stay legal.
3. **An address belongs to a home, not a family.** A care record points at
   the home where care happens. Records under one roof share the home, so
   the address is entered once and a change reaches all of them. Someone who
   moves out gets a home of their own. Contacts and payers can live
   anywhere; their addresses never decide where carers go.
4. **A relationship is always the contact's relationship to the service
   user**, the clinical convention: "Tobi Belewu, Mother". It is stored on
   the contact row of that care record, from one vocabulary of terms that
   describe the contact (Mother, Son, Spouse, Guardian, Friend, Employer).
   Every form asks it the same way, as "[Name]'s relationship to [service
   user]". Because it hangs off the care record, two service users in one
   family never clash: on Bukayo's record Tobi is "Mother"; on Tobi's record
   Bukayo is "Son". The family view of who is related to whom is read
   from these rows, not stored separately.
5. **Roles are per care record.** One row per person per care record, with
   flags for primary contact, enquirer, payer and emergency contact. Exactly
   one primary contact. The enquirer is always set.
6. **Authority lives only in access bases.** The old contact authority
   fields are retired.
7. **A link opens one thing.** A token is either a form link (one
   questionnaire session for one person) or a portal invitation (one grant).
   The other pointers are derived, not stored.
8. **Membership carries no role.** A family member is just a member.
   Roles and relationships belong to care records.

### How the awkward cases land

| Case | Model |
|---|---|
| Caring for yourself | One person; care record points at them; they hold every role; access by `self_identity` |
| A parent arranging care for a child | Two people in one family; on the child's record the parent is "Mother"; she holds the contact roles; access by `guardian_authority` |
| A son arranging care for his mother | Two people; on the mother's record the son is "Son"; he holds enquirer and primary contact; access by the mother's consent |
| A sponsor abroad who only pays | A person outside the family; payer role on the care record; finance-only grant |
| Two people in one family both receiving care, such as a mother and her son | One family, two care records, each pointing at its own person; on the son's record the mother is "Mother", on the mother's record the son is "Son"; one request can cover both; living together, the two records share one home; each sees only their own record unless the other consents |
| A daughter arranges care for both parents, who live apart | One family, two care records, two homes; a change to one address never touches the other |
| A son abroad arranges care for his mother in Lagos | One family; one home, hers; his own address stays on his person record and never reaches a carer |
| The same family enquires again a year later | Staff confirm the existing family and person; a new request on the existing care record |
| A relative who is also a Medic Connect carer | Separate care-side and professional records, one sign-in (account-model.md 2.2) |
| An employer or HMO pays for an employee's care | The organisation is the payer; its billing contact gets finance access only |
| A husband and wife both receive care and want their own privacy | Two care records marked independent; nothing on one shows on the other (section 3.2) |

### 3.1 Payers: a person or an organisation

A payer can be a person or an organisation (agreed 5 October 2026).

```text
Organisation ────── an employer, HMO or insurer, church or mosque, NGO,
  │                 government body or other. Name, kind, billing address,
  │                 billing email. Its people are Persons with a role in it
  │                 (billing contact, approver).
  │
Payer arrangement ─ on a care record: one or more payers, each a Person or
                    an Organisation, each with a share (a percentage, or
                    named invoice lines). The usual case is one payer at 100%.
```

Rules:

1. **A payer is exactly one of a person or an organisation.** Never both,
   never neither.
2. **Shares add up to the whole.** An HMO paying 70% and the family 30%
   gives two payers; each invoice goes to one payer for their share.
3. **Paying gives finance access only.** An organisation's billing contact
   gets a finance grant backed by a `finance_participant` basis. They never
   see clinical detail by default.
4. **Reports to an organisation are a separate consent.** An employer asking
   for attendance, or an HMO asking for a care summary, needs the service
   user's recorded consent for that disclosure, scoped and revocable.
5. **Invoices snapshot the payer** they were raised to, so a change of payer
   never rewrites an old invoice.

### 3.2 Independent records within a family

Some families want each person's care kept apart: a husband and wife who
each want privacy, an adult child who doesn't want a parent to see their
care, a teenager's confidential care, or relatives who don't get on. The
model already keeps records apart by default, because every view is decided
by a grant on one care record. What has to be closed off is the shared
things around the records, where one person's care could leak to another.

A care record can be marked **independent**. Then:

| Shared thing | Independent rule |
|---|---|
| Family | The record can sit in a family for the office's logistics, but no family-side screen shows the family or its other members |
| Requests and agreements | Never a joint request or a joint agreement with another record |
| Invoices | One invoice per record. A payer covering two people gets two invoices, not one combined bill, unless both service users consent |
| Visits | A carer visiting the same house records against each record separately and sees only the records they are assigned to |
| Notes, notifications, documents | Addressed to one record only; never a family message |
| Contacts | A relative can be an emergency contact on the record without seeing anything |
| Office view | Staff still see the link, marked "Independent: do not discuss across records" |

Two layers, so the common case stays simple:

- **Clinical detail is always private to each person.** Plans, notes,
  observations and documents on one record are never shown to another
  family member without a grant backed by a recorded basis. This holds for
  every family, independent or not; being family or paying confers no right
  to it.
- **Logistics are shared by default.** Most families arrange care together:
  one family, one request covering several people, one combined invoice
  to the same payer, one carer visit for the house.
- **Independent is opt-in.** When a family member asks for their care to be
  kept apart, staff mark that record independent and the rules in the table
  above apply to it. Intake asks one plain question when a request covers
  more than one person: "Should we arrange care for Tolu and Ada together, or
  keep each person's care separate?"

---

## 4. Getting there

Additive steps first, then retire the old columns once nothing reads them.
Real data is small (14 care records, 17 people, 13 contacts), so each step
can be checked row by row.

| Step | Change | Data work |
|---|---|---|
| 1 | Clear the test records | Done in `supabase/migrations/20261005150000_remove_test_care_records.sql`: 10 marked on 5 October, runs at cutover |
| 2 | Every care record gets a person | Done in `supabase/migrations/20261005160000_care_family_steps_2_to_5.sql`, runs at cutover. `clients.person_id` is required; self-enquirers share one person with their contact row (now labelled Self); new records take the person the intake names, and a record added by hand gets its own |
| 3 | One relationship convention | Done, same file. Forms ask "You are Bukayo's…" and "This contact is the client's…"; the family sync records contact to service user with the inverse; Belewu corrected to Mother; any other old answer is listed at cutover for staff, never guessed. Also fixes the public form refusing "for myself" requests (the Self term was missing) |
| 4 | Roles per care record | Partly done, same file: the enquirer is backfilled on every request; contacts gain next of kin and emergency contact flags (no screen yet). Still to do: contact rows stop storing copies of name and phone and read the person; the payer flag moves to step 10 |
| 5 | Authority in one place | Done, same file: the three unused contact authority columns are dropped, guarded by a check that they are empty |
| 6 | Homes, not a family address | Done in `supabase/migrations/20261005170000_care_homes.sql`, runs at cutover. A home table; each care record points at its home; records in one family at the same address share one; family and request-recipient addresses move to care records that had none and stop being stored. The care record keeps its address columns as a mirror of its home, so every form and link keeps working. The care record overview shows who lives there, with "Move in" and "Lives somewhere else". The 2 records that differed were both test records |
| 7 | Membership without roles | One member row per person per family |
| 8 | Matching at intake | Offer existing people and families for staff to confirm; a merge function for care-side duplicates like the talent one |
| 9 | Tokens open one thing | New links reference a session or a grant only; old links keep working until they expire |
| 10 | Organisation payers | Add organisations and their people; a payer arrangement per care record (person or organisation, with shares); move `client_commercial.payer_person_id` into it |
| 11 | Independent records | An independent flag on the care record; enforce the rules in section 3.2 in the family portal, invoices, requests and visit screens; the intake question for multi-person requests |

Steps 1 to 5 should land before the family portal (Tranche 10) and before
care packages (Tranche 8), because both read roles and relationships.
Step 10 must land before recurring invoices (Tranche 11). Step 11 must land
before the family portal and before visits (Tranches 9 and 10).

---

## 5. Decisions needed

1. **Relationship convention.** Always the contact's relationship to the
   service user, asked the same way on every form. Agreed 5 October 2026.
2. **Repeat enquiries.** A returning family joins its existing family and
   care record, after staff confirm. Recommended.
3. **Organisation payers.** A payer can be a person or an organisation.
   Agreed 5 October 2026. Split payment between several payers is
   recommended in section 3.1.
4. **Which records are tests.** Marked by staff on 5 October 2026.
5. **Independent records.** Clinical detail is always private per person;
   logistics are shared by default; a record is marked independent when a
   family member asks. Recommended in section 3.2.
