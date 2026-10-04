import MedicHeader from "@/components/MedicHeader";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { CarerID, Watermark } from "@/components/mc/brand";
import Credentials from "@/components/mc/Credentials";
import { SectionHead } from "@/components/mc/service-sections";
import { art } from "@/components/mc/art";
import { cn } from "@/lib/utils";
import aboutMoment from "@/assets/photos/about-moment.webp";

/**
 * About: who we are, why we exist, what we stand for and how we check every
 * professional. The words are the page's existing copy; the FAQs are also
 * sent to Google as FAQ data.
 */
const values = [
  { title: "Dignity", description: "Every person (patient, caregiver, or client) deserves respect. We treat everyone with care and honour Nigerian cultural values." },
  { title: "Trust", description: "Healthcare is personal. We earn trust through rigorous vetting, transparent communication and consistent follow-through." },
  { title: "Excellence", description: "Good enough isn't good enough. We hold ourselves and our professionals to high standards because lives depend on it." },
  { title: "Compassion", description: "Behind every service request is a human being in need. We lead with empathy in every interaction." },
];

const storyParagraphs = [
  "Medic Connect was founded to solve a problem many Nigerian families know too well: the struggle to find reliable, professional healthcare support when you need it most.",
  "Whether it's a parent recovering from surgery, a new mother needing postnatal support, an elderly relative requiring daily assistance, or a hospital facing staffing shortages, the challenge is the same.",
  "We built Medic Connect to change that. We connect families with skilled caregivers and healthcare facilities with qualified professionals: quickly, reliably, and with full accountability.",
];

const vettingSteps = [
  { title: "Identity and address verification", description: "Government ID, proof of address and biometric checks before anyone enters a client's home." },
  { title: "Background and guarantor checks", description: "Criminal record screening plus verified guarantors who vouch for the carer's character and history." },
  { title: "Licensing and nursing registration", description: "We verify nursing council registration and professional licences directly with the relevant Nigerian regulator." },
  { title: "Skills training and CPR", description: "Onboarding training in clinical care, child safety, infection control and CPR. Refresher training throughout the year." },
  { title: "HEFAMAA accreditation and insurance", description: "Medic Connect is accredited by HEFAMAA (Lagos) and fully insured, so families are protected end to end." },
  { title: "HFN membership and Flying Doctors partnership", description: "Member of the Healthcare Federation of Nigeria and partner of Flying Doctors Nigeria for emergency escalation." },
];

const faqs = [
  { q: "What is Medic Connect?", a: "Medic Connect is The Care Operating System: a Lagos-based platform that places vetted nurses, carers, nannies and clinical staff in homes and hospitals across Nigeria." },
  { q: "Where do you operate?", a: "In select parts of Nigeria, with our head office in Lagos. We also work with diaspora families in the UK, US, Canada and EU who are arranging care for loved ones in Lagos." },
  { q: "How quickly can you place a carer?", a: "Most placements are confirmed within 48 hours of the initial consultation." },
  { q: "How much does care cost?", a: "Postnatal and Omugwo care starts from NGN 100,000 to 300,000 per week. Other services are quoted based on hours, clinical complexity and live-in versus live-out. Contact us for a tailored quote." },
  { q: "Are you accredited?", a: "Yes. Medic Connect is accredited by the Health Facility Monitoring and Accreditation Agency (HEFAMAA) of Lagos State, fully insured, a member of the Healthcare Federation of Nigeria and a partner of Flying Doctors Nigeria." },
  { q: "How do you vet your carers?", a: "Every carer goes through identity and address verification, guarantor checks, criminal background screening, licensing verification, clinical and safety training, CPR certification and ongoing supervision." },
  { q: "Can families abroad arrange care for parents in Lagos?", a: "Yes. Our Care from Abroad service is built for diaspora families: per-visit WhatsApp reports, scheduling across time zones and international billing." },
  { q: "How is your postnatal care different from traditional Omugwo?", a: "We honour Omugwo. We provide hot baths, abdominal massage, sitz baths, pepper soup with uziza and uda, breastfeeding support and household help, but delivered by trained nurses with clinical safety standards, so nothing accidentally harms mother or baby." },
  { q: "Do you support post-surgical recovery at home?", a: "Yes. Dedicated post-surgical nursing covers wound care, medication timing, complications monitoring and fall prevention in the critical days after hospital discharge." },
  { q: "How do I get started?", a: "Message us on WhatsApp at +234 812 698 8237, call the same number or email hello@medicconnect.co. We'll book a short consultation and arrange a home assessment." },
];

const VALUE_ART = [art.objHandsHeart, art.objShieldCheck, art.objAccreditationCertificate, art.objHeartbeat];
const TILTS = [-1.1, 0.8, -0.6, 1];

const facts = [
  { value: "Nigeria", label: "In select parts of Nigeria, with our head office in Lagos" },
  { value: "HEFAMAA", label: "Accredited by Lagos State's health facility regulator" },
  { value: "HFN", label: "Member of the Healthcare Federation of Nigeria" },
];

const MedicAbout = () => (
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

    <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px]">
      <Watermark glyph="full" size={520} opacity={0.12} className="-right-[140px] -top-[60px]" />
      <div className="relative mx-auto max-w-[1440px] px-[22px] pb-[120px] sm:px-[50px] lg:pb-[150px]">
        <div className="max-w-[60%] sm:max-w-[64%] lg:max-w-[720px]">
          <p className="eyebrow !text-brand-soft">About us</p>
          <div className="mt-3 lg:mt-4">
            <KitPillHeading text="Bridging the gap in healthcare." accent={[4]} align="left" />
          </div>
          <p className="mt-5 text-[15px] leading-[1.55] text-body-navy sm:text-[18px] lg:max-w-[48ch] lg:text-[20px]">
            We exist to bring professional, compassionate care to homes and healthcare facilities across Nigeria.
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-[90px] right-3 flex max-w-[36%] items-end justify-end sm:right-[40px] lg:bottom-[110px] lg:right-[100px] lg:max-w-none">
          {[art.charCaregiver, art.proDoctor, art.proNurseKit].map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              // Phones show one figure, so the group never runs under the text.
              className={cn("h-[200px] object-contain sm:h-[260px] lg:h-[330px]", i > 0 && "-ml-8 hidden lg:-ml-10 lg:block")}
            />
          ))}
        </div>
      </div>
    </section>

    <KitMain className="relative -mt-[96px] pt-0 lg:-mt-[100px]">
      {/* At a glance, hanging from the hero. */}
      <section aria-label="At a glance">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-7">
          {facts.map((f, i) => (
            <li
              key={f.value}
              style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
              className={cn(
                "mc-tilt flex items-center gap-4 border-2 border-navy px-5 py-4 lg:flex-col lg:items-start lg:gap-1 lg:px-6 lg:py-5",
                i === 1 ? "bg-tint shadow-offset" : i === 2 ? "bg-white shadow-offset-blue" : "bg-white shadow-offset",
              )}
            >
              <b className="shrink-0 text-[21px] font-black tracking-[-0.04em] text-navy lg:text-[34px]">{f.value}</b>
              <span className="min-w-0 text-[14px] font-bold leading-[1.35] text-body lg:text-[15px]">{f.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Our story beside a real photo, then the mission. */}
      <section aria-labelledby="story-heading" className="mt-20 grid items-center gap-10 lg:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <figure className="relative mx-auto w-full max-w-[520px] rotate-[-2deg] bg-white p-3 pb-4 shadow-offset lg:mx-0">
          <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[3deg] bg-tint-deep/80" />
          <img src={aboutMoment} alt="Medic Connect nurses and a doctor in a training session" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        </figure>
        <div>
          <hr className="mb-6 border-t-4 border-navy" />
          <p className="eyebrow">Why we exist</p>
          <h2 id="story-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] sm:text-[44px]">
            Our story
          </h2>
          <div className="mt-6 space-y-4">
            {storyParagraphs.map((p) => (
              <p key={p} className="max-w-[60ch] text-[17px] leading-[1.7] text-body">
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="mission-heading" className="relative mt-16 overflow-hidden bg-navy px-6 py-10 shadow-offset-blue sm:px-12 sm:py-14 lg:mt-20">
        <Watermark glyph="o" size={360} opacity={0.12} className="-right-[110px] -top-[120px]" />
        <p className="eyebrow relative !text-brand-soft">Our mission</p>
        <h2 id="mission-heading" className="relative mt-4 max-w-[30ch] text-[24px] leading-[1.25] tracking-[-0.035em] !text-white sm:text-[34px]">
          To provide accessible, professional and compassionate healthcare services that improve quality of life for
          individuals and strengthen healthcare delivery across Nigeria.
        </h2>
      </section>

      {/* What we stand for. */}
      <section aria-labelledby="values-heading" className="mt-20 lg:mt-28">
        <SectionHead id="values-heading" eyebrow="What we stand for" title="Our values" />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {values.map((v, i) => (
            <li
              key={v.title}
              style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
              className={cn("mc-tilt flex flex-col gap-3 border-2 border-navy bg-white p-5", i % 2 ? "shadow-offset-blue" : "shadow-offset")}
            >
              <div className="grid h-[72px] w-[72px] place-items-center bg-tint">
                <img src={VALUE_ART[i % VALUE_ART.length]} alt="" loading="lazy" className="h-[58px] w-[58px] object-contain" />
              </div>
              <h3 className="text-[21px] leading-[1.1] tracking-[-0.035em]">{v.title}</h3>
              <p className="text-[15px] leading-[1.6] text-body">{v.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How we check every professional. */}
      <section aria-labelledby="vetting-heading" className="mt-20 grid items-start gap-10 lg:mt-28 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-20">
        <div className="flex justify-center pt-8 lg:sticky lg:top-32 lg:justify-start">
          <CarerID name="Every professional" role="Medic Connect" src={art.charNurse} tilt={-3} />
        </div>
        <div>
          <hr className="mb-6 border-t-4 border-navy" />
          <p className="eyebrow">How we vet</p>
          <h2 id="vetting-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] sm:text-[44px]">
            Checked before they reach you.
          </h2>
          <ol className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {vettingSteps.map((v, i) => (
              <li key={v.title} className="flex gap-4">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center text-[18px] font-black text-white shadow-offset-sm", i % 2 ? "bg-navy" : "bg-brand")}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[18px] leading-[1.2] tracking-[-0.03em]">{v.title}</h3>
                  <p className="mt-1 text-[15px] leading-[1.6] text-body">{v.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust-heading" className="mt-20 lg:mt-28">
        <SectionHead id="trust-heading" eyebrow="Accountable" title="Checked, licensed and accountable." />
        <Credentials />
        <p className="mt-8 text-[14px] text-muted-foreground">Registered companies: RC 15986218 (England and Wales), RC 8026476 (Nigeria).</p>
      </section>

      <section aria-labelledby="faq-heading" className="mt-20 lg:mt-28">
        <SectionHead id="faq-heading" eyebrow="Questions" title="Frequently asked questions" />
        <ul className="max-w-[860px] divide-y-2 divide-navy/10 border-y-2 border-navy/10">
          {faqs.map((f, i) => (
            <li key={f.q}>
              <details className="group py-1" open={i === 0}>
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-extrabold leading-[1.3] text-navy [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-[22px] font-black text-brand group-open:hidden">+</span>
                  <span aria-hidden="true" className="hidden text-[22px] font-black text-brand group-open:inline">−</span>
                </summary>
                <p className="max-w-[70ch] pb-4 text-[16px] leading-[1.65] text-body">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <CTASection
        headline="Care, connected."
        body="Whether you need care at home or professionals for your facility, tell us what you need and we will take it from there."
        person={art.doctorNurseHandshake}
      />
    </KitMain>

    <Footer />
  </div>
);

export default MedicAbout;
