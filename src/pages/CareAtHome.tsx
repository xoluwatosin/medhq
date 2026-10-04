import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import AudienceHero from "@/components/home/AudienceHero";
import ServiceCards, { type ServiceCard } from "@/components/mc/ServiceCards";
import { art } from "@/components/mc/art";
import CTASection from "@/components/CTASection";
import { KitMain, kitHeroPrimaryButton, kitHeroSecondaryButton } from "@/components/kit/KitLayout";
import { ClipArt, Highlight } from "@/components/mc/brand";
import { MessageCircle } from "lucide-react";

import KitPillHeading from "@/components/kit/KitPillHeading";

/**
 * The care at home service lines with starting prices from the published price
 * list (src/content/seo/governed-modules.ts). An empty price means none is
 * published; the card says it is quoted after assessment.
 */
const homeServices: ServiceCard[] = [
  { title: "Clinical home care", line: "Skilled nursing and medical support at home.", href: "/clinical-home-care", price: "₦20,000", unit: "per visit", art: art.proNurseKit },
  { title: "Post-surgical care", line: "Wounds, drains, medication and mobility after surgery.", href: "/post-surgical-care", price: "₦25,000", unit: "per visit", art: art.objWalkingFrame },
  { title: "Antenatal care", line: "Pregnancy checks and support at home.", href: "/antenatal-care", price: "₦30,000", unit: "per visit", art: art.midwifePregnantBp },
  { title: "Postnatal care and Omugwo", line: "Rest, recover and bond with your baby.", href: "/postnatal-care", price: "₦30,000", unit: "per visit", art: art.proPostnatal },
  { title: "Nanny and childcare", line: "Trusted nannies matched to your family.", href: "/nanny-childcare", price: "", art: art.nannyReading },
  { title: "Paediatric and additional needs", line: "Support for children with medical or developmental needs.", href: "/pediatric-care", price: "", art: art.charBoy },
  { title: "Eldercare", line: "Dignified care that keeps older relatives independent.", href: "/eldercare", price: "₦18,000", unit: "per 4 hours", art: art.charGrandma },
  // /caregiver owns the "hire a caregiver" search; this page owns home care in
  // general, so it links down rather than competing for the same query.
  { title: "Caregivers", line: "Personal care, company and appointment escort.", href: "/caregiver", price: "₦18,000", unit: "per 4 hours", art: art.charCaregiver },
  { title: "Care from abroad", line: "One contact in Nigeria for families overseas.", href: "/care-from-abroad", price: "", art: art.diasporaSon },
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
            className={kitHeroPrimaryButton}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Chat on WhatsApp
          </a>
          <a
            href="tel:+2348126988237"
            className={kitHeroSecondaryButton}
          >
            Call +234 812 698 8237
          </a>
        </div>
      </div>
    </AudienceHero>

    <KitMain>
      <section aria-labelledby="services-heading">
        <div className="relative mb-10 grid items-end gap-6 border-t-4 border-navy pt-8 lg:mb-14 lg:grid-cols-[minmax(0,1fr)_220px] lg:pt-10">
          <div>
            <h2 id="services-heading" className="text-[42px] leading-[1.08] tracking-[-0.055em] sm:text-[56px] lg:text-[72px] lg:leading-[0.96]">
              Care <Highlight>at home</Highlight> services
            </h2>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-[1.65] text-body sm:text-[18px]">
              Services may begin with a care needs assessment.
            </p>
          </div>
          <ClipArt src={art.objHouseHeart} size={200} className="hidden lg:block" />
        </div>
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
