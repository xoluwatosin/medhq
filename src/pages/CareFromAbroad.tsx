import SEO from "@/components/SEO";
import { faqSchema, DIASPORA_AUDIENCE, LAGOS_AREA, PROVIDER } from "@/lib/medical-schema";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import abroadMoment from "@/assets/photos/abroad-moment.webp";

/** The questions families abroad ask; shown on the page and sent to Google as FAQ data. */
const faqs = [{
    q: "We live abroad. How do we actually arrange care for someone in Lagos?",
    a: "Message us on WhatsApp with a quick description of your loved one's situation. We do a phone or video consultation with you, then a home assessment in Lagos. Within 48 hours we usually have the right carer matched and starting."
  }, {
    q: "How do we know what's actually happening day to day?",
    a: "After every visit you get a short WhatsApp report covering vitals, meals, mood, medication and anything we noticed. You can also speak to the care coordinator any time."
  }, {
    q: "Can we pay from the UK, US or Canada?",
    a: "Yes. We accept card payments and international transfers. Invoices are issued monthly with clear line items."
  }, {
    q: "What if we want to change the carer?",
    a: "Just tell us. We re-match. Comfort and trust matter more than continuity for its own sake."
  }, {
    q: "Can the carer take our parent to hospital appointments?",
    a: "Yes. Escort to clinics and hospital appointments, with a written report afterwards, is a standard part of the service."
  }, {
    q: "Do you only serve Lagos?",
    a: "Right now, yes. Most of our diaspora clients have parents or relatives in Lagos. We're expanding carefully."
  }];

/** Care from abroad on the shared service layout. No single fee: each service has its own. */
const config: ServicePageConfig = {
  eyebrow: "Care from abroad",
  headline: "Your hands at home in Lagos.",
  accentWord: 1,
  lead: "You can't be in two places. We can. From London, New York, Toronto or anywhere else, you manage the care for your loved one and we deliver it, day by day.",
  heroArt: [art.videoCallFamily],
  watermark: "o",
  serviceLine: "care_from_abroad",
  whatsappText: "Hi Medic Connect, I'd like to arrange care for a relative in Lagos.",
  facts: [
    { value: "48 hours", label: "Most placements confirmed within 48 hours" },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Every visit", label: "Ends with a report to you on WhatsApp" },
  ],
  moment: {
    photo: abroadMoment,
    alt: "A carer showing an older woman a tablet at home",
    title: "You are not handing your parents to strangers.",
    body: "Every carer is background-checked, address-verified and trained. We are HEFAMAA accredited, insured and members of the Healthcare Federation of Nigeria.",
  },
  visit: {
    title: "An example week, from where you are",
    intro: "Every plan is different. This is how a week can look from abroad.",
    items: [
      { time: "Mon", title: "A visit and a report", text: "Meals, medicines and a walk, with a WhatsApp report afterwards." },
      { time: "Wed", title: "A clinic appointment", text: "Escorted there and back, with a written report." },
      { time: "Fri", title: "A visit and a report", text: "How they slept, ate and felt, and anything you should know." },
      { time: "Any time", title: "Your coordinator", text: "On WhatsApp, on your hours, not just Lagos hours." },
      { time: "Month end", title: "One clear invoice", text: "Paid by card or transfer from the UK, US, Canada, EU and beyond." },
    ],
  },
  carer: {
    art: art.charCaregiver,
    role: "Care from abroad",
    checks: [
      "Background-checked",
      "Address verified",
      "Guarantor in place",
      "Credentials checked",
      "Trained",
      "Not the right fit? We re-match",
    ],
  },
  worries: [
    { worry: "How will we know what is happening?", answer: "A WhatsApp report after every visit, and your coordinator any time." },
    { worry: "Can we pay from the UK, US or Canada?", answer: "Yes. Card or international transfer, with monthly invoices." },
    { worry: "What if we want to change the carer?", answer: "Just tell us. We re-match." },
    { worry: "Can the carer take them to appointments?", answer: "Yes, with a written report afterwards." },
  ],
  feeSkus: [],
  quoted: "Fees depend on the care your relative needs. Each service page shows example fees.",
  steps: [
    { title: "Message us", text: "A quick description on WhatsApp, from wherever you are." },
    { title: "A call with you", text: "A phone or video consultation, on your hours." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit in Lagos, before any care starts." },
    { title: "Care begins", text: "Usually matched within 48 hours, with a report after every visit." },
  ],
  faqs,
  crossLink: {
    href: "/eldercare",
    tag: "For an ageing parent",
    title: "Eldercare in Lagos",
    body: "Companion visits, personal care and nursing, with a note to you after every visit.",
    art: art.grandfatherWalkingStick,
  },
  cta: {
    headline: "Be there, even from far away.",
    body: "Tell us about your loved one and we will arrange the rest.",
    person: art.diasporaSon,
  },
};

const CareFromAbroad = () => (
  <>
    <SEO
            title="Care from Abroad — Arrange Care in Lagos for Your Loved Ones | Medic Connect"
            description="For diaspora families. Arrange vetted nurses and carers for parents and relatives in Lagos, with per-visit WhatsApp reports and simple international billing. Most placements within 48 hours."
            path="/care-from-abroad"
            jsonLd={[
              {
                "@context": "https://schema.org",
                "@type": ["Service", "MedicalBusiness"],
                "name": "Care from Abroad",
                "serviceType": "Diaspora-managed home care coordination",
                "provider": PROVIDER,
                "areaServed": LAGOS_AREA,
                "audience": [
                  DIASPORA_AUDIENCE,
                  {
                    "@type": "MedicalAudience",
                    "audienceType": "Elderly parents and relatives of Nigerians living abroad",
                    "geographicArea": LAGOS_AREA,
                  },
                ],
                "description": "Subscription-style home care for diaspora families: vetted nurses and carers in Lagos, per-visit WhatsApp reports, scheduling across time zones, international billing.",
                "url": "https://www.medicconnect.co/care-from-abroad",
                "availableChannel": {
                  "@type": "ServiceChannel",
                  "serviceUrl": "https://wa.me/2348126988237",
                  "name": "WhatsApp care coordination",
                },
              },
              faqSchema(faqs),
            ]}
          />
    <ServicePage c={config} />
  </>
);

export default CareFromAbroad;
