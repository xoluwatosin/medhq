import SEO from "@/components/SEO";
import { medicalServiceSchema, faqSchema } from "@/lib/medical-schema";
import ServicePage, { type ServicePageConfig } from "@/components/mc/ServicePage";
import { art } from "@/components/mc/art";
import postnatalMoment from "@/assets/photos/postnatal-moment.webp";

/** The questions families ask; shown on the page and sent to Google as FAQ data. */
const faqs = [{
    q: "Is this Omugwo care?",
    a: "Yes. We honour the tradition: a trained woman in the home cooking, bathing baby, watching over Mama and helping the household rest. The difference is professional vetting, infant CPR, lactation know-how and discreet clinical screening for Mama and baby. We complement family, never replace them."
  }, {
    q: "My mother or mother-in-law is coming. Do we still need you?",
    a: "Often, yes — alongside her, not instead of her. Many families book us for overnight care so grandma can sleep, or for the weeks after she returns home. We work to her preferences and recipes."
  }, {
    q: "Can this be sent as a gift from abroad?",
    a: "Yes. Many of our diaspora clients gift postnatal and Omugwo packages to sisters, daughters or friends in Lagos. We coordinate with the family on the ground, send per-visit reports on WhatsApp, and bill you directly."
  }, {
    q: "How do you screen for postnatal depression?",
    a: "Our Care Specialists are trained to spot signs of postnatal depression and anxiety (which affects roughly 1 in 4 Nigerian mothers). With your consent, we flag concerns early and connect you to a clinician in our network."
  }, {
    q: "I have support requests that aren't listed in the sample schedule. Will they be available?",
    a: "Yes, every care plan is customised. Let us know your specific needs during consultation."
  }, {
    q: "Can I speak to my night nurse or care specialist before my services begin?",
    a: "Absolutely. We arrange introductions on WhatsApp or in person so you can confirm fit before care starts."
  }, {
    q: "What if I need to change my care specialist?",
    a: "We'll work with you to find a better match at no additional charge."
  }, {
    q: "Do you provide care for twins or multiples?",
    a: "Yes. We'll recommend an adjusted care plan and may suggest additional support."
  }];

/** Omugwo and postnatal care on the shared service layout. Fees from the published list (PUB- SKUs). */
const config: ServicePageConfig = {
  eyebrow: "Omugwo and postnatal care in Lagos",
  headline: "The care your mother would give.",
  accentWord: 3,
  lead: "Trained Care Specialists in your home so Mama can sleep, heal and bond with baby. Loved ones welcome alongside, never replaced.",
  heroArt: [art.postnatalSpecialist],
  watermark: "inf",
  serviceLine: "postnatal",
  whatsappText: "Hi Medic Connect, I'd like to arrange postnatal care.",
  facts: [
    { value: "₦30,000", label: "Postnatal mother and baby visits", from: true },
    { value: "₦35,000", label: "One-off home assessment, before care starts" },
    { value: "Day or night", label: "Daytime and overnight cover" },
  ],
  moment: {
    photo: postnatalMoment,
    alt: "A grandmother, a mother and her baby laughing together at home",
    title: "Loved ones welcome, never replaced.",
    body: "Many families book us alongside grandma, not instead of her: overnight so she can sleep, or for the weeks after she returns home. We work to her preferences and recipes.",
  },
  visit: {
    title: "An example night",
    intro: "Every plan is different. This is what an overnight shift can look like.",
    items: [
      { time: "20:00", title: "Arrives and settles in", text: "Hears how the day went and how Mama is feeling." },
      { time: "22:00", title: "Baby to bed", text: "Bath, feed and settle, so Mama can sleep." },
      { time: "2:00", title: "Night feeds", text: "Brings baby to Mama to feed, or bottle feeds as agreed, then resettles." },
      { time: "6:00", title: "Mama's recovery", text: "A warm footbath or broth, and a quiet check on how she is healing." },
      { time: "7:30", title: "A note to you", text: "How the night went, on WhatsApp, before handing over." },
    ],
  },
  carer: {
    art: art.postnatalSpecialist2,
    role: "Postnatal care",
    checks: [
      "Identity checked",
      "Credentials checked",
      "Trained in infant CPR",
      "Breastfeeding and lactation know-how",
      "Introduced to you before care starts",
      "Not the right fit? We match someone else, at no extra charge",
    ],
  },
  worries: [
    { worry: "My mother is coming. Do we still need you?", answer: "Often, yes. Alongside her, so she can rest too." },
    { worry: "What if it is not a good fit?", answer: "We find a better match, at no extra charge." },
    { worry: "What about postnatal depression?", answer: "We are trained to spot the signs and, with your consent, connect you to a clinician." },
    { worry: "Can I send this as a gift from abroad?", answer: "Yes. We coordinate with family in Lagos and bill you directly." },
  ],
  feeSkus: ["PUB-POSTNATAL-VISIT", "PUB-BREASTFEEDING", "PUB-CSECTION-WOUND"],
  steps: [
    { title: "Tell us what you need", text: "Your due date or baby's age, and the support that would help most." },
    { title: "The home assessment", text: "A one-off ₦35,000 visit from a care coordinator, before any care starts." },
    { title: "Meet your specialist", text: "We introduce you on WhatsApp or in person, so you can confirm the fit." },
    { title: "Care begins", text: "Day or night, on the agreed schedule." },
  ],
  faqs,
  crossLink: {
    href: "/care-from-abroad",
    tag: "Sending care from abroad",
    title: "Gifting Omugwo to a sister or daughter in Lagos?",
    body: "We coordinate with the family on the ground, send updates on WhatsApp and bill you directly.",
    art: art.motherDaughterVideoCall,
  },
  cta: {
    headline: "Rest, heal and bond with your baby.",
    body: "Tell us your due date or when baby arrived, and we will plan the support around you.",
    person: art.motherMug,
  },
};

const PostnatalCare = () => (
  <>
    <SEO
            title="Omugwo & Postnatal Care in Lagos from ₦100,000 | Medic Connect"
            description="The care your mother would give, by trained professionals. Omugwo packages from ₦100,000, with overnight cover, lactation support, and quiet screening for postnatal depression."
            path="/postnatal-care"
            jsonLd={[
              medicalServiceSchema({
                name: "Omugwo & Postnatal Care",
                path: "/postnatal-care",
                description: "The care your mother would give, delivered by trained Care Specialists. Honouring the Nigerian Omugwo tradition with professional vetting, infant CPR and lactation support.",
                specialty: "Obstetric",
                audienceType: "New mothers and newborns in Lagos",
                includeDiaspora: true,
                relatedProcedures: [
                  "Omugwo postpartum care",
                  "Lactation and breastfeeding support",
                  "Newborn bathing and cord care",
                  "Postnatal depression screening",
                  "Post-Caesarean wound monitoring",
                  "Infant CPR-trained overnight cover",
                ],
                offers: {
                  lowPrice: 100000,
                  highPrice: 380000,
                  offerCount: 4,
                  description: "Omugwo packages from ₦100,000 (Light) to ₦380,000 (Full 24/7). Post-Caesarean Recovery package from ₦250,000.",
                },
              }),
              faqSchema(faqs),
            ]}
          />
    <ServicePage c={config} />
  </>
);

export default PostnatalCare;
