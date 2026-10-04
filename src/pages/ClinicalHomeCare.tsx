import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import clinicalMoment from "@/assets/photos/clinical-moment.webp";

/** Clinical home care on the shared service layout. Fees from the published list (PUB- SKUs). */
const config: ServicePageConfig = {
  eyebrow: "Clinical home care in Lagos",
  headline: "Skilled nursing, right at home.",
  accentWord: 4,
  lead: "Vetted nurses for recovery, chronic illness and everyday clinical needs: medicines, wounds, IV therapy and the checks that keep someone well at home.",
  heroArt: [art.nurseWoundKit],
  watermark: "inf",
  serviceLine: "clinical_home_care",
  whatsappText: "Hi Medic Connect, I'd like to arrange clinical care at home.",
  facts: [
    { value: "₦20,000", label: "Nursing visits", from: true },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "HEFAMAA", label: "Accredited by Lagos State's health facility regulator" },
  ],
  moment: {
    photo: clinicalMoment,
    alt: "A nurse going through a care plan with an older man at home",
    title: "Care you can trust, in your own home.",
    body: "Personalised care for recovery, chronic illness and daily living, planned around the patient's needs and delivered by professionals we have checked.",
  },
  visit: {
    title: "An example nursing visit",
    intro: "Every plan is different. This is what a morning nursing visit can look like.",
    items: [
      { time: "10:00", title: "Arrives", text: "Washes hands, and asks how they have been." },
      { time: "10:10", title: "Vital signs", text: "Blood pressure, pulse, temperature, and blood sugar where needed." },
      { time: "10:25", title: "Medicines and treatment", text: "Medicines, injections or IV therapy, as prescribed." },
      { time: "10:45", title: "Wound care", text: "Dressings changed and healing checked." },
      { time: "11:00", title: "Before leaving", text: "Readings recorded and anything to watch passed on to you." },
    ],
  },
  carer: { art: art.nurseWomanBpCuff, role: "Clinical nursing", checks: [
      "Identity checked",
      "Credentials checked",
      "Nursing licence verified",
      "Skills assessed",
      "References taken",
      "Not the right fit? We match someone else",
    ] },
  worries: [
    { worry: "What if the nurse is off sick?", answer: "We send a replacement, so care carries on." },
    { worry: "What if they need a doctor?", answer: "We escalate to a doctor, and keep you informed." },
    { worry: "Can you cover nights?", answer: "Yes. Overnight and round-the-clock cover can be arranged." },
    { worry: "What if it is not a good fit?", answer: "Tell us, and we will match a different nurse." },
  ],
  feeSkus: ["PUB-NURSING-BASIC", "PUB-NURSING-SKILLED", "PUB-IV-CARE"],
  steps: [
    { title: "Tell us what is needed", text: "On WhatsApp or by phone: the condition, the care and the current situation." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit from a qualified nurse, before any care starts." },
    { title: "A plan and a match", text: "A tailored care plan, the right professional and a start date." },
    { title: "Care begins", text: "On the agreed days, with readings recorded at every visit." },
  ],
  crossLink: {
    href: "/post-surgical-care",
    tag: "After surgery",
    title: "Coming home after an operation?",
    body: "Focused nursing for the recovery window: wounds, drains and medicines on time.",
    art: art.manCrutches,
  },
  cta: {
    headline: "Care you can trust, right at home.",
    body: "Tell us what is needed and we will arrange the assessment.",
    person: art.nurseManKit,
  },
};

const ClinicalHomeCare = () => (
  <>
    <SEO title="Clinical Home Care in Lagos from ₦12,000 | Medic Connect" description="Skilled nursing, IV therapy, wound care and chronic illness management at home in Lagos. From ₦12,000 per visit. 24-hour nursing from ₦55,000 per day." path="/clinical-home-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Clinical Home Care","serviceType":"Home health nursing","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Skilled nursing, post-surgical care, and chronic illness management at home in Lagos. Vetted healthcare professionals from Medic Connect.","url":"https://www.medicconnect.co/clinical-home-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"12000","highPrice":"55000","offerCount":"9","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Nursing visits from ₦12,000. 24-hour nursing from ₦55,000 per day. Wound care from ₦5,000 per visit."}}}} />
    <ServicePage c={config} />
  </>
);

export default ClinicalHomeCare;
