import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import paediatricMoment from "@/assets/photos/paediatric-moment.webp";

/** Paediatric and additional needs care on the shared service layout. No published fee: quoted after the assessment. */
const config: ServicePageConfig = {
  eyebrow: "Paediatric and additional needs care",
  headline: "Care that grows with your child.",
  accentWord: 5,
  lead: "Compassionate, skilled support at home for children with medical conditions, developmental differences and additional needs.",
  heroArt: [art.therapistBoyBlocks],
  watermark: "o",
  serviceLine: "paediatric",
  whatsappText: "Hi Medic Connect, I'd like to arrange care for my child.",
  facts: [
    { value: "Any hours", label: "Hourly, daily, overnight or respite care" },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "One team", label: "We coordinate with your child's therapists and doctors" },
  ],
  moment: {
    photo: paediatricMoment,
    alt: "A therapist supporting a child during a play session",
    title: "Built around your child.",
    body: "Care plans built around your child's abilities, routines and therapy goals, with the family who knows them best at the centre.",
  },
  visit: {
    title: "An example afternoon",
    intro: "Every child is different. This is what an afternoon of care can look like.",
    items: [
      { time: "13:00", title: "Arrives", text: "Hears how the morning went, and checks what is due." },
      { time: "13:30", title: "Lunch and medicines", text: "Feeding support and medicines, exactly as the care plan says." },
      { time: "14:30", title: "Therapy practice", text: "Exercises set by your child's therapists, made into play." },
      { time: "16:00", title: "Rest and play", text: "Quiet time and the routines that help them settle." },
      { time: "17:30", title: "Handover", text: "How the afternoon went, before the carer leaves." },
    ],
  },
  carer: {
    art: art.charNurse,
    role: "Paediatric care",
    checks: [
      "Identity checked",
      "Credentials checked",
      "Qualifications checked",
      "References taken",
      "Experienced with children's additional needs",
      "Not the right fit? We match someone else",
    ],
  },
  worries: [
    { worry: "What if the carer is off sick?", answer: "We send a replacement, so care carries on." },
    { worry: "What if it is not a good fit?", answer: "Tell us, and we will match a different carer." },
    { worry: "What if their health changes?", answer: "We escalate to a nurse or doctor, and keep you informed." },
    { worry: "Will you work with my child's therapists?", answer: "Yes. We reinforce the goals set by their physio, occupational and speech therapists." },
  ],
  feeSkus: [],
  quoted: "Fees depend on your child's needs and the hours of care, so we quote once we have assessed them.",
  steps: [
    { title: "Tell us about your child", text: "Their condition, their needs and your family's routine." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit, before any care starts, to understand your child's needs and your home." },
    { title: "A plan and a match", text: "A care plan built around their routines, therapies and goals, and the right carer." },
    { title: "Care begins", text: "On the agreed days, with check-ins from our team." },
  ],
  crossLink: {
    href: "/shadow-teacher",
    tag: "At school",
    title: "Need support at school too?",
    body: "A shadow teacher supports your child in class, alongside their teacher.",
    art: art.tutorBoyDesk,
  },
  cta: {
    headline: "Let's plan care around your child.",
    body: "Tell us about your child and we will arrange the assessment.",
    person: art.nurseBlocksChild,
  },
};

const PediatricCare = () => (
  <>
    <SEO title="Paediatric & Special Needs Care in Lagos from ₦15,000 | Medic Connect" description="Specialised in-home support for children with medical and developmental needs across Lagos. Sick child visits from ₦15,000. Neonatal nursing from ₦30,000." path="/pediatric-care" jsonLd={{"@context":"https://schema.org","@type":"Service","name":"Pediatric & Special Needs Care","serviceType":"Pediatric home care","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Specialised in-home support for children with medical conditions and developmental needs. Trained Lagos-based caregivers.","url":"https://www.medicconnect.co/pediatric-care","offers":{"@type":"AggregateOffer","priceCurrency":"NGN","lowPrice":"15000","highPrice":"350000","offerCount":"6","priceSpecification":{"@type":"PriceSpecification","priceCurrency":"NGN","description":"Sick child visit from ₦15,000. Neonatal day nursing from ₦30,000. Post-stroke / rehab packages from ₦350,000."}}}} />
    <ServicePage c={config} />
  </>
);

export default PediatricCare;
