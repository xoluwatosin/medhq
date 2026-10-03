-- Register every expansion SEO route in the governed page registry.
-- Routes exist in the codebase but none is indexable: indexing is granted only
-- through this registry after the ownership review. The three routes that
-- duplicate an established page are recorded as merged, with the established
-- URL as their canonical owner.

with grouped (page_type, estate, paths) as (
  values
  ('service', 'families', array['/autism-support-at-home', '/shadow-teacher', '/speech-therapist-for-children', '/wound-dressing-at-home', '/hospital-to-home-care', '/live-in-caregiver', '/managed-postpartum-stay-in-nigeria', '/stroke-recovery-at-home', '/additional-needs-childcare', '/speech-delay-support', '/blood-sample-collection-at-home', '/iv-therapy-at-home', '/injection-at-home', '/care-for-elderly-parents', '/night-nurse-for-newborn', '/live-in-nanny', '/c-section-recovery-at-home', '/care-after-hospital-discharge', '/physiotherapy-after-stroke', '/adhd-support-at-home', '/school-companion', '/occupational-therapy-for-children', '/early-intervention-support', '/behaviour-support', '/stoma-care-at-home', '/peg-feeding-support-at-home', '/tracheostomy-care-at-home', '/ventilator-care-at-home', '/medication-administration-at-home', '/blood-pressure-monitoring-at-home', '/blood-sugar-monitoring-at-home', '/continence-care-at-home', '/diabetes-care-at-home', '/cancer-care-at-home', '/diabetic-foot-care-at-home', '/orthopaedic-recovery-at-home', '/antenatal-care-at-home', '/high-risk-pregnancy-support-at-home', '/breastfeeding-support-at-home', '/nicu-to-home-support', '/medical-escort-services']),
  ('editorial', 'families', array['/what-does-a-shadow-teacher-do', '/home-care-vs-care-home', '/nurse-vs-caregiver', '/who-do-i-need-after-surgery', '/who-should-i-hire-for-a-newborn', '/how-medic-connect-home-care-works', '/coming-to-nigeria-after-giving-birth', '/equipment-needed-after-hospital-discharge', '/how-to-prepare-the-home-before-hospital-discharge', '/transport-to-medical-appointments', '/how-to-verify-a-nurse-in-nigeria', '/how-to-verify-a-doctor-in-nigeria', '/caregiver-cost-in-lagos']),
  ('b2b', 'facilities', array['/community-health-outreach-services', '/clinical-research-staffing', '/ngo-health-programme-implementation', '/healthcare-facility-management-support', '/hospital-support-services', '/doctor-staffing', '/pharmacist-staffing', '/laboratory-scientist-staffing', '/physiotherapist-staffing', '/school-healthcare-staffing', '/corporate-healthcare-staffing', '/correctional-healthcare-support']),
  ('job_collection', 'talent', array['/medic-connect-talent-pool', '/caregiver-jobs-and-opportunities', '/nanny-jobs-and-opportunities', '/doctor-jobs-and-opportunities', '/midwife-jobs-and-opportunities', '/pharmacist-jobs-and-opportunities', '/laboratory-scientist-jobs-and-opportunities', '/physiotherapist-jobs-and-opportunities'])
),
merged (path, owner) as (
  values
  ('/antenatal-care-at-home', '/antenatal-care'),
  ('/clinical-research-staffing', '/clinical-research'),
  ('/hospital-support-services', '/hospital-support')
),
incoming as (
  select
    'exp' || p.path as page_key,
    p.path,
    g.page_type,
    g.estate,
    m.owner
  from grouped g
  cross join lateral unnest(g.paths) as p(path)
  left join merged m on m.path = p.path
)
insert into public.seo_pages (page_key, path, page_type, estate, h1, index_state, publication_state, canonical_path, notes)
select
  i.page_key,
  i.path,
  i.page_type,
  i.estate,
  initcap(replace(substring(i.path from 2), '-', ' ')),
  case when i.owner is null then 'candidate' else 'noindex' end,
  case when i.owner is null then 'planned' else 'archived' end,
  i.owner,
  case when i.owner is null
       then 'Registered from the expansion route set; not approved for indexing.'
       else 'Merged into ' || i.owner || '; the established page owns this topic.' end
from incoming i
where not exists (
  select 1 from public.seo_pages p where p.path = i.path or p.page_key = i.page_key
);