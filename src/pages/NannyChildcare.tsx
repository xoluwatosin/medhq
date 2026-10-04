import SEO from "@/components/SEO";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import nannyMoment from "@/assets/photos/nanny-moment.webp";

/** The questions families ask; sent to Google as FAQ data. */
const nannyFaqs = [
    { q: "How much does a nanny cost in Lagos?", a: "Nanny fees depend on the hours, live-in or live-out, and your children's ages, so we quote after a one-off ₦35,000 home assessment that covers the home visit, matching and onboarding." },
    { q: "Are your nannies trained and background-checked?", a: "Yes. Every nanny is vetted with police clearance, reference checks, infant CPR certification, and a Medic Connect interview before placement. We carry professional indemnity insurance on all placements." },
    { q: "Do you offer live-in or live-out nannies?", a: "Both. We match live-in nannies for families needing overnight cover and live-out nannies for daytime care. Schedules are agreed in writing during your assessment." },
    { q: "How quickly can a nanny start?", a: "Most nanny placements in Lagos are confirmed within 48 hours of your assessment, depending on requirements and availability." },
  ];

/** No nanny fee is published, so the cost question stays off the page until one is (see the fees panel). */
const shownFaqs = nannyFaqs.filter((f) => !/cost/i.test(f.q));

/** Nanny and childcare on the shared service layout. No published fee: quoted after the assessment. */
const config: ServicePageConfig = {
  eyebrow: "Nanny and childcare in Lagos",
  headline: "The nanny you'd choose.",
  accentWord: 3,
  lead: "Most candidates don't make it past our checks. The ones who do are warm, trained, and the kind of person you'd want raising your child with you.",
  heroArt: [art.schoolRun],
  watermark: "o",
  serviceLine: "nanny_childcare",
  whatsappText: "Hi Medic Connect, I'm looking for a nanny.",
  facts: [
    { value: "48 hours", label: "Most placements confirmed within 48 hours of your assessment" },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Day or live-in", label: "Live-out day nannies and live-in nannies" },
  ],
  moment: {
    photo: nannyMoment,
    alt: "A Medic Connect nanny playing with a toddler",
    title: "A calmer house, a more confident child.",
    body: "Parents who actually get to rest. That's the brief, and the brief we're judged on.",
  },
  visit: {
    title: "An example day",
    intro: "Every family is different. This is what a day with a nanny can look like.",
    items: [
      { time: "7:30", title: "Arrives", text: "Breakfast, and the plan for the day." },
      { time: "9:00", title: "Play and learning", text: "Age-appropriate play that builds language, movement and confidence." },
      { time: "12:30", title: "Lunch and nap", text: "Meals to your routine, and naps on schedule." },
      { time: "15:00", title: "School run", text: "Pickup, a snack and homework support." },
      { time: "18:00", title: "Handover", text: "How the day went, before you take over." },
    ],
  },
  carer: {
    art: art.nannyReading,
    role: "Nanny",
    checks: [
      "Police clearance",
      "References checked",
      "Infant CPR certified",
      "Address verified",
      "Guarantor in place",
      "Interviewed by Medic Connect",
    ],
  },
  worries: [
    { worry: "What if the fit isn't right?", answer: "We replace, quickly and quietly." },
    { worry: "What if our nanny is off sick?", answer: "We send cover, so your day carries on." },
    { worry: "How quickly can a nanny start?", answer: "Most placements are confirmed within 48 hours of your assessment." },
    { worry: "Live-in or live-out?", answer: "Both. Schedules are agreed in writing at your assessment." },
  ],
  feeSkus: [],
  quoted: "Fees depend on the hours, live-in or live-out, and your children's ages, so we quote once we have met your family.",
  steps: [
    { title: "Tell us about your family", text: "Your children's ages, your schedule and anything special we should know." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit, before any care starts, covering matching and onboarding." },
    { title: "Meet your nanny", text: "We introduce matched candidates, and you choose." },
    { title: "Your nanny starts", text: "With check-ins from our team." },
  ],
  faqs: shownFaqs,
  cta: {
    headline: "Find the nanny you'd choose.",
    body: "Tell us about your children and your days, and we will start the search.",
    person: art.carerPlayBaby,
  },
};

const NannyChildcare = () => (
  <>
    <SEO title="Trained Nannies in Lagos | Vetted & Insured | Medic Connect" description="Trained nannies in Lagos, vetted with police clearance, infant CPR and references. Fees are quoted after a one-off ₦35,000 home assessment." path="/nanny-childcare" jsonLd={[{"@context":"https://schema.org","@type":"Service","name":"Nanny & Childcare","serviceType":"Childcare","provider":{"@type":"Organization","name":"Medic Connect","url":"https://www.medicconnect.co"},"areaServed":{"@type":"Place","name":"Lagos, Nigeria"},"description":"Trained, vetted and insured nannies matched to your family across Lagos.","url":"https://www.medicconnect.co/nanny-childcare"},{"@context":"https://schema.org","@type":"FAQPage","mainEntity":shownFaqs.map(f=>({"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}))}]} />
    <ServicePage c={config} />
  </>
);

export default NannyChildcare;
