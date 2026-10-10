import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import supportMoment from "@/assets/photos/support-moment.webp";

/** Hospital support on the shared service layout, in facility mode: quoted after a site assessment. */
const config: ServicePageConfig = {
  eyebrow: "Hospital support services",
  headline: "Clinical teams on clinical work.",
  accentWord: 2,
  lead: "Housekeeping, laundry, waste management, pest control and security, run to healthcare standards, so your facility stays safe, clean and running.",
  heroArt: [art.housekeeperMopBucket, art.porterWheelchair],
  watermark: "cross",
  serviceLine: "hospital_support",
  facility: {
    service: "support",
    button: "Request a quote",
    formTitle: "Tell us about your facility",
    formIntro: "Support services are quoted after a site assessment. A coordinator calls you back to arrange it.",
  },
  whatsappText: "Hi Medic Connect, I'd like a quote for hospital support services.",
  facts: [
    { value: "5 services", label: "Housekeeping, laundry, waste, pest control, security" },
    { value: "Backup staff", label: "Cover when someone is off" },
    { value: "Your terms", label: "Daily, weekly or long-term contracts" },
  ],
  moment: {
    photo: supportMoment,
    alt: "Medic Connect support staff collecting hospital linen",
    title: "Trained for hospital environments.",
    body: "Our teams are trained in infection control, safety and healthcare protocols, and work to the compliance your facility needs.",
  },
  visit: {
    title: "An example day of support",
    intro: "Every site is different. This is how a day can run.",
    items: [
      { time: "6:00", title: "Wards and grounds", text: "Cleaning to infection control protocols before the day starts." },
      { time: "8:00", title: "Linen", text: "Linens and scrubs collected and processed hygienically." },
      { time: "12:00", title: "Waste", text: "Clinical waste collected and disposed of compliantly." },
      { time: "Monthly", title: "Pest control", text: "Scheduled treatments, and a response when needed." },
      { time: "24/7", title: "Security", text: "Access control and patient safety, around the clock." },
    ],
  },
  carer: {
    art: art.securityOfficerRadio,
    role: "Support services",
    badge: "Your team",
    eyebrow: "Who we put on site",
    title: "Trained for healthcare settings.",
    checks: [
      "Identity checked",
      "References taken",
      "Infection control trained",
      "Safety and protocol trained",
      "Backup staff in place",
      "Quality managed on site",
    ],
  },
  worries: [
    { worry: "What if someone is off?", answer: "Backup staff keep the service running." },
    { worry: "Do you know hospital standards?", answer: "Yes. Our teams are trained in infection control and healthcare protocols." },
    { worry: "Can we start with one service?", answer: "Yes. Take one, or combine several in one contract." },
    { worry: "How is it priced?", answer: "After a site assessment, with a tailored, transparent proposal." },
  ],
  feeSkus: [],
  steps: [
    { title: "Tell us your needs", text: "Your facility and the support you are looking for." },
    { title: "Site assessment", text: "We visit to understand the scope, frequency and requirements." },
    { title: "Your proposal", text: "A tailored plan with transparent pricing." },
    { title: "Service begins", text: "Teams deploy with clear protocols and ongoing quality management." },
  ],
  crossLink: {
    href: "/hospital-staffing",
    tag: "Clinical",
    title: "Need clinical staff too?",
    body: "Vetted doctors, nurses and allied health professionals, on demand.",
    art: art.locumDoctorBag,
  },
  cta: {
    headline: "Keep your facility running smoothly.",
    body: "Tell us about your site and we will arrange the assessment.",
    person: art.hospitalManagerClipboard,
  },
};

const HospitalSupport = () => (
  <>
    <SEO title="Hospital Support Services in Lagos | Medic Connect" description="Housekeeping, laundry, waste management, pest control, and security for healthcare facilities across Lagos." path="/hospital-support" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Hospital Support Services","serviceType":"Facility support services","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Housekeeping, laundry, waste management, pest control, and security for healthcare facilities across Lagos.","url":"https://www.medicconnect.co/hospital-support","offers":{"@type":"Offer","priceCurrency":"NGN","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Scoped to facility size and service mix. Contact us for a quote."}}}} />
    <ServicePage c={config} />
  </>
);

export default HospitalSupport;
