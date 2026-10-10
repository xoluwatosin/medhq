import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import researchMoment from "@/assets/photos/research-moment.webp";

/** The questions sponsors and CROs ask; shown on the page and sent to Google as FAQ data. */
const crFaqs = [
    { q: "Are you a Clinical Research Organisation (CRO) in Nigeria?", a: "Medic Connect is a clinical research staffing and support partner based in Lagos. We supply coordinators, research nurses, data managers and lab staff to CROs, sponsors, hospitals and academic institutions running trials in Nigeria, matched to each protocol's stated requirements." },
    { q: "What therapeutic areas do you cover?", a: "Our research workforce supports trials across maternal & child health, infectious diseases (including HIV, TB and malaria), oncology, cardiovascular, diabetes, mental health and vaccine studies." },
    { q: "Are your research staff GCP and NAFDAC compliant?", a: "Research personnel are selected against the protocol's stated training and regulatory requirements, and evidence of GCP training and regulatory briefing is confirmed per study. We can deploy across Lagos and other Nigerian states." },
    { q: "How quickly can you staff a clinical trial site?", a: "Deployment timelines are agreed at scoping and depend on protocol complexity, geography and required certifications." },
  ];

/** Clinical research on the shared service layout, in facility mode: quoted per protocol. */
const config: ServicePageConfig = {
  eyebrow: "Clinical research staffing in Nigeria",
  headline: "Protocol-matched research teams.",
  accentWord: 1,
  lead: "Qualified research coordinators, research nurses, data managers and lab staff for pharmaceutical trials, academic research and health studies.",
  heroArt: [art.researchCoordinatorTablet, art.scientistSampleRack],
  watermark: "inf",
  serviceLine: "clinical_research",
  facility: {
    service: "research",
    button: "Discuss your study",
    formTitle: "Tell us about the study",
    formIntro: "Research staffing is quoted per protocol. A coordinator calls you back to scope roles, sites and timelines.",
  },
  whatsappText: "Hi Medic Connect, I'd like to discuss staffing for a clinical study.",
  facts: [
    { value: "Per protocol", label: "Staff selected against each study's requirements" },
    { value: "Every phase", label: "Coordinators, nurses, data and lab staff" },
    { value: "Nigeria-wide", label: "Lagos and other sites, agreed at scoping" },
  ],
  moment: {
    photo: researchMoment,
    alt: "A research coordinator working at a laboratory computer",
    title: "Built around your protocol.",
    body: "For sponsors, CROs, hospitals and academic groups running trials across maternal and child health, infectious diseases, oncology, cardiovascular, diabetes, mental health and vaccines.",
  },
  visit: {
    title: "From protocol to study team",
    intro: "Timelines are agreed at scoping and depend on the protocol.",
    items: [
      { time: "Scoping", title: "Your protocol", text: "Roles, sites, training and regulatory requirements." },
      { time: "Selection", title: "Matched staff", text: "Selected against the protocol's stated requirements." },
      { time: "Checks", title: "Evidence confirmed", text: "GCP training and regulatory briefing confirmed per study." },
      { time: "Deployment", title: "On site", text: "Teams start at your sites on the agreed date." },
      { time: "Ongoing", title: "Support", text: "Coordination and adjustments for the life of the study." },
    ],
  },
  carer: {
    art: art.researchCoordinatorTablet,
    role: "Clinical research",
    badge: "Study staff",
    eyebrow: "Who we put on your study",
    title: "Selected against your protocol.",
    checks: [
      "Identity checked",
      "Credentials checked",
      "GCP training evidenced per study",
      "Regulatory briefing confirmed",
      "References taken",
      "Matched to the protocol",
    ],
  },
  worries: [
    { worry: "Are your staff GCP compliant?", answer: "Evidence of GCP training and regulatory briefing is confirmed per study." },
    { worry: "How quickly can you staff a site?", answer: "Timelines are agreed at scoping, by protocol and geography." },
    { worry: "Do you work outside Lagos?", answer: "Yes, across Nigerian sites, agreed at scoping." },
    { worry: "What therapeutic areas?", answer: "Maternal and child health, infectious disease, oncology, cardiovascular, diabetes, mental health and vaccines." },
  ],
  feeSkus: [],
  steps: [
    { title: "Share the study", text: "Protocol, sites, roles and timelines." },
    { title: "Scoping", text: "We agree requirements and a deployment timeline." },
    { title: "Selection", text: "Staff matched and evidence confirmed per study." },
    { title: "Deployment", text: "Teams on site, with ongoing support." },
  ],
  faqs: crFaqs,
  cta: {
    headline: "Staff your next study.",
    body: "Tell us about the protocol and we will scope the team.",
    person: art.nurseLabellingSample,
  },
};

const ClinicalResearch = () => (
  <>
    <SEO title="Clinical Research Organisation Staffing in Nigeria | Medic Connect" description="Clinical research coordinators, study nurses, data managers and lab staff for trials and studies across Nigeria, matched to each protocol. CRO and sponsor support in Lagos." path="/clinical-research" jsonLd={[{"@context":"https://schema.org","@type":"Service","name":"Clinical Research & Support","serviceType":"Clinical research staffing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Country","name":"Nigeria"},"description":"Research coordinators, study nurses, data managers and lab staff for pharmaceutical trials and academic studies across Nigeria, matched to each protocol's stated requirements.","url":"https://www.medicconnect.co/clinical-research"},{"@context":"https://schema.org","@type":"FAQPage","mainEntity":crFaqs.map(f=>({"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}))}]} />
    <ServicePage c={config} />
  </>
);

export default ClinicalResearch;
