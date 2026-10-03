import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { medicalBusinessSchema } from "@/lib/medical-schema";
import AudienceHero from "@/components/home/AudienceHero";
import AccreditationBadge from "@/components/home/AccreditationBadge";

import KitFlipCard, { KitService } from "@/components/home/KitFlipCard";
import CTASection from "@/components/CTASection";
import WelcomeIntake from "@/components/WelcomeIntake";
import { MessageCircle } from "lucide-react";

import careAtHomeImg from "@/assets/services/clinical-home-care.jpg";
import facilitiesImg from "@/assets/services/hospital-staffing-new.jpg";
import networkImg from "@/assets/services/hospital-locum-services.jpg";

const doors: KitService[] = [
  {
    eyebrow: "Families",
    title: "Care at home",
    description:
      "Nurses, nannies, eldercare and maternity support placed in your home across Lagos, usually within 48 hours.",
    href: "/care-at-home",
    image: careAtHomeImg,
    back: "navy",
    feature: true,
  },
  {
    eyebrow: "Facilities",
    title: "For facilities",
    description:
      "Clinical and support staff for hospitals, clinics and research sites, compliance cleared before they reach your ward.",
    href: "/for-facilities",
    image: facilitiesImg,
    back: "brand",
    feature: true,
  },
  {
    eyebrow: "Professionals",
    title: "Join the network",
    description:
      "Nurses, carers, doctors and allied health professionals. Get verified once and be matched to work that fits you.",
    href: "/join",
    image: networkImg,
    back: "outline",
    feature: true,
  },
];

const Home = () => (
  <div className="min-h-dvh bg-background animate-fade-in">
    <SEO
      title="Medic Connect | The Care Operating System for Nigeria"
      description="Care at home, healthcare staffing for facilities, and a verified network of nurses and carers. Medic Connect connects care across Lagos and Nigeria."
      path="/"
      jsonLd={[
        medicalBusinessSchema(),
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Medic Connect",
          url: "https://www.medicconnect.co",
          memberOf: {
            "@type": "Organization",
            name: "Healthcare Federation of Nigeria",
            url: "https://hfnigeria.com",
          },
          sameAs: ["https://flyingdoctorsnigeria.com"],
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Medic Connect",
          url: "https://www.medicconnect.co",
        },
      ]}
    />
    <MedicHeader />
    <WelcomeIntake />

    <AudienceHero variant="centred">
      <div className="relative mx-auto max-w-[900px] text-center">
        <AccreditationBadge className="absolute -top-6 -right-6 hidden lg:block xl:-right-20" />
        <p className="eyebrow text-muted-navy">Medic Connect</p>

        {/* Boxed typography: each word sits in its own half curve block. */}
        <h1 className="mt-6 block">
          <span className="sr-only">The care operating system</span>
          <span aria-hidden="true" className="flex flex-col items-center gap-2.5 sm:gap-3">
            <span className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <span className="kit-pill kit-curve-sm sm:kit-curve inline-block border-[1.5px] border-outline-navy px-4 py-2 text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white transition-colors duration-300 hover:bg-white/5 sm:px-6 sm:py-3 sm:text-[56px]">
                The
              </span>
              <span className="kit-pill kit-curve-sm sm:kit-curve inline-block bg-brand px-4 py-2 text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white sm:px-6 sm:py-3 sm:text-[56px]">
                care
              </span>
            </span>
            <span className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              <span className="kit-pill kit-curve-sm sm:kit-curve inline-block border-[1.5px] border-outline-navy px-4 py-2 text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white transition-colors duration-300 hover:bg-white/5 sm:px-6 sm:py-3 sm:text-[56px]">
                operating
              </span>
              <span className="kit-pill kit-curve-sm sm:kit-curve inline-block border-[1.5px] border-outline-navy px-4 py-2 text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white transition-colors duration-300 hover:bg-white/5 sm:px-6 sm:py-3 sm:text-[56px]">
                system
              </span>
            </span>
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-[48ch] text-[18px] leading-[1.6] text-body-navy sm:text-[21px]">
          Three ways in. Choose the one that fits you.
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
        <p className="mt-8 text-[14px] text-body-navy lg:hidden">
          HEFAMAA accredited. Insured. Every professional vetted.
        </p>
      </div>
    </AudienceHero>


    <main className="mx-auto max-w-[1440px] px-[22px] py-16 sm:px-[50px] sm:py-20">
      <section aria-label="Where to start">
        <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
          {doors.map((door) => (
            <KitFlipCard key={door.href} {...door} />
          ))}
        </div>
      </section>

      <CTASection
        headline="Not sure which door is yours?"
        body="Tell us what you need and we will point you to the right team."
      />
    </main>

    <Footer />
  </div>
);

export default Home;
