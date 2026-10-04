import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import antenatalMoment from "@/assets/photos/antenatal-moment.webp";

/** Antenatal care on the shared service layout. Fees from the published list (PUB- SKUs). */
const config: ServicePageConfig = {
  eyebrow: "Antenatal care at home",
  headline: "Pregnancy care that comes to you.",
  accentWord: 5,
  lead: "Midwife visits, blood pressure checks and birth preparation at home, so you see fewer waiting rooms and warning signs are caught early.",
  heroArt: [art.midwifePregnantBp],
  watermark: "inf",
  serviceLine: "antenatal",
  whatsappText: "Hi Medic Connect, I'd like to arrange antenatal care at home.",
  facts: [
    { value: "₦30,000", label: "Antenatal visits", from: true },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Your hours", label: "Visits mornings, evenings or weekends" },
  ],
  moment: {
    photo: antenatalMoment,
    alt: "A midwife checking a pregnant woman's blood pressure at home",
    title: "Fewer waiting rooms.",
    body: "Regular check-ups at home, with a qualified midwife who gets to know you and your pregnancy.",
  },
  visit: {
    title: "An example midwife visit",
    intro: "Every pregnancy is different. This is what a home visit can look like.",
    items: [
      { time: "10:00", title: "Arrives", text: "How you are feeling, and any new symptoms." },
      { time: "10:10", title: "Checks", text: "Blood pressure and your pregnancy's progress." },
      { time: "10:30", title: "Your questions", text: "Time for anything on your mind." },
      { time: "10:45", title: "Birth preparation", text: "Nutrition, labour, breastfeeding and newborn care." },
      { time: "11:00", title: "Before leaving", text: "Readings recorded, and the next visit booked." },
    ],
  },
  carer: {
    art: art.nurseWomanCoat,
    role: "Midwife",
    checks: [
      "Identity checked",
      "Credentials checked",
      "Midwifery registration verified",
      "Qualifications checked",
      "References taken",
      "Not the right fit? We match someone else",
    ],
  },
  worries: [
    { worry: "What if my blood pressure is high?", answer: "We flag it straight away, so it is acted on early." },
    { worry: "Can visits fit around work?", answer: "Yes. Mornings, evenings or weekends." },
    { worry: "What if my midwife can't make it?", answer: "We send a replacement, so visits carry on." },
    { worry: "What if it is not a good fit?", answer: "Tell us, and we will match a different midwife." },
  ],
  feeSkus: ["PUB-ANTENATAL-VISIT", "PUB-HIGH-RISK-ANTENATAL", "PUB-ANTENATAL-TRIMESTER"],
  steps: [
    { title: "Tell us about your pregnancy", text: "How far along you are, any conditions, and the support you want." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit from a qualified midwife, before any care starts." },
    { title: "Your care plan", text: "A visit plan built around your pregnancy and your schedule." },
    { title: "Visits begin", text: "Regular home visits, with readings recorded each time." },
  ],
  crossLink: {
    href: "/postnatal-care",
    tag: "After the birth",
    title: "Support for the weeks after baby arrives",
    body: "Omugwo and postnatal care, day or night, so you can rest and heal.",
    art: art.postnatalSpecialist2,
  },
  cta: {
    headline: "A calmer, safer pregnancy.",
    body: "Tell us how far along you are and we will plan the visits.",
    person: art.motherMug2,
  },
};

const AntenatalCare = () => (
  <>
    <SEO title="Antenatal Care at Home in Lagos from ₦30,000 | Medic Connect" description="Expert pregnancy monitoring at home: vitals checks, midwife visits, telehealth and education across Lagos. Routine antenatal visits from ₦30,000." path="/antenatal-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Antenatal Care at Home","serviceType":"Antenatal care","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Expert pregnancy monitoring at home: vitals checks, telehealth, and education on nutrition, rest, and warning signs across Lagos.","url":"https://www.medicconnect.co/antenatal-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"30000","highPrice":"140000","offerCount":"3","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Routine antenatal visit ₦30,000. High-risk pregnancy visit ₦40,000. Trimester antenatal package from ₦140,000. Formal care assessment ₦35,000."}}}} />
    <ServicePage c={config} />
  </>
);

export default AntenatalCare;
