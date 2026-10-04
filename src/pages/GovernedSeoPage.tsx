import { useLocation, Link } from "react-router-dom";
import { HeartHandshake, MessageCircle } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import CTASection from "@/components/CTASection";
import { otherPersonThan } from "@/components/mc/people";
import CareRequestDialog from "@/components/CareRequestDialog";
import { kitHeroPrimaryButton, kitHeroSecondaryButton } from "@/components/kit/KitLayout";
import {
  AnswerPanel,
  AudienceNotes,
  IncludedCards,
  PriceTags,
  ProcessSteps,
  ServiceHero,
  WhyBand,
} from "@/components/mc/service-sections";
import { GOVERNED_PAGE_BY_PATH, type GovernedPage } from "@/content/seo/governed-pages";
import { PAGE_VISUALS } from "@/content/seo/page-visuals";
import { GOVERNED_FEES, GOVERNED_MODULES } from "@/content/seo/governed-modules";
import { art } from "@/components/mc/art";
import NotFound from "@/pages/NotFound";

const serviceSchema = (page: GovernedPage) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  name: page.h1,
  description: page.metaDescription,
  provider: {
    "@type": "Organization",
    name: "Medic Connect",
    url: "https://www.medicconnect.co",
  },
  areaServed: ["Lagos", "Abuja", "Ogun State", "Oyo State"].map((name) => ({ "@type": "Place", name })),
});

const breadcrumbSchema = (page: GovernedPage) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.medicconnect.co/" },
    { "@type": "ListItem", position: 2, name: page.h1, item: `https://www.medicconnect.co${page.path}` },
  ],
});

/** Pages addressed to candidates: they offer joining the network, never a care request. */
const CANDIDATE_PATHS = new Set(["/careers", "/careers/nursing"]);

/** Pages addressed to employers: they offer a staffing conversation, never joining the network. */
const EMPLOYER_PATHS = new Set(["/nurse-staffing", "/ngo-healthcare-staffing"]);

const heroTag = (path: string) =>
  CANDIDATE_PATHS.has(path)
    ? "Careers"
    : EMPLOYER_PATHS.has(path)
      ? "For facilities"
      : path.startsWith("/guides/")
        ? "Guide"
        : path === "/event-medical-cover"
          ? "For organisers"
          : "Care at home";

/** Approved, registry-backed reasons. No new claim is introduced here. */
const BENEFITS = [
  {
    title: "Licensed and accredited",
    description: "Licensed and accredited by HEFAMAA, with professional indemnity insurance and membership of the Healthcare Federation of Nigeria.",
  },
  {
    title: "Vetted professionals",
    description: "Identity, registration and qualification documents are collected and reviewed, with references, interview and competency assessment.",
  },
  {
    title: "Assessment first",
    description: "A formal assessment sets the care plan, the professionals required and the hours before care begins.",
  },
  {
    title: "Documented care",
    description: "Care is documented against the care plan and reviewed as circumstances change.",
  },
  {
    title: "Clear escalation",
    description: "Staff work to documented escalation procedures. Medic Connect is not an emergency service.",
  },
  {
    title: "Lagos, Abuja, Ogun and Oyo",
    description: "Care is arranged in the areas Medic Connect currently serves.",
  },
];

const GovernedSeoPage = () => {
  const { pathname } = useLocation();
  const page = GOVERNED_PAGE_BY_PATH[pathname];

  if (!page) return <NotFound />;

  const visuals = PAGE_VISUALS[page.path];
  const modules = page.moduleCodes.map((code) => GOVERNED_MODULES[code]).filter(Boolean);
  const fees = page.feeSkus.map((sku) => GOVERNED_FEES[sku]).filter(Boolean);
  const isCandidate = CANDIDATE_PATHS.has(page.path);
  const isEmployer = EMPLOYER_PATHS.has(page.path);

  const primaryAction = isCandidate ? (
    <Link to="/join" className={kitHeroPrimaryButton}>
      <HeartHandshake className="h-5 w-5" aria-hidden="true" />
      Join our network
    </Link>
  ) : isEmployer ? (
    <Link to="/contact" className={kitHeroPrimaryButton}>
      <HeartHandshake className="h-5 w-5" aria-hidden="true" />
      Discuss your staffing
    </Link>
  ) : (
    <CareRequestDialog
      source={`hero:${page.path}`}
      trigger={
        <button className={kitHeroPrimaryButton}>
          <HeartHandshake className="h-5 w-5" aria-hidden="true" />
          Request care
        </button>
      }
    />
  );

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title={page.title} description={page.metaDescription} path={page.path} jsonLd={[serviceSchema(page), breadcrumbSchema(page)]} />
      <MedicHeader />

      <ServiceHero
        tag={heroTag(page.path)}
        title={page.h1}
        promise={page.promise}
        image={visuals?.heroImage}
        actions={
          <>
            {primaryAction}
            <a href="https://wa.me/2348126988237" className={kitHeroSecondaryButton}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              WhatsApp us
            </a>
          </>
        }
      />

      <main className="mx-auto max-w-[1440px] px-[22px] py-14 sm:px-[50px] sm:py-20">
        {page.intro.length > 0 && <AnswerPanel
            heading="What this covers"
            paragraphs={page.intro}
            art={isCandidate ? art.objCalendar : isEmployer ? art.objClipboard : art.objCarePlan}
          />}

        {visuals && visuals.audience.length > 0 && (
          <AudienceNotes
            title={isCandidate ? "Who we engage" : isEmployer ? "Who we staff" : "Who this is for"}
            entries={visuals.audience}
          />
        )}

        {visuals && visuals.cards.length > 0 && (
          <IncludedCards
            title={isCandidate ? "Routes into work" : isEmployer ? "How we staff" : "What is included"}
            cards={visuals.cards}
          />
        )}

        {fees.length > 0 && <PriceTags fees={fees} />}

        {modules.length > 0 && <ProcessSteps modules={modules} />}

        <WhyBand
          eyebrow={isCandidate || isEmployer ? "Why work with us" : "Why families choose us"}
          reasons={BENEFITS}
          person={otherPersonThan(page.path, isCandidate ? art.charCaregiver : isEmployer ? art.charDoctor : art.charNurse)}
        />

        {isCandidate ? (
          <CTASection
            headline="Work with Medic Connect"
            body="Join the candidate pool or apply for an advertised opportunity."
            hideRequestCare
            primaryButton={{ text: "Join our network", href: "/join" }}
          />
        ) : isEmployer ? (
          <CTASection
            headline="Staff your service"
            body="Tell us the roles, the shifts and the location, and we will scope the cover."
            hideRequestCare
            primaryButton={{ text: "Contact us", href: "/contact" }}
          />
        ) : (
          <CTASection
            headline="Ready to arrange care?"
            body="Tell us what is needed and we will arrange the assessment."
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default GovernedSeoPage;
