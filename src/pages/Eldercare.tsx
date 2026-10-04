import SEO from "@/components/SEO";
import { medicalServiceSchema } from "@/lib/medical-schema";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import eldercareMoment from "@/assets/photos/eldercare-moment.webp";

/** Eldercare on the shared service layout. Prices come from the published list (PUB- SKUs). */
const config: ServicePageConfig = {
  eyebrow: "Eldercare in Lagos",
  headline: "Be their child again. We'll handle the care.",
  accentWord: 2,
  lead: "Professional care at home keeps them safe, sleeping well and eating right, so you can stop being the nurse and go back to being the son or daughter.",
  heroArt: [art.elderWalkingFrame],
  watermark: "o",
  serviceLine: "eldercare",
  whatsappText: "Hi Medic Connect, I'd like to arrange eldercare.",
  facts: [
    { value: "₦18,000", label: "Companion care, per 4 hours" },
    { value: "₦35,000", label: "The home assessment every plan starts with" },
    { value: "Every visit", label: "Ends with a short note to you on WhatsApp" },
  ],
  moment: {
    photo: eldercareMoment,
    alt: "A carer and an older woman laughing together at home",
    title: "Stay the son or daughter.",
    body: "You carry enough already. We take on the bathing, the medication and the night cover, so your time with them goes back to being love, not logistics.",
    aside: {
      title: "A note after every visit",
      body: "How they slept, what they ate, their vitals and mood, and anything that needs your attention. Family abroad always know.",
    },
  },
  audience: [
    "Older relatives who need help day to day",
    "Recovering from illness or surgery",
    "Living with dementia or Alzheimer's",
    "Living alone and in need of company",
    "Families who need a break from caring",
    "Family abroad who need someone there",
  ],
  audienceArt: art.elderWomanAdire,
  included: [
    { title: "Daily living support", text: "Bathing, dressing, grooming, toileting and mobility, done with dignity.", art: art.objSoap },
    { title: "Medication support", text: "Reminders and help so medicines are taken correctly and on time.", art: art.objPillOrganiser },
    { title: "Meals", text: "Meals prepared to their diet, preferences and health needs.", art: art.objMeal },
    { title: "Companionship", text: "Conversation, games, reading and walks, so the days are not lonely.", art: art.objArmchair },
    { title: "Dementia care", text: "Carers trained in memory care, with patience and routine.", art: art.objHandsHeart },
    { title: "Mobility and falls", text: "Help with walking and transfers, and a home set up to prevent falls.", art: art.objWalkingFrame },
  ],
  feeSkus: ["PUB-COMPANION-4H", "PUB-NURSING-BASIC", "PUB-ESCORT"],
  steps: [
    { title: "Tell us about them", text: "Message us or request care with a few details about your relative and their routine." },
    { title: "The home assessment", text: "A care coordinator visits to understand their needs and the home. The assessment is ₦35,000." },
    { title: "A plan and a match", text: "We agree the care plan with you and match a carer to their needs and personality." },
    { title: "Care begins", text: "Visits start on the agreed days, with a WhatsApp note after each one." },
  ],
  crossLink: {
    href: "/care-from-abroad",
    tag: "For family abroad",
    title: "Looking after a parent in Lagos from London, New York or Toronto?",
    body: "Visit notes on WhatsApp, scheduling across time zones and international billing. Stay the son or daughter and let us be the hands.",
    art: art.videoCallFamily,
  },
  cta: {
    headline: "Your loved one deserves compassionate care.",
    body: "Let's create a plan that gives them comfort and gives you peace of mind.",
    person: art.grandfatherWalkingStick,
  },
};

const Eldercare = () => (
  <>
    <SEO
      title="Eldercare & Companion Care in Lagos from ₦12,000 | Medic Connect"
      description="Dignified in-home care for seniors from ₦12,000 per visit. 24-hour nursing from ₦55,000 per day. Compassionate, vetted carers across Lagos."
      path="/eldercare"
      jsonLd={medicalServiceSchema({
        name: "Eldercare & Companion Care",
        path: "/eldercare",
        description: "Dignified in-home care helping seniors maintain independence and quality of life. Skilled nurses and compassionate companion carers across Lagos.",
        specialty: "Geriatric",
        audienceType: "Older adults living at home in Lagos",
        includeDiaspora: true,
        relatedProcedures: [
          "Activities of daily living assistance",
          "Medication administration",
          "Mobility and fall-prevention support",
          "Dementia and Alzheimer's home care",
          "Chronic disease monitoring (hypertension, diabetes)",
          "24-hour live-in nursing",
        ],
        offers: {
          lowPrice: 12000,
          highPrice: 500000,
          offerCount: 6,
          description: "From ₦12,000 per visit. 24-hour nursing from ₦55,000 per day. Dementia care package from ₦500,000.",
        },
      })}
    />
    <ServicePage c={config} />
  </>
);

export default Eldercare;
