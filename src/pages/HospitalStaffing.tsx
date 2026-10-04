import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import staffingMoment from "@/assets/photos/staffing-moment.webp";

/** Hospital staffing on the shared service layout, in facility mode: quoted per scope, with the enquiry form. */
const config: ServicePageConfig = {
  eyebrow: "Hospital and corporate staffing",
  headline: "Cover for every shift.",
  accentWord: 3,
  lead: "Vetted doctors, nurses and allied health professionals for hospitals, clinics and companies, on demand or for the long term.",
  heroArt: [art.locumDoctorBag, art.proNurseCoat],
  watermark: "cross",
  serviceLine: "hospital_staffing",
  facility: {
    service: "staffing",
    button: "Request staff",
    formTitle: "Tell us the rota gap",
    formIntro: "Staffing is quoted per scope: roles, shifts and how long. A coordinator calls you back to confirm.",
  },
  whatsappText: "Hi Medic Connect, I'd like to discuss staffing for our facility.",
  facts: [
    { value: "Pre-vetted", label: "Checked before anyone is put forward" },
    { value: "Any length", label: "Shifts, locum, permanent or event cover" },
    { value: "HEFAMAA", label: "Accredited by Lagos State's health facility regulator" },
  ],
  moment: {
    photo: staffingMoment,
    alt: "A team of nurses and doctors reviewing notes on a hospital ward",
    title: "Reliable cover, without the scramble.",
    body: "Short-term cover for leave and sick days, locums, permanent placements and event medical staff, from one pre-vetted pool.",
  },
  visit: {
    title: "From request to first shift",
    intro: "Timelines are agreed at scoping. This is how cover typically comes together.",
    items: [
      { time: "Day 1", title: "You send the gap", text: "Roles, dates, shifts and the compliance your site needs." },
      { time: "Next", title: "We match", text: "Professionals selected from our pool against your criteria." },
      { time: "Next", title: "You confirm", text: "Profiles shared, and you approve the match." },
      { time: "Shift day", title: "Onboarding", text: "Documents, credentials and orientation handled with you." },
      { time: "Ongoing", title: "Support", text: "Feedback and quick changes, so the rota keeps running." },
    ],
  },
  carer: {
    art: art.charDoctor,
    role: "Clinical staffing",
    badge: "Your locum",
    eyebrow: "Who we put forward",
    title: "Compliance cleared before deployment.",
    checks: [
      "Identity checked",
      "Licence verified",
      "Credentials checked",
      "Skills assessed",
      "References taken",
      "Compliance cleared before deployment",
    ],
  },
  worries: [
    { worry: "What if someone calls in sick?", answer: "We cover from the same pre-vetted pool." },
    { worry: "Who handles the paperwork?", answer: "We do: documents, credentials and regulatory requirements." },
    { worry: "Can we scale up or down?", answer: "Yes. Arrangements flex with your needs." },
    { worry: "What if a placement isn't working?", answer: "Tell us, and we adjust quickly." },
  ],
  feeSkus: [],
  steps: [
    { title: "Send the requirement", text: "Roles, shifts, timeframe and any specific requirements." },
    { title: "Skills match", text: "We select from our pre-vetted pool against your clinical criteria." },
    { title: "Onboarding", text: "Compliance checks and orientation, for a smooth start." },
    { title: "Ongoing support", text: "Monitoring, feedback and quick adjustments." },
  ],
  crossLink: {
    href: "/hospital-support",
    tag: "Non-clinical",
    title: "Need support staff too?",
    body: "Housekeeping, laundry, waste, pest control and security for healthcare facilities.",
    art: art.securityOfficerRadio,
  },
  cta: {
    headline: "Need cover this week?",
    body: "Send us the rota gap and we will tell you what we can fill and when.",
    person: art.doctorNurseHandshake,
  },
};

const HospitalStaffing = () => (
  <>
    <SEO title="Hospital & Corporate Staffing in Lagos | Medic Connect" description="Vetted doctors, nurses, and allied health professionals deployed on demand to hospitals and corporates across Lagos." path="/hospital-staffing" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Hospital & Corporate Staffing","serviceType":"Healthcare staffing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Vetted doctors, nurses, and allied health professionals deployed on demand to hospitals and corporates across Lagos.","url":"https://www.medicconnect.co/hospital-staffing","offers":{"@type":"Offer","priceCurrency":"NGN","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Quoted by role, shift, and volume. Contact us for a custom quote."}}}} />
    <ServicePage c={config} />
  </>
);

export default HospitalStaffing;
