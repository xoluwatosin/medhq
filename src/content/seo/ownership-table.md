# Route ownership table

One topic, one owning URL. Every expansion route is registered in `public.seo_pages`
as a candidate and is served but not indexed. A route becomes indexable only when it is
listed in `INDEXABLE_EXPANSION_PATHS` in `src/content/seo/index-policy.ts` after the
decision below is confirmed.

Decisions used:

- **MERGE** — an established page already owns the topic. The route redirects to it.
- **KEEP** — a distinct question with no established owner. Eligible for indexing once reviewed.
- **REFRAME** — overlaps an established page. Must be narrowed to a different question, or merged.
- **HOLD** — no distinct search demand established yet, or the claim base is not settled.

## Approved for indexing (2026-10-04)

Checked against both the established pages and the governed SEO pages. Each answers a
distinct question with no owner, and is listed in `INDEXABLE_EXPANSION_PATHS`:

/wound-dressing-at-home, /blood-sample-collection-at-home, /iv-therapy-at-home,
/injection-at-home, /stoma-care-at-home, /peg-feeding-support-at-home,
/tracheostomy-care-at-home, /ventilator-care-at-home, /medication-administration-at-home,
/diabetic-foot-care-at-home, /medical-escort-services, /home-care-vs-care-home,
/nurse-vs-caregiver, /who-do-i-need-after-surgery, /transport-to-medical-appointments,
/how-to-verify-a-nurse-in-nigeria, /how-to-verify-a-doctor-in-nigeria, /caregiver-cost-in-lagos

## Overlaps with governed pages, not covered by the clusters below

| Route | Competes with | Proposed |
| --- | --- | --- |
| /continence-care-at-home | /catheter-care-at-home | REFRAMED to dignity-led personal care, APPROVED |
| /physiotherapy-after-stroke | /stroke-recovery-at-home, /physiotherapy-at-home | MERGED → /stroke-recovery-at-home |
| /orthopaedic-recovery-at-home | /post-surgical-care, /physiotherapy-at-home | REFRAMED to hip replacement and fractures, APPROVED |
| /ngo-health-programme-implementation, /community-health-outreach-services | /ngo-healthcare-staffing | MERGED |
| /night-nurse-for-newborn | /newborn-care | REFRAMED to overnight only, APPROVED |
| /live-in-nanny | /professional-nanny | REFRAMED to live-in only, APPROVED |
| /live-in-caregiver | /caregiver, /24-hour-nursing-care | REFRAMED to live-in only, APPROVED |
| /managed-postpartum-stay-in-nigeria | /omugwo, /professional-omugwo, /care-from-abroad | MERGED → /professional-omugwo |
| /diabetes-care-at-home | /chronic-care-at-home | APPROVED, links up to the parent |
| /cancer-care-at-home | /palliative-care-at-home | APPROVED, treatment-stage support, links to palliative |

Already indexed pairs that compete with each other: /omugwo and /professional-omugwo,
/nanny-childcare and /professional-nanny, /care-at-home and /caregiver.

## Group four, approved (2026-10-04)

Profession jobs and staffing pages, the maternity and discharge pages, /shadow-teacher,
/stroke-recovery-at-home and /who-should-i-hire-for-a-newborn are approved; each links up to
the page owning the wider topic. /medic-connect-talent-pool now redirects to /careers, which
already owns joining the candidate pool.

## Group three, decided (2026-10-04)

Approved: /autism-support-at-home, /adhd-support-at-home, /speech-therapist-for-children
(speech therapists confirmed as a service), /what-does-a-shadow-teacher-do,
/care-after-hospital-discharge, /high-risk-pregnancy-support-at-home,
/how-medic-connect-home-care-works, /healthcare-facility-management-support (managed
departments confirmed as a service).

Redirected: /school-companion → /shadow-teacher; /additional-needs-childcare,
/early-intervention-support, /behaviour-support → /pediatric-care; /hospital-to-home-care →
/care-after-hospital-discharge; /care-for-elderly-parents → /eldercare;
/blood-sugar-monitoring-at-home → /diabetes-care-at-home; /blood-pressure-monitoring-at-home →
/chronic-care-at-home; /speech-delay-support → /speech-therapist-for-children.

Held: /occupational-therapy-for-children, until supplying occupational therapists is confirmed.

## Competing live pages, resolved (2026-10-04)

| Pair | Decision |
| --- | --- |
| /omugwo and /professional-omugwo | MERGED → /omugwo, the head term; its "managed and documented" line moved across |
| /nanny-childcare and /professional-nanny | MERGED → /nanny-childcare, whose title already targets "professional nanny" |
| /care-at-home and /caregiver | KEPT both: general home care vs hiring a caregiver; /care-at-home now links to /caregiver |

Every merged route is also a permanent (301) redirect in `vercel.json`, so search engines
transfer the old page's standing without running the app. A test keeps the two lists equal.

## Merged now

| Route | Owner | Reason |
| --- | --- | --- |
| /antenatal-care-at-home | /antenatal-care | Same service, same intent |
| /clinical-research-staffing | /clinical-research | Same service, same intent |
| /hospital-support-services | /hospital-support | Same service, same intent |

## Overlap clusters to resolve before indexing

| Cluster | Established owner | Routes to reframe or merge |
| --- | --- | --- |
| Discharge and hospital-to-home | /post-surgical-care | /hospital-to-home-care, /care-after-hospital-discharge, /equipment-needed-after-hospital-discharge, /how-to-prepare-the-home-before-hospital-discharge, /nicu-to-home-support |
| Older people's care | /eldercare | /care-for-elderly-parents, /live-in-caregiver |
| School support | /nanny-childcare | /shadow-teacher, /school-companion, /what-does-a-shadow-teacher-do |
| Speech and development | /pediatric-care | /speech-therapist-for-children, /speech-delay-support, /early-intervention-support, /occupational-therapy-for-children, /behaviour-support, /adhd-support-at-home, /autism-support-at-home, /additional-needs-childcare |
| Pregnancy and birth | /antenatal-care, /postnatal-care | /high-risk-pregnancy-support-at-home, /c-section-recovery-at-home, /breastfeeding-support-at-home, /coming-to-nigeria-after-giving-birth, /managed-postpartum-stay-in-nigeria |
| Newborn care | /postnatal-care | /night-nurse-for-newborn, /who-should-i-hire-for-a-newborn, /live-in-nanny |
| Candidates and careers | /join | /medic-connect-talent-pool and the seven jobs-and-opportunities routes |
| Profession staffing | /hospital-staffing, /for-facilities | /doctor-staffing, /pharmacist-staffing, /laboratory-scientist-staffing, /physiotherapist-staffing, /school-healthcare-staffing, /corporate-healthcare-staffing, /correctional-healthcare-support, /ngo-health-programme-implementation, /healthcare-facility-management-support, /community-health-outreach-services |
| Stroke and rehabilitation | /clinical-home-care | /stroke-recovery-at-home, /physiotherapy-after-stroke, /orthopaedic-recovery-at-home |

## Full route list

| Route | Type | Decision |
| --- | --- | --- |
| /autism-support-at-home | Childcare service | REFRAME |
| /shadow-teacher | Childcare service | KEEP |
| /speech-therapist-for-children | Childcare service | REFRAME |
| /what-does-a-shadow-teacher-do | Guide | REFRAME |
| /wound-dressing-at-home | Care service | KEEP |
| /community-health-outreach-services | Staffing | REFRAME |
| /hospital-to-home-care | Care service | REFRAME |
| /live-in-caregiver | Care service | KEEP |
| /managed-postpartum-stay-in-nigeria | Care service | REFRAME |
| /stroke-recovery-at-home | Care service | KEEP |
| /clinical-research-staffing | Staffing | MERGE → /clinical-research |
| /medic-connect-talent-pool | Jobs | MERGE → /join |
| /additional-needs-childcare | Childcare service | REFRAME |
| /speech-delay-support | Childcare service | REFRAME |
| /blood-sample-collection-at-home | Care service | KEEP |
| /iv-therapy-at-home | Care service | KEEP |
| /injection-at-home | Care service | KEEP |
| /ngo-health-programme-implementation | Staffing | KEEP |
| /home-care-vs-care-home | Guide | KEEP |
| /nurse-vs-caregiver | Guide | KEEP |
| /who-do-i-need-after-surgery | Guide | KEEP |
| /who-should-i-hire-for-a-newborn | Guide | KEEP |
| /how-medic-connect-home-care-works | Guide | REFRAME |
| /care-for-elderly-parents | Care service | REFRAME |
| /healthcare-facility-management-support | Staffing | REFRAME |
| /hospital-support-services | Staffing | MERGE → /hospital-support |
| /coming-to-nigeria-after-giving-birth | Guide | KEEP |
| /night-nurse-for-newborn | Care service | KEEP |
| /live-in-nanny | Childcare service | KEEP |
| /c-section-recovery-at-home | Care service | KEEP |
| /care-after-hospital-discharge | Care service | REFRAME |
| /equipment-needed-after-hospital-discharge | Guide | KEEP |
| /how-to-prepare-the-home-before-hospital-discharge | Guide | KEEP |
| /physiotherapy-after-stroke | Care service | KEEP |
| /caregiver-jobs-and-opportunities | Jobs | KEEP |
| /nanny-jobs-and-opportunities | Jobs | KEEP |
| /adhd-support-at-home | Childcare service | KEEP |
| /school-companion | Childcare service | REFRAME |
| /occupational-therapy-for-children | Childcare service | KEEP |
| /early-intervention-support | Childcare service | HOLD |
| /behaviour-support | Childcare service | HOLD |
| /stoma-care-at-home | Care service | KEEP |
| /peg-feeding-support-at-home | Care service | KEEP |
| /tracheostomy-care-at-home | Care service | KEEP |
| /ventilator-care-at-home | Care service | KEEP |
| /medication-administration-at-home | Care service | KEEP |
| /blood-pressure-monitoring-at-home | Care service | HOLD |
| /blood-sugar-monitoring-at-home | Care service | HOLD |
| /continence-care-at-home | Care service | KEEP |
| /diabetes-care-at-home | Care service | KEEP |
| /cancer-care-at-home | Care service | KEEP |
| /diabetic-foot-care-at-home | Care service | KEEP |
| /orthopaedic-recovery-at-home | Care service | KEEP |
| /antenatal-care-at-home | Care service | MERGE → /antenatal-care |
| /high-risk-pregnancy-support-at-home | Care service | REFRAME |
| /breastfeeding-support-at-home | Care service | KEEP |
| /nicu-to-home-support | Care service | KEEP |
| /medical-escort-services | Care service | KEEP |
| /transport-to-medical-appointments | Guide | KEEP |
| /doctor-staffing | Staffing | KEEP |
| /pharmacist-staffing | Staffing | KEEP |
| /laboratory-scientist-staffing | Staffing | KEEP |
| /physiotherapist-staffing | Staffing | KEEP |
| /school-healthcare-staffing | Staffing | KEEP |
| /corporate-healthcare-staffing | Staffing | KEEP |
| /correctional-healthcare-support | Staffing | KEEP |
| /doctor-jobs-and-opportunities | Jobs | KEEP |
| /midwife-jobs-and-opportunities | Jobs | KEEP |
| /pharmacist-jobs-and-opportunities | Jobs | KEEP |
| /laboratory-scientist-jobs-and-opportunities | Jobs | KEEP |
| /physiotherapist-jobs-and-opportunities | Jobs | KEEP |
| /how-to-verify-a-nurse-in-nigeria | Guide | KEEP |
| /how-to-verify-a-doctor-in-nigeria | Guide | KEEP |
| /caregiver-cost-in-lagos | Guide | KEEP |
