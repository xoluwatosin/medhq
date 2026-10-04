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
    { value: "₦18,000", label: "Eldercare visits", from: true },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Every visit", label: "Ends with a short note to you on WhatsApp" },
  ],
  moment: {
    photo: eldercareMoment,
    alt: "A carer and an older woman laughing together at home",
    title: "Stay the son or daughter.",
    body: "You carry enough already. We take on the bathing, the medication and the night cover, so your time with them goes back to being love, not logistics.",
  },
  visit: {
    title: "An example morning",
    intro: "Every plan is different. This is what a morning visit can look like.",
    items: [
      { time: "8:00", title: "Arrives and checks in", text: "How they slept, and their blood pressure." },
      { time: "8:30", title: "Bath and dressing", text: "Help to wash, dress and get ready, at their pace." },
      { time: "9:30", title: "Breakfast and medicines", text: "A meal to their diet, and morning medicines taken on time." },
      { time: "10:30", title: "A walk or exercises", text: "Moving safely, with help where it is needed." },
      { time: "11:45", title: "A note to you", text: "How the morning went, on WhatsApp, before the carer leaves." },
    ],
  },
  carer: {
    art: art.charCaregiver,
    role: "Eldercare",
    checks: [
      "Identity checked",
      "Registration checked, where the role needs it",
      "Qualifications checked",
      "References taken",
      "Matched to their needs and personality",
      "Not the right fit? We match someone else",
    ],
  },
  worries: [
    { worry: "What if the carer is off sick?", answer: "We send a replacement, so the visits carry on." },
    { worry: "What if it is not a good fit?", answer: "Tell us, and we will match a different carer." },
    { worry: "What if their health gets worse?", answer: "We escalate to a nurse or doctor, and keep you informed." },
    { worry: "How will I know they are okay?", answer: "A short note on WhatsApp after every visit." },
  ],
  feeSkus: ["PUB-COMPANION-4H", "PUB-NURSING-BASIC", "PUB-ESCORT"],
  steps: [
    { title: "Tell us about them", text: "Message us or request care with a few details about your relative and their routine." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit from a care coordinator, before any care starts." },
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
