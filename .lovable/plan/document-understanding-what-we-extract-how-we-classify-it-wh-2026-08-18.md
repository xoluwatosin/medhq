# Document Understanding: what we extract, how we classify it, what we ask for next

Before any code, this is the contract. It covers CVs and every other document, the corpus behind it, and the rule that turns an extraction into a request to the candidate.

## Why now (what the data says)

- 404 documents on file: 298 CV, 63 "Other", 25 Certificate, 17 Licence, 1 ID. Only 4 have ever been accepted.
- The "Other" bucket is not other. Reading the filenames, it holds NMCN licences, BNSc degree certificates, BLS certificates, NYSC certificates, cover letters and at least two CVs. Classification today is a filename regex run at upload, and the intake forms label everything "Any Other Relevant Documentation", so the regex has nothing to bite on.
- Only CVs are read. A licence PDF with an expiry date printed on it sits unread, so the system still asks the candidate for a licence expiry it is already holding.
- The pool is 279 people, 229 of them nurses or midwives. The corpus can be deep for nursing and thin elsewhere without hurting coverage.

## 1. Document taxonomy

Replacing the current 6 labels with 14 types, grouped:

| Group | Types |
| --- | --- |
| Identity | national_id, passport, drivers_licence, birth_certificate |
| Practice | practising_licence, registration_certificate (lifetime council cert, no expiry) |
| Education | degree_certificate, diploma_certificate, transcript |
| Training | training_certificate (BLS, ACLS, infection control, safeguarding, manual handling...) |
| Service | nysc_certificate, nysc_exemption |
| Employment | cv, reference_letter, employment_letter, payslip |
| Unclassified | unreadable, not_a_document |

`Other` disappears as a destination. Anything the classifier cannot place lands in a review queue, never in a silent bucket.

## 2. Classification: content first, filename last

Three signals, in order:
1. **Content** — first page text or the page image goes to the model, which returns one type from the list above plus a confidence and a verbatim quote (e.g. "Nursing and Midwifery Council of Nigeria").
2. **Filename and label** — the current regex, kept only as a tiebreak and as a cheap pre-pass.
3. **Slot** — what the candidate was asked for when they uploaded it (document requests already carry a doc_type).

Confidence >= 0.8 with agreement from at least one other signal classifies automatically. Anything below goes to an admin one-click confirm. Classification is never verification: a document classified as a licence is still `documented`, not `verified`, until a human passes it.

## 3. What each type yields

Every extracted value carries `{ value, confidence, evidence quote, page }`. Never infer. No quote, no value.

- **practising_licence**: council (NMCN/MDCN/PCN/MLSCN/MRTB/RRBN...), registration number, holder name, qualification cited, issue date, **expiry date**, licence type (RN/RM/RPHN...), status wording.
- **registration_certificate**: council, registration number, holder name, date of registration, register category. No expiry — this is where "Registered Nurse (Valid Licence)" belongs, and it is why that string kept polluting certifications.
- **degree/diploma_certificate**: award title, discipline, institution, awarding body, class/grade, award date, country.
- **transcript**: institution, programme, completion date, subjects (stored as a list, not promoted).
- **training_certificate**: course name normalised onto the training corpus (see §4), issuer, issue date, expiry or validity period, certificate number.
- **nysc_certificate / exemption**: call-up or certificate number, service year, state of deployment, place of primary assignment, completion date.
- **identity types**: document number (stored, never displayed in full), full name, date of birth, sex, nationality, issue and expiry date.
- **reference/employment letter**: employer, referee name and role, job title held, dates of employment, contactable yes/no.
- **payslip**: employer, role, pay period. Used only to corroborate an employment claim.
- **cv**: unchanged from today's full extraction (identity, employment history, qualifications, licensing, certifications, capability, facets).

Cross-document reconciliation: name, date of birth, council number and employment dates are compared across documents. A disagreement opens a `mu_field_conflicts` row rather than overwriting.

## 4. The corpus (deterministic, seeded from our own data)

A model normalises text onto the corpus; it never invents an entry. Five reference tables:

1. **Licensing bodies** — every Nigerian council with its abbreviation, spelling variants, the professions it licenses, the shape of its registration number, and whether its licence expires. This is what lets us say "an NMCN licence expires, a council registration certificate does not", and stop asking nurses for an expiry that does not exist on the paper they hold.
2. **Institutions** — Nigerian schools of nursing, colleges of health technology and universities, with variants, so "UNIBEN", "University of Benin" and "Uniben, Edo" collapse to one row.
3. **Award catalogue** — BNSc, RN, RM, RPHN, ND, HND, MBBS, B.Pharm and the rest, each mapped to the profession it evidences and the seniority it implies.
4. **Training catalogue** — BLS, ACLS, PALS, NRP, IPC, safeguarding, manual handling, medication administration and the long tail we already hold, each with its usual issuer, its usual validity period (BLS two years, and so on) and the skill facets it evidences.
5. **Specialism and skill lexicon** — the existing 22 specialties / 12 settings / 28 skills, each gaining a phrase list mined from the 4,142 facets already parsed, so recognition stops depending on a model recalling the code.

### Widening the lexicon against industry standards

Our own data teaches the phrases people actually write; published standards give the vocabulary depth and a shared spine. Each lexicon row therefore carries optional external references, and the vocabulary itself grows from these sources:

- **NMCN and MDCN curricula and register categories** (Nigeria) — the authoritative list of register types (RN, RM, RPHN, RNT, peri-operative, accident and emergency, ophthalmic, orthopaedic, psychiatric, paediatric, critical care, renal, oncology, burns and plastic, cardiothoracic) and the post-basic programmes behind them. This alone widens specialties well beyond the current 22 and matches what Nigerian licences and certificates actually print.
- **Skills for Care / Care Certificate standards (UK)** — the 15 standards, plus the domiciliary and care-home task vocabulary (personal care, moving and handling, medication support, dementia, end of life, learning disability, autism, PEG feeding, catheter and stoma care). This maps directly onto our home-care demand and onto the work-preference options candidates already choose from.
- **CQC and NMC framework language** — safeguarding adults and children, duty of candour, infection prevention and control, mental capacity, DoLS. Useful because families and diaspora buyers use these words.
- **SNOMED CT and ICNP** — clinical procedure and nursing-intervention concepts, used as a reference code on skills rather than as our primary vocabulary, so a skill can later be exported or mapped without rework.
- **WHO ICD-11 chapter headings and WHO health-workforce (ISCO-08) occupation codes** — a stable backbone for patient groups and for occupation classification, which also gives every profession an internationally recognised code.
- **RCN and specialty college specialty lists** — for the long tail: infection control, tissue viability, diabetes specialist, stoma care, respiratory, epilepsy, palliative.
- **Nigerian NYSC, HEFAMAA and hospital nomenclature** — teaching hospital, federal medical centre, general hospital, primary health centre, PHC ward, so employer and setting recognition stops failing on local names.

Practically this takes the vocabulary from 22 specialties, 12 settings and 28 skills to roughly 45 specialties, 20 settings and 90 skills, plus a patient-group axis (older adults, dementia, palliative, paediatric, neonatal, maternity, learning disability, autism, mental health, post-surgical, stroke and neuro rehab, dialysis, oncology, chronic disease, bariatric, wheelchair user, bed-bound). Every existing code is kept; nothing already parsed is invalidated. Each new code ships with its phrase list, and a code with no phrases cannot be matched.

Governance stays the same: any code the model returns that is not in the table is discarded, the vocabulary lives in one place shared by app and edge functions, and additions are an admin action with an audit trail.

Seeding is from real recurrence in our own documents plus the published sources above, reviewed by an admin before it goes live. Every corpus row is editable in admin, and each carries an "added by" trail. Where a source is licensed rather than open (SNOMED CT in particular), we store only the reference code we are entitled to use and never redistribute the source content.


## 5. Profession and specialism stay logic, not model

Unchanged rule: the model reports words, the taxonomy decides. Extended so evidence can now decide too:

- An NMCN RN licence plus a BNSc certificate resolves the profession deterministically, ranked **above** a CV claim and below an admin decision. Precedence becomes: admin > verified document > candidate stated > CV parsed > unresolved.
- Specialisms are only asserted from a document when the corpus phrase list matches; otherwise they stay a candidate-confirmed question.
- Anything ambiguous (two professions evidenced, a licence in a name that does not match the profile) is flagged, not guessed.

## 6. What the system asks for next

The gap engine already derives what is missing from the profile. It gains a document dimension, computed live:

- Required set is derived from profession plus the corpus: a nurse needs CV, ID, degree/diploma certificate, council registration and a current practising licence; a care assistant needs CV, ID and a reference; NYSC only where the profession and age band expect it.
- A field stops being asked the moment a classified document supplies it. Licence expiry read off a licence is no longer a portal question.
- A field starts being asked when a document supplies it badly: a licence that expires in under 60 days becomes a renewal request; an unreadable scan becomes "send a clearer copy" rather than a silent failure.
- Requests are written to `mu_document_requests`, which already syncs admin and portal, so nothing new appears on the candidate side except better wording.

## 7. Confidence and promotion

Unchanged where it works. Scalars land in `mu_parsed_fields` at `pending`; promotion only fills blanks; >= 0.85 auto-promotes, below that goes to the review queue. New rule: a value read from a **verified** identity or licence document may overwrite a self-declared value, because paper beats a form field, and the overwrite is logged with its evidence quote.

## Technical shape

- One table `mu_document_extractions` (document_id, doc_type, model, extraction jsonb, quality jsonb, confidence, created_at), mirroring `mu_cv_parses` so the CV path is unchanged.
- Corpus tables: `mu_licensing_bodies`, `mu_institutions`, `mu_awards`, `mu_training_catalogue`, `mu_lexicon_phrases`.
- One edge function `parse-document`, classifier plus per-type schema, sharing the download, chunking and Claude/gateway fallback code already in `parse-cv`. `parse-cv` keeps its own schema and is called by the classifier when the type is `cv`.
- Queue and rolling re-parse reuse the existing `pg_cron` + `pg_net` pattern.
- `docTypeOf` in `src/lib/match-universe.ts` stays as the cheap pre-pass and is remapped onto the 14 types.

## Sequence

1. Corpus tables seeded and reviewable in admin.
2. Classifier over the 404 documents we already hold, results into the review queue.
3. Per-type extraction for licence, registration certificate, degree certificate, training certificate, NYSC, ID (the six that clear the most gaps).
4. Gap engine reads extractions; requests rewritten.
5. Reference letters, employment letters, payslips.

## 8. Fixing the wall of questions in the candidate profile

Today the portal shows the candidate every parsed field awaiting a decision. Across the pool that is 2,046 pending and 857 queried rows, so a nurse can log in to dozens of "is this right?" prompts, most of them about things that do not affect whether we can place her. That is why claim rates are low. The rewrite:

**Ask far less.**
- Stop asking about anything that is a facet rather than a fact: specialisms (243 rows), clinical skills (242), certifications (220), education (248), employer (248), current position (242). These enrich matching, they never block it. They are shown as an editable summary, not as questions.
- Auto-accept high confidence. Fields at >= 0.85 with a verbatim quote settle themselves; only the low-confidence ones surface. On today's data that leaves LGA (avg 0.54) and a short tail, not a wall.
- Never ask for what a document already answers. Once §3 is live, licence body, number and expiry come off the paper.
- Never ask twice. One question per fact, whatever route or document raised it; duplicates collapse.

**Ask better.**
- One screen, not a list: a short "Does this look right about you?" card with the profile as we hold it. Yes confirms everything in one tap; edit opens only the field they touched.
- Anything still outstanding is ranked by consequence and capped at three at a time: what stops you being matched, then what stops you being verified, then the rest. A progress line says what each answer unlocks.
- Every question carries the quote it came from, so the candidate sees why we are asking.
- Anything the candidate cannot answer gets "I do not know" or "not applicable", which routes to admin instead of sitting unanswered forever.

**Clear the backlog before the new flow ships**, so nobody logs into the old pile: bulk auto-accept the high-confidence, non-blocking rows; retire the facet fields from the queue; leave only genuine blockers behind.

## Answers recorded

1. A verified document overwrites a self-declared value. The overwrite is logged with its evidence quote, and the old value is kept on the activity trail. *Note of concern: OCR on a poor scan can be confidently wrong, so overwrites are limited to fields read at high confidence from a document an admin has already passed, and any overwrite that contradicts a candidate's explicit answer also raises an admin flag.*
2. NYSC is asked of everyone, with "not applicable" as a first-class answer.
3. Identity document numbers are stored in full.

