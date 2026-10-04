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
  ChecklistSheet,
  ComparisonTable,
  IncludedCards,
  PriceTags,
  ProcessSteps,
  RelatedLinks,
  ServiceHero,
  WhyBand,
} from "@/components/mc/service-sections";
import { isExpansionIndexable } from "@/content/seo/index-policy";
import { EXPANSION_PAGE_BY_PATH, type ExpansionPage } from "@/content/seo/expansion-pages";
import { GOVERNED_FEES, GOVERNED_MODULES } from "@/content/seo/governed-modules";
import { art } from "@/components/mc/art";
import NotFound from "@/pages/NotFound";

const TALENT_TEMPLATES = new Set(["jobs", "staffing"]);

/** The notch tag above each hero, by template. */
const HERO_TAG: Record<ExpansionPage["template"], string> = {
  care: "Care at home",
  childcare: "Childcare",
  staffing: "For facilities",
  jobs: "Careers",
  guide: "Guide",
};

/** Clip art by template: an object beside the answer, a person on the navy band. */
const TEMPLATE_ART: Record<ExpansionPage["template"], { object: string; person: string }> = {
  care: { object: art.objCarePlan, person: art.charNurse },
  childcare: { object: art.nannyReading, person: art.charBoy },
  staffing: { object: art.objClipboard, person: art.charDoctor },
  jobs: { object: art.objCalendar, person: art.charCaregiver },
  guide: { object: art.objPhoneChat, person: art.charCaregiver },
};

const BENEFITS = [
  { title: "HEFAMAA accredited", description: "Licensed and compliant with Lagos State health requirements." },
  { title: "Vetted professionals", description: "Identity, qualifications, registration and competency are reviewed for the role." },
  { title: "Assessment-led", description: "The assessment determines the plan, professional scope and service arrangement." },
  { title: "Coordinated support", description: "A named Medic Connect contact coordinates managed care and documented escalation." },
];

const pageSchema = (page: ExpansionPage) => [
  {
    "@context": "https://schema.org",
    "@type": page.template === "guide" ? "Article" : "Service",
    name: page.h1,
    headline: page.h1,
    description: page.metaDescription,
    provider: {
      "@type": "Organization",
      name: "Medic Connect",
      url: "https://www.medicconnect.co",
    },
    areaServed: ["Lagos", "Abuja", "Ogun State", "Oyo State"].map((name) => ({ "@type": "Place", name })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.medicconnect.co/" },
      { "@type": "ListItem", position: 2, name: page.h1, item: `https://www.medicconnect.co${page.path}` },
    ],
  },
];

const ExpansionSeoPage = () => {
  const { pathname } = useLocation();
  const page = EXPANSION_PAGE_BY_PATH[pathname];

  if (!page) return <NotFound />;

  const modules = page.moduleCodes.map((code) => GOVERNED_MODULES[code]).filter(Boolean);
  const fees = page.feeSkus.map((sku) => GOVERNED_FEES[sku]).filter(Boolean);
  const isTalent = TALENT_TEMPLATES.has(page.template);
  const isEmployer = page.template === "staffing";
  const pageArt = TEMPLATE_ART[page.template];
  // Some records reuse the direct answer as their first card, and guides repeat
  // their answer points as the checklist; show each piece of copy once.
  const cards = page.cards.filter((card) => !page.intro.includes(card.description));
  const answerPoints = page.checklist ? [] : page.answerPoints;

  const primaryAction =
    page.template === "jobs" ? (
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
      <SEO
        title={page.title}
        description={page.metaDescription}
        path={page.path}
        jsonLd={pageSchema(page)}
        noindex={!isExpansionIndexable(page.path)}
      />
      <MedicHeader />

      <ServiceHero
        tag={HERO_TAG[page.template]}
        title={page.h1}
        promise={page.promise}
        image={page.heroImage}
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
        {page.intro.length > 0 && (
          <AnswerPanel heading={page.answerHeading} paragraphs={page.intro} points={answerPoints} art={pageArt.object} />
        )}

        {page.audience.length > 0 && (
          <AudienceNotes
            title={isTalent ? (isEmployer ? "Who we staff" : "Who we engage") : "Who this is for"}
            entries={page.audience}
          />
        )}

        {page.comparison && <ComparisonTable {...page.comparison} />}

        {page.checklist && <ChecklistSheet heading={page.checklist.heading} items={page.checklist.items} />}

        {cards.length > 0 && (
          <IncludedCards
            title={page.template === "jobs" ? "Routes into work" : isEmployer ? "How we staff" : "What is included"}
            cards={cards}
          />
        )}

        {fees.length > 0 && <PriceTags fees={fees} />}

        {modules.length > 0 && <ProcessSteps modules={modules} />}

        <WhyBand eyebrow={isTalent ? "Why work with us" : "Why families choose us"} reasons={BENEFITS} person={otherPersonThan(page.path, pageArt.person)} />

        {page.related.length > 0 && <RelatedLinks links={page.related} />}

        {page.template === "jobs" ? (
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

export default ExpansionSeoPage;
