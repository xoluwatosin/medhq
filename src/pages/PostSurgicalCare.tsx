import SEO from "@/components/SEO";
import { medicalServiceSchema, faqSchema } from "@/lib/medical-schema";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import postSurgicalMoment from "@/assets/photos/post-surgical-moment.webp";

/** The questions families ask; shown on the page and sent to Google as FAQ data. */
const faqs = [{
    q: "When should post-surgical home care start?",
    a: "Ideally before discharge. We can review the surgeon's plan, prep the home and meet you the day you come home. We can also start mid-recovery if you only realise later that more help is needed."
  }, {
    q: "What is the difference between this and clinical home care?",
    a: "Post-surgical care is a focused application of our clinical home care service: shorter, more intensive, organised around a specific procedure and recovery window."
  }, {
    q: "Can you coordinate with my surgeon or hospital?",
    a: "Yes. With your consent we liaise with your surgeon's team, share recovery notes and flag anything that needs medical review."
  }, {
    q: "Do you cover overnight cover after surgery?",
    a: "Yes. Overnight nursing cover is common for the first week or two after major surgery, especially when family caregivers also need to sleep."
  }, {
    q: "Can the patient's family abroad book this?",
    a: "Yes. Many of our post-surgical clients are booked by sons and daughters abroad. We send per-visit reports on WhatsApp and bill the family directly."
  }];

/** Post-surgical care on the shared service layout. Fees from the published list (PUB- SKUs). */
const config: ServicePageConfig = {
  eyebrow: "Recovery at home",
  headline: "Heal at home, safely.",
  accentWord: 3,
  lead: "Trained nurses pick up where your surgeon leaves off: wound care, medicines on time and quiet eyes on your recovery, in your own bed.",
  heroArt: [art.manCrutches],
  watermark: "o",
  serviceLine: "post_surgical",
  whatsappText: "Hi Medic Connect, I'd like to arrange care after surgery.",
  facts: [
    { value: "₦20,000", label: "Nursing visits", from: true },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Before discharge", label: "Ideally we start before you come home" },
  ],
  moment: {
    photo: postSurgicalMoment,
    alt: "A nurse helping a woman walk with crutches at home",
    title: "So your family doesn't have to carry it.",
    body: "We collect the discharge notes, medicines and follow-up dates from your surgeon, prepare the home and meet you the day you come home.",
  },
  visit: {
    title: "An example recovery visit",
    intro: "Every recovery is different. This is what a morning visit can look like.",
    items: [
      { time: "9:00", title: "Arrives", text: "Pain, sleep and how the night went." },
      { time: "9:15", title: "Wound and drain", text: "Dressing changed, drain checked, signs of infection watched for." },
      { time: "9:45", title: "Medicines", text: "Antibiotics, pain relief and blood thinners on schedule, recorded." },
      { time: "10:15", title: "Moving safely", text: "Safe transfers and a short walk, to prevent falls and clots." },
      { time: "10:45", title: "Recovery notes", text: "Vitals and pain scores shared with family and, on request, your doctor." },
    ],
  },
  carer: { art: art.nurseManKit, role: "Post-surgical care", checks: [
      "Identity checked",
      "Credentials checked",
      "Nursing licence verified",
      "Skills assessed",
      "References taken",
      "Not the right fit? We match someone else",
    ] },
  worries: [
    { worry: "When should it start?", answer: "Ideally before discharge, but we can start mid-recovery too." },
    { worry: "Can you work with my surgeon?", answer: "Yes. With your consent we share notes and flag anything for review." },
    { worry: "Do you cover nights?", answer: "Yes. Overnight cover is common for the first week or two." },
    { worry: "What if something looks wrong?", answer: "We escalate to a nurse or doctor, and keep you informed." },
  ],
  feeSkus: ["PUB-NURSING-BASIC", "PUB-WOUND-SIMPLE", "PUB-DRAIN"],
  steps: [
    { title: "Tell us about the surgery", text: "The procedure, the date and when you expect to come home." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit, before any care starts, to plan recovery and prepare the home." },
    { title: "A plan and a match", text: "We work from the surgeon's plan and match the right nurse." },
    { title: "Care begins", text: "From the day you come home, on the agreed schedule." },
  ],
  faqs,
  crossLink: {
    href: "/care-from-abroad",
    tag: "For family abroad",
    title: "Arranging recovery for a relative in Lagos from overseas?",
    body: "We book and bill from your side, and send updates on WhatsApp after each visit.",
    art: art.grandparentsVideoCall,
  },
  related: [
    { label: "Care after hospital discharge", path: "/care-after-hospital-discharge" },
    { label: "Who do I need after surgery?", path: "/who-do-i-need-after-surgery" },
    { label: "Wound dressing at home", path: "/wound-dressing-at-home" },
    { label: "Physiotherapy at home", path: "/physiotherapy-at-home" },
    { label: "Orthopaedic recovery at home", path: "/orthopaedic-recovery-at-home" },
    { label: "Doctor home visits", path: "/doctor-home-visits" },
  ],
  cta: {
    headline: "Recover at home, safely.",
    body: "Tell us the surgery date and we will plan the support around it.",
    person: art.manForearmCrutches,
  },
};

const PostSurgicalCare = () => (
  <>
    <SEO
            title="Post-Surgical Care at Home in Lagos | Medic Connect"
            description="Heal at home, safely. Trained nurses for wound care, medication timing, fall prevention and recovery monitoring after surgery. Lagos, typically within 48 hours."
            path="/post-surgical-care"
            jsonLd={[
              medicalServiceSchema({
                name: "Post-Surgical Home Care",
                path: "/post-surgical-care",
                description: "Skilled nursing for recovery at home after surgery: wound care, medication management, complications monitoring and fall prevention.",
                specialty: "Surgical",
                audienceType: "Patients recovering from surgery at home in Lagos",
                includeDiaspora: true,
                relatedProcedures: [
                  "Surgical wound care and dressing changes",
                  "Post-operative pain and medication management",
                  "Drain and catheter care",
                  "Complication and infection monitoring",
                  "Mobility and fall-prevention support",
                  "Post-Caesarean recovery care",
                ],
                offers: {
                  lowPrice: 20000,
                  highPrice: 70000,
                  offerCount: 5,
                  description: "Basic nursing visit ₦20,000. Skilled nursing visit from ₦25,000. Simple wound dressing from ₦25,000. Surgical drain management ₦25,000. Complex wound or VAC care from ₦70,000.",
                },
              }),
              faqSchema(faqs),
            ]}
          />
    <ServicePage c={config} />
  </>
);

export default PostSurgicalCare;
