import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import AudienceHero from "@/components/home/AudienceHero";
import { KitMain, KitSection, KitPanel, KitFacts } from "@/components/kit/KitLayout";
import {
  Heart,
  Shield,
  Sparkles,
  Users,
  FileCheck,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
  Handshake,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import KitPillHeading from "@/components/kit/KitPillHeading";

const MedicAbout = () => {
  const values = [
    { title: "Dignity", description: "Every person (patient, caregiver, or client) deserves respect. We treat everyone with care and honour Nigerian cultural values.", icon: Heart },
    { title: "Trust", description: "Healthcare is personal. We earn trust through rigorous vetting, transparent communication and consistent follow-through.", icon: Shield },
    { title: "Excellence", description: "Good enough isn't good enough. We hold ourselves and our professionals to high standards because lives depend on it.", icon: Sparkles },
    { title: "Compassion", description: "Behind every service request is a human being in need. We lead with empathy in every interaction.", icon: Users },
  ];

  const storyParagraphs = [
    "Medic Connect was founded to solve a problem many Nigerian families know too well: the struggle to find reliable, professional healthcare support when you need it most.",
    "Whether it's a parent recovering from surgery, a new mother needing postnatal support, an elderly relative requiring daily assistance, or a hospital facing staffing shortages, the challenge is the same.",
    "We built Medic Connect to change that. We connect families with skilled caregivers and healthcare facilities with qualified professionals: quickly, reliably, and with full accountability.",
  ];

  const vettingSteps = [
    { title: "Identity and address verification", description: "Government ID, proof of address and biometric checks before anyone enters a client's home.", icon: FileCheck },
    { title: "Background and guarantor checks", description: "Criminal record screening plus verified guarantors who vouch for the carer's character and history.", icon: UserCheck },
    { title: "Licensing and nursing registration", description: "We verify nursing council registration and professional licences directly with the relevant Nigerian regulator.", icon: Stethoscope },
    { title: "Skills training and CPR", description: "Onboarding training in clinical care, child safety, infection control and CPR. Refresher training throughout the year.", icon: GraduationCap },
    { title: "HEFAMAA accreditation and insurance", description: "Medic Connect is accredited by HEFAMAA (Lagos) and fully insured, so families are protected end to end.", icon: ShieldCheck },
    { title: "HFN membership and Flying Doctors partnership", description: "Member of the Healthcare Federation of Nigeria and partner of Flying Doctors Nigeria for emergency escalation.", icon: Handshake },
  ];

  const faqs = [
    { q: "What is Medic Connect?", a: "Medic Connect is The Care Operating System: a Lagos-based platform that places vetted nurses, carers, nannies and clinical staff in homes and hospitals across Nigeria." },
    { q: "Where do you operate?", a: "Lagos, Nigeria. We also work with diaspora families in the UK, US, Canada and EU who are arranging care for loved ones in Lagos." },
    { q: "How quickly can you place a carer?", a: "Most placements are confirmed within 48 hours of the initial consultation." },
    { q: "How much does care cost?", a: "Postnatal and Omugwo care starts from NGN 100,000 to 300,000 per week. Other services are quoted based on hours, clinical complexity and live-in versus live-out. Contact us for a tailored quote." },
    { q: "Are you accredited?", a: "Yes. Medic Connect is accredited by the Health Facility Monitoring and Accreditation Agency (HEFAMAA) of Lagos State, fully insured, a member of the Healthcare Federation of Nigeria and a partner of Flying Doctors Nigeria." },
    { q: "How do you vet your carers?", a: "Every carer goes through identity and address verification, guarantor checks, criminal background screening, licensing verification, clinical and safety training, CPR certification and ongoing supervision." },
    { q: "Can families abroad arrange care for parents in Lagos?", a: "Yes. Our Care from Abroad service is built for diaspora families: per-visit WhatsApp reports, scheduling across time zones and international billing." },
    { q: "How is your postnatal care different from traditional Omugwo?", a: "We honour Omugwo. We provide hot baths, abdominal massage, sitz baths, pepper soup with uziza and uda, breastfeeding support and household help, but delivered by trained nurses with clinical safety standards, so nothing accidentally harms mother or baby." },
    { q: "Do you support post-surgical recovery at home?", a: "Yes. Dedicated post-surgical nursing covers wound care, medication timing, complications monitoring and fall prevention in the critical days after hospital discharge." },
    { q: "How do I get started?", a: "Message us on WhatsApp at +234 812 698 8237, call the same number or email hello@medicconnect.co. We'll book a short consultation and arrange a home assessment." },
  ];

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO
        title="About Medic Connect | The Care Operating System"
        description="Our mission, vetting standards, accreditations, and frequently asked questions about home care and clinical staffing across Nigeria."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
        }}
      />
      <MedicHeader />

      <AudienceHero variant="split">
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-end">
          <div className="max-w-[600px]">
            <p className="eyebrow text-muted-navy">About us</p>
            <KitPillHeading text="Bridging the gap in healthcare" accent={[0]} align="left" className="mt-4" />
            <p className="mt-5 max-w-[54ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
              We exist to bring professional, compassionate care to homes and healthcare facilities across Nigeria.
            </p>
          </div>
          <div className="kit-curve border border-hairline-navy p-6">
            <p className="label-caps !text-muted-navy">At a glance</p>
            <dl className="mt-4 divide-y divide-hairline-navy">
              {[
                { label: "Based in", value: "Lagos, Nigeria" },
                { label: "Accredited by", value: "HEFAMAA, Lagos State" },
                { label: "Member of", value: "Healthcare Federation of Nigeria" },
                { label: "Partner", value: "Flying Doctors Nigeria" },
              ].map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-[14px] text-muted-navy">{f.label}</dt>
                  <dd className="text-right text-[15px] font-semibold text-white">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </AudienceHero>

      <KitMain>
        {/* Magazine feature: story runs alongside the mission panel. */}
        <KitSection title="Our story" eyebrow="Why we exist">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-14">
            <div className="space-y-5">
              {storyParagraphs.map((paragraph) => (
                <p key={paragraph} className="text-[17px] leading-[1.75] text-body">
                  {paragraph}
                </p>
              ))}
            </div>
            <KitPanel tone="tint" className="h-fit">
              <p className="label-caps text-label">Our mission</p>
              <p className="mt-3 text-[17px] leading-[1.7] text-ink">
                To provide accessible, professional and compassionate healthcare services that improve quality of life
                for individuals and strengthen healthcare delivery across Nigeria.
              </p>
            </KitPanel>
          </div>
        </KitSection>

        <KitSection title="Our values" eyebrow="How we work">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            {values.map((value) => (
              <KitPanel key={value.title}>
                <value.icon className="h-6 w-6 text-brand" aria-hidden="true" />
                <h3 className="mt-4 text-[19px] font-semibold text-ink">{value.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-body">{value.description}</p>
              </KitPanel>
            ))}
          </div>
        </KitSection>

        <KitSection
          title="How we vet every carer"
          eyebrow="Standards"
          intro="Six checks every Medic Connect carer passes before they enter your home. The bar exists because your family is on the other side of it."
        >
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {vettingSteps.map((s, i) => (
              <KitPanel key={s.title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center border border-hairline-warm text-[14px] font-semibold text-brand">
                    {i + 1}
                  </span>
                  <s.icon className="h-5 w-5 text-brand" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold leading-[1.35] text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.7] text-body">{s.description}</p>
              </KitPanel>
            ))}
          </div>
        </KitSection>

        <KitSection title="Accreditation and cover" eyebrow="Proof">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-14">
            <KitFacts
              items={[
                { label: "Regulator", value: "Health Facility Monitoring and Accreditation Agency (HEFAMAA), Lagos State" },
                { label: "Insurance", value: "Fully insured for home and facility placements" },
                { label: "Membership", value: "Healthcare Federation of Nigeria" },
                { label: "Emergency escalation", value: "Flying Doctors Nigeria partnership" },
                { label: "Registration", value: "RC 15986218 (England and Wales), RC 8026476 (Nigeria)" },
              ]}
            />
            <KitPanel tone="navy" className="h-fit">
              <ShieldCheck className="h-8 w-8 text-outline-navy" aria-hidden="true" />
              <p className="mt-4 text-[19px] font-semibold text-white">HEFAMAA accredited</p>
              <p className="mt-2 text-[15px] leading-[1.7]">
                We operate in full compliance with Lagos State regulatory standards, so families and facilities are
                protected end to end.
              </p>
            </KitPanel>
          </div>
        </KitSection>

        <KitSection title="Frequently asked questions" eyebrow="Answers" narrow>
          <Accordion type="single" collapsible className="border-t border-hairline-warm">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="border-b border-hairline-warm">
                <AccordionTrigger className="py-5 text-left text-[17px] font-semibold text-ink hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-[16px] leading-[1.75] text-body">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </KitSection>

        <CTASection
          headline="Want to work with us?"
          body="Whether you need care or want to join our network of professionals, we would love to hear from you."
          primaryButton={{ text: "Contact us", href: "/contact" }}
          secondaryButton={{ text: "Join our network", href: "/join" }}
        />
      </KitMain>
      <Footer />
    </div>
  );
};

export default MedicAbout;
