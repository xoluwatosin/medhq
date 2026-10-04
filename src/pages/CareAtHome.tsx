import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import AudienceHero from "@/components/home/AudienceHero";
import KitFlipCard, { KitService } from "@/components/home/KitFlipCard";
import CTASection from "@/components/CTASection";
import { KitMain, KitSection } from "@/components/kit/KitLayout";
import { MessageCircle } from "lucide-react";

import clinicalImg from "@/assets/services/clinical-home-care.jpg";
import postOpImg from "@/assets/services/post-operative.jpg";
import abroadImg from "@/assets/hero/clinical-hero.jpg";
import antenatalImg from "@/assets/services/antenatal-care.jpg";
import postnatalImg from "@/assets/services/postnatal-care.jpg";
import nannyImg from "@/assets/services/nanny-childcare.jpg";
import eldercareImg from "@/assets/services/eldercare.jpg";
import pediatricImg from "@/assets/services/pediatric-care.jpg";
import caregiverImg from "@/assets/services/eldercare-companionship.jpg";
import KitPillHeading from "@/components/kit/KitPillHeading";

const homeServices: KitService[] = [
  {
    eyebrow: "Clinical",
    title: "Clinical home care",
    description:
      "Skilled nursing, chronic illness management and medical support, delivered at home by qualified healthcare professionals.",
    href: "/clinical-home-care",
    image: clinicalImg,
    back: "navy",
  },
  {
    eyebrow: "Recovery",
    title: "Post-surgical care at home",
    description:
      "Recover at home with skilled nurses managing wounds, drains, medication and mobility. Daily reports keep your surgeon and family in the loop.",
    href: "/post-surgical-care",
    image: postOpImg,
    back: "brand",
  },
  {
    eyebrow: "Diaspora",
    title: "Care from abroad",
    description:
      "Coordinating care for a loved one in Nigeria from overseas. Verified visits, photo documented reports and a single point of contact across time zones.",
    href: "/care-from-abroad",
    image: abroadImg,
    back: "tint",
  },
  {
    eyebrow: "Maternity",
    title: "Antenatal care at home",
    description:
      "Pregnancy monitoring at home: vitals checks, self testing support, telehealth appointments and education on nutrition, rest and warning signs.",
    href: "/antenatal-care",
    image: antenatalImg,
    back: "outline",
  },
  {
    eyebrow: "Maternity",
    title: "Postnatal care and Omugwo",
    description:
      "Rest, recover and bond with your baby. Professional postnatal support for new mothers and families, honouring traditional Nigerian care practices.",
    href: "/postnatal-care",
    image: postnatalImg,
    back: "brand",
  },
  {
    eyebrow: "Family",
    title: "Nanny and childcare",
    description:
      "Safe, reliable and personalised care for your children. Trusted nannies matched to your family's needs and values.",
    href: "/nanny-childcare",
    image: nannyImg,
    back: "navy",
  },
  {
    eyebrow: "Eldercare",
    title: "Eldercare and companion care",
    description:
      "Dignified care that helps seniors maintain independence and quality of life. Compassionate companions who treat your loved ones like family.",
    href: "/eldercare",
    image: eldercareImg,
    back: "outline",
  },
  {
    eyebrow: "Specialist",
    title: "Pediatric and special needs",
    description:
      "Specialised support for children with medical conditions and developmental needs. Trained caregivers who understand the challenges families face.",
    href: "/pediatric-care",
    image: pediatricImg,
    back: "tint",
  },
  // /caregiver owns the "hire a caregiver" search; this page owns home care in
  // general, so it links down rather than competing for the same query.
  {
    eyebrow: "Daily living",
    title: "Caregivers",
    description:
      "Vetted caregivers for personal care, companionship, mobility and appointment escort at home.",
    price: "Companion care from ₦18,000 per four hours",
    href: "/caregiver",
    image: caregiverImg,
    back: "navy",
  },
];

const CareAtHome = () => (
  <div className="min-h-dvh bg-background animate-fade-in">
    <SEO
      title="Care at Home in Lagos | Nurses, Nannies and Eldercare"
      description="Vetted nurses, nannies, eldercare and maternity support placed in your home across Lagos, usually within 48 hours. Every plan starts with a home care needs assessment."
      path="/care-at-home"
      jsonLd={[medicalBusinessSchema()]}
    />
    <MedicHeader />

    <AudienceHero variant="centred">
      <div className="mx-auto max-w-[820px] text-center">
        <p className="eyebrow text-muted-navy">Care at home</p>
        <KitPillHeading text="Care that comes to your door" accent={[0]} align="centre" className="mt-5" />
        <p className="mx-auto mt-6 max-w-[54ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
          Vetted nurses, nannies and carers placed in your home, usually within 48 hours. So you can stop carrying it all on your own.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="https://wa.me/2348126988237"
            target="_blank"
            rel="noopener noreferrer"
            className="kit-curve-sm inline-flex items-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity duration-200 hover:opacity-90"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Chat on WhatsApp
          </a>
          <a
            href="tel:+2348126988237"
            className="kit-curve-sm inline-flex items-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-hairline-navy"
          >
            Call +234 812 698 8237
          </a>
        </div>
      </div>
    </AudienceHero>

    <KitMain>
      <KitSection eyebrow="Services" title="Care at home services" intro="Every plan begins with a home care needs assessment, then we match a vetted professional to the household.">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {homeServices.map((service) => (
            <KitFlipCard key={service.href} {...service} />
          ))}
        </div>
      </KitSection>

      <CTASection
        headline="Ready to arrange care at home?"
        body="Tell us who needs support and we will book the assessment and match the right professional."
      />
    </KitMain>

    <Footer />
  </div>
);

export default CareAtHome;
