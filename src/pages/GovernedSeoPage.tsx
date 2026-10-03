import { useLocation, Link } from "react-router-dom";
import {
  BadgeCheck,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  UserCheck,
  ClipboardList,
  FileText,
  PhoneCall,
  MapPin,
} from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import HoverCard from "@/components/HoverCard";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GOVERNED_PAGE_BY_PATH, type GovernedPage } from "@/content/seo/governed-pages";
import { PAGE_VISUALS } from "@/content/seo/page-visuals";
import { GOVERNED_FEES, GOVERNED_MODULES, formatFee, renderFeeTokens } from "@/content/seo/governed-modules";
import { processSummary } from "@/content/seo/process-summaries";
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

/** Pages addressed to candidates, not families: they must not offer a care request. */
const TALENT_PATHS = new Set(["/careers", "/careers/nursing", "/nurse-staffing", "/ngo-healthcare-staffing"]);

/** Approved, registry-backed reasons. No new claim is introduced here. */
const BENEFITS = [
  {
    title: "Licensed and accredited",
    description: "Licensed and accredited by HEFAMAA, with professional indemnity insurance and membership of the Healthcare Federation of Nigeria.",
    icon: ShieldCheck,
  },
  {
    title: "Vetted professionals",
    description: "Identity, registration and qualification documents are collected and reviewed, with references, interview and competency assessment.",
    icon: UserCheck,
  },
  {
    title: "Assessment first",
    description: "A formal assessment sets the care plan, the professionals required and the hours before care begins.",
    icon: ClipboardList,
  },
  {
    title: "Documented care",
    description: "Care is documented against the care plan and reviewed as circumstances change.",
    icon: FileText,
  },
  {
    title: "Clear escalation",
    description: "Staff work to documented escalation procedures. Medic Connect is not an emergency service.",
    icon: PhoneCall,
  },
  {
    title: "Lagos, Abuja, Ogun and Oyo",
    description: "Care is arranged in the areas Medic Connect currently serves.",
    icon: MapPin,
  },
];

const GovernedSeoPage = () => {
  const { pathname } = useLocation();
  const page = GOVERNED_PAGE_BY_PATH[pathname];

  if (!page) return <NotFound />;

  const visuals = PAGE_VISUALS[page.path];
  const modules = page.moduleCodes.map((code) => GOVERNED_MODULES[code]).filter(Boolean);
  const fees = page.feeSkus.map((sku) => GOVERNED_FEES[sku]).filter(Boolean);
  const isTalent = TALENT_PATHS.has(page.path);

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title={page.title} description={page.metaDescription} path={page.path} jsonLd={[serviceSchema(page), breadcrumbSchema(page)]} />
      <MedicHeader />

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="kit-curve-lg relative mb-8 mt-2 overflow-hidden bg-navy animate-fade-in">
          <div className="grid gap-6 p-6 md:grid-cols-2 md:gap-12 md:p-12 lg:p-16">
            {visuals && (
              <div className="kit-curve relative aspect-[4/3] overflow-hidden animate-scale-in md:aspect-auto">
                <img
                  src={visuals.heroImage}
                  alt={page.h1}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="kit-curve-sm absolute left-6 top-6 flex items-center gap-2 bg-white px-4 py-2 text-sm font-medium text-navy">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  HEFAMAA accredited
                </div>
              </div>
            )}

            <div className="flex flex-col justify-center space-y-6 md:space-y-8">
              <div className="space-y-4 md:space-y-6">
                <h1 className="animate-slide-down text-[34px] font-medium leading-[1.06] tracking-[-0.03em] text-white sm:text-[46px] lg:text-[56px]">
                  {page.h1}
                </h1>
                <p className="animate-slide-up stagger-1 max-w-xl text-[17px] leading-[1.6] text-body-navy md:text-[20px]">
                  {page.promise}
                </p>
              </div>

              <div className="animate-slide-up stagger-2 flex flex-col gap-3 pt-2 sm:flex-row">
                {isTalent ? (
                  <Link
                    to="/join"
                    className="kit-curve-sm inline-flex items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity hover:opacity-90"
                  >
                    <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                    Join our network
                  </Link>
                ) : (
                  <CareRequestDialog
                    source={`hero:${page.path}`}
                    trigger={
                      <Button className="kit-curve-sm bg-white px-7 py-6 text-base font-semibold text-navy transition-opacity hover:bg-white/90">
                        <HeartHandshake className="h-5 w-5" />
                        Request care
                      </Button>
                    }
                  />
                )}
                <a
                  href="https://wa.me/2348126988237"
                  className="kit-curve-sm inline-flex items-center justify-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-semibold text-white transition-colors hover:bg-hairline-navy"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  WhatsApp us
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Overview */}
        {page.intro.length > 0 && (
          <section className="py-8">
            <div className="mx-auto max-w-4xl space-y-4 text-center">
              {page.intro.map((paragraph) => (
                <p key={paragraph} className="text-[17px] leading-[1.7] text-body">
                  {renderFeeTokens(paragraph)}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Who this is for */}
        {visuals && visuals.audience.length > 0 && (
          isTalent ? (
            <section className="py-10 md:py-12">
              <div className="mb-8 text-center animate-slide-up">
                <h2 className="text-[24px] font-medium tracking-[-0.02em] text-ink sm:text-[30px]">Who we engage</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {visuals.audience.map((entry, index) => (
                  <div
                    key={entry}
                    className={`kit-curve animate-slide-up stagger-${Math.min(index + 1, 6)} border border-hairline-warm bg-card p-5 text-[16px] text-ink`}
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <ClientsScrollSection clients={visuals.audience} />
          )
        )}

        {/* Parts of the service */}
        {visuals && visuals.cards.length > 0 && (
          <section className="py-10 md:py-12">
            <div className="mb-12 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">
                {isTalent ? "Routes into work" : "What is included"}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visuals.cards.map((card, index) => (
                <div key={card.title} className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}>
                  <ServiceFlipCard title={card.title} description={card.description} image={card.image} showLearnMore={false} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Prices */}
        {fees.length > 0 && (
          <section className="py-10 md:py-12">
            <div className="mb-10 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">Prices</h2>
              <p className="mx-auto mt-3 max-w-[56ch] text-[15px] leading-[1.6] text-body">
                Published prices are either fixed or a from price. Ongoing, live-in and package care is quoted after assessment.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {fees.map((record, index) => (
                <div
                  key={record.sku}
                  className={`kit-curve animate-slide-up stagger-${Math.min(index + 1, 6)} border border-hairline-warm bg-card p-6`}
                >
                  <p className="text-[16px] font-medium text-ink">{record.label}</p>
                  <p className="mt-4 text-[26px] font-medium tracking-[-0.02em] text-price">{formatFee(record)}</p>
                  <p className="mt-1 text-[14px] text-body">{record.unit}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How this works */}
        {modules.length > 0 && (
          <section className="py-10 md:py-12">
            <div className="mb-12 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">How this works</h2>
            </div>
            <div className="kit-curve mx-auto max-w-3xl border border-hairline-warm bg-card p-6 animate-slide-up md:p-8">
              <Accordion type="single" collapsible>
                {modules.map((module, index) => (
                  <AccordionItem key={module.code} value={module.code} className="border-border/50">
                    <AccordionTrigger className="py-4 text-left hover:no-underline">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[17px] font-semibold text-ink">{module.heading}</span>
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pl-11">
                      <p className="text-[16px] leading-[1.7] text-body">
                        {renderFeeTokens(processSummary(module.code, module.paragraphs[0] ?? ""))}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}

        {/* Why choose Medic Connect */}
        <section className="py-10 md:py-12">
          <div className="mb-12 text-center animate-slide-up">
            <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">Why choose Medic Connect</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <HoverCard key={benefit.title} {...benefit} index={index} />
            ))}
          </div>
        </section>

        {isTalent ? (
          <CTASection
            headline="Work with Medic Connect"
            body="Join the candidate pool or apply for an advertised opportunity."
            hideRequestCare
            primaryButton={{ text: "Join our network", href: "/join" }}
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
