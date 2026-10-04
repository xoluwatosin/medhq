import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import ServiceCards, { type ServiceCard } from "@/components/mc/ServiceCards";
import { art } from "@/components/mc/art";
import CTASection from "@/components/CTASection";
import { KitMain } from "@/components/kit/KitLayout";
import { Watermark } from "@/components/mc/brand";

import KitPillHeading from "@/components/kit/KitPillHeading";

/**
 * The care at home service lines with starting prices from the published price
 * list (src/content/seo/governed-modules.ts). An empty price means none is
 * published; the card says it is quoted after assessment.
 */
const homeServices: ServiceCard[] = [
  { title: "Clinical home care", line: "Skilled nursing and medical support at home.", href: "/clinical-home-care", price: "₦18,000", art: art.proNurseKit },
  { title: "Post-surgical care", line: "Wounds, drains, medication and mobility after surgery.", href: "/post-surgical-care", price: "₦20,000", art: art.objWalkingFrame },
  { title: "Antenatal care", line: "Pregnancy checks and support at home.", href: "/antenatal-care", price: "₦30,000", art: art.midwifePregnantBp },
  { title: "Postnatal care and Omugwo", line: "Rest, recover and bond with your baby.", href: "/postnatal-care", price: "₦20,000", art: art.proPostnatal },
  { title: "Nanny and childcare", line: "Trusted nannies matched to your family.", href: "/nanny-childcare", price: "", art: art.nannyReading },
  { title: "Paediatric and additional needs", line: "Support for children with medical or developmental needs.", href: "/pediatric-care", price: "", art: art.charBoy },
  { title: "Eldercare", line: "Dignified care that keeps older relatives independent.", href: "/eldercare", price: "₦18,000", art: art.charGrandma },
  // /caregiver owns the "hire a caregiver" search; this page owns home care in
  // general, so it links down rather than competing for the same query.
  { title: "Caregivers", line: "Personal care, company and appointment escort.", href: "/caregiver", price: "₦18,000", art: art.charCaregiver },
  { title: "Care from abroad", line: "One contact in Nigeria for families overseas.", href: "/care-from-abroad", price: "", art: art.diasporaSon },
];

const lead =
  "Vetted nurses, nannies and carers placed in your home, usually within 48 hours. Services may begin with a ₦35,000 care needs assessment.";

const CareAtHome = () => (
  <div className="min-h-dvh bg-background animate-fade-in">
    <SEO
      title="Care at Home in Lagos | Nurses, Nannies and Eldercare"
      description="Vetted nurses, nannies, eldercare and maternity support placed in your home across Lagos, usually within 48 hours. Every plan starts with a home care needs assessment."
      path="/care-at-home"
      jsonLd={[medicalBusinessSchema()]}
    />
    <MedicHeader />

    {/* Shorter navy hero; on desktop the first row of service cards hangs across
        its bottom edge, the way the home page doors do. */}
    {/* Phones and tablets (design 1): the boxed headline aligned left, the
        paragraph beside the family at the door, and the first row of tiles
        rising over the band's bottom edge. */}
    <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px] lg:hidden">
      <Watermark glyph="o" size={360} opacity={0.12} className="-right-[150px] -top-[90px]" />
      <div className="relative mx-auto max-w-[720px] px-[22px] pb-[86px] sm:px-[50px]">
        {/* On tablets the illustration is taller, so the headline keeps to its left. */}
        <div className="sm:max-w-[60%]">
          <KitPillHeading text="Care that comes to your door" accent={[0]} align="left" />
        </div>
        <p className="mt-5 max-w-[54%] text-[15px] leading-[1.55] text-body-navy sm:max-w-[48%] sm:text-[18px]">{lead}</p>
        <img
          src={art.familyDoorNurse}
          alt=""
          className="pointer-events-none absolute bottom-[70px] right-2 h-[170px] max-w-[44%] object-contain object-right-bottom sm:right-[50px] sm:h-[230px]"
        />
      </div>
    </section>

    {/* Desktop: shorter navy hero; the first row of service cards hangs across
        its bottom edge, the way the home page doors do. */}
    <section className="relative -mt-[114px] hidden overflow-hidden bg-navy pt-[150px] lg:block">
      <Watermark glyph="o" size={620} opacity={0.12} className="-right-[220px] -top-[160px]" />
      <div className="relative mx-auto max-w-[920px] px-[50px] pb-[200px] text-center">
        {/* Only one hero shows at a time; the hidden one is display:none, so the page has one visible h1. */}
        <KitPillHeading text="Care that comes to your door" accent={[0]} align="centre" />
        <p className="mx-auto mt-6 max-w-[58ch] text-[20px] leading-[1.6] text-body-navy">{lead}</p>
      </div>
    </section>

    <KitMain className="relative -mt-[64px] pt-0 lg:-mt-[160px]">
      <section aria-labelledby="services-heading" className="relative">
        {/* The line the first row of cards hangs from. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-[2px] hidden h-[3px] bg-brand-soft lg:block" />
        {/* The hero carries the page heading; this one is for screen readers and the outline. */}
        <h2 id="services-heading" className="sr-only">
          Care at home services
        </h2>
        <ServiceCards services={homeServices} />
      </section>

      <CTASection
        headline="Ready to arrange care at home?"
        body="Tell us who needs support and we will book the assessment and match the right professional."
      />
    </KitMain>

    <Footer />
  </div>
);

export default CareAtHome;
