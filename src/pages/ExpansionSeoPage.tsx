import { useLocation, Link } from "react-router-dom";
import { BadgeCheck, Clock, Heart, HeartHandshake, MessageCircle, Shield, UserCheck } from "lucide-react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import ServiceFlipCard from "@/components/ServiceFlipCard";
import ClientsScrollSection from "@/components/ClientsScrollSection";
import HoverCard from "@/components/HoverCard";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { isExpansionIndexable } from "@/content/seo/index-policy";
import { EXPANSION_PAGE_BY_PATH, type ExpansionPage } from "@/content/seo/expansion-pages";
import { GOVERNED_FEES, GOVERNED_MODULES, formatFee, renderFeeTokens } from "@/content/seo/governed-modules";
import { processSummary } from "@/content/seo/process-summaries";
import NotFound from "@/pages/NotFound";

const TALENT_TEMPLATES = new Set(["jobs", "staffing"]);

const BENEFITS = [
  { title: "HEFAMAA accredited", description: "Licensed and compliant with Lagos State health requirements.", icon: Shield },
  { title: "Vetted professionals", description: "Identity, qualifications, registration and competency are reviewed for the role.", icon: UserCheck },
  { title: "Assessment-led", description: "The assessment determines the plan, professional scope and service arrangement.", icon: Heart },
  { title: "Coordinated support", description: "A named Medic Connect contact coordinates managed care and documented escalation.", icon: Clock },
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

      <main className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="kit-curve-lg relative mb-8 mt-2 overflow-hidden bg-navy animate-fade-in">
          <div className="grid gap-6 p-6 md:grid-cols-2 md:gap-12 md:p-12 lg:p-16">
            <div className="kit-curve relative aspect-[4/3] overflow-hidden animate-scale-in md:aspect-auto">
              <img
                src={page.heroImage}
                alt={page.h1}
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="kit-curve-sm absolute left-6 top-6 flex items-center gap-2 bg-white px-4 py-2 text-sm font-medium text-navy">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                HEFAMAA accredited
              </div>
            </div>

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
                {page.template === "jobs" ? (
                  <Link
                    to="/join"
                    className="kit-curve-sm inline-flex items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity hover:opacity-90"
                  >
                    <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                    Join our network
                  </Link>
                ) : isEmployer ? (
                  <Link
                    to="/contact"
                    className="kit-curve-sm inline-flex items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity hover:opacity-90"
                  >
                    <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                    Discuss your staffing
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

        {/* Direct answer */}
        {page.intro.length > 0 && (
          <section className="py-8 md:py-10" aria-labelledby="direct-answer-heading">
            <div className="mx-auto max-w-4xl border-y border-hairline-warm py-7 md:py-9">
              <h2 id="direct-answer-heading" className="text-[24px] font-medium text-ink sm:text-[30px]">
                {page.answerHeading}
              </h2>
              {page.intro.map((paragraph) => (
                <p key={paragraph} className="mt-4 max-w-[72ch] text-[17px] leading-[1.7] text-body">
                  {renderFeeTokens(paragraph)}
                </p>
              ))}
              {page.answerPoints.length > 0 && (
                <ul className="mt-5 grid gap-3 md:grid-cols-3">
                  {page.answerPoints.map((point) => (
                    <li key={point} className="flex gap-3 text-[15px] leading-[1.6] text-body">
                      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Who this is for */}
        {page.audience.length > 0 && (
          isTalent ? (
            <section className="py-10 md:py-12">
              <div className="mb-8 text-center animate-slide-up">
                <h2 className="text-[24px] font-medium tracking-[-0.02em] text-ink sm:text-[30px]">
                  {isEmployer ? "Who we staff" : "Who we engage"}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {page.audience.map((entry, index) => (
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
            <ClientsScrollSection clients={page.audience} />
          )
        )}

        {/* Comparison */}
        {page.comparison && (
          <section className="py-10 md:py-12">
            <div className="mb-8 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">{page.comparison.heading}</h2>
            </div>
            <div className="kit-curve mx-auto max-w-4xl overflow-hidden border border-hairline-warm bg-card animate-slide-up">
              <div className="hidden gap-6 border-b border-hairline-warm bg-muted p-5 sm:grid sm:grid-cols-3">
                <span className="sr-only">Comparison</span>
                <p className="text-[14px] font-semibold uppercase tracking-wide text-ink">{page.comparison.leftLabel}</p>
                <p className="text-[14px] font-semibold uppercase tracking-wide text-ink">{page.comparison.rightLabel}</p>
              </div>
              {page.comparison.rows.map((row, index) => (
                <div
                  key={row.label}
                  className={`grid gap-1 p-5 sm:grid-cols-3 sm:gap-6 ${index > 0 ? "border-t border-hairline-warm" : ""}`}
                >
                  <p className="text-[15px] font-semibold text-ink">{row.label}</p>
                  <p className="text-[15px] leading-[1.6] text-body">
                    <span className="mb-1 block text-[13px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                      {page.comparison!.leftLabel}
                    </span>
                    {row.left}
                  </p>
                  <p className="text-[15px] leading-[1.6] text-body">
                    <span className="mb-1 block text-[13px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                      {page.comparison!.rightLabel}
                    </span>
                    {row.right}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Checklist */}
        {page.checklist && (
          <section className="py-10 md:py-12">
            <div className="mb-8 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">{page.checklist.heading}</h2>
            </div>
            <ul className="kit-curve mx-auto max-w-3xl space-y-3 border border-hairline-warm bg-card p-6 animate-slide-up md:p-8">
              {page.checklist.items.map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-[1.6] text-body">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Parts of the service */}
        {page.cards.length > 0 && (
          <section className="py-10 md:py-12">
            <div className="mb-12 text-center animate-slide-up">
              <h2 className="text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">
                {page.template === "jobs" ? "Routes into work" : isEmployer ? "How we staff" : "What is included"}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {page.cards.map((card, index) => (
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
            <div className="kit-curve mx-auto max-w-2xl border border-hairline-warm bg-card p-6 animate-slide-up md:p-8">
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit, index) => <HoverCard key={benefit.title} {...benefit} index={index} />)}
          </div>
        </section>

        {/* Related pages */}
        {page.related.length > 0 && (
          <section className="py-10 md:py-12">
            <div className="mb-8 text-center animate-slide-up">
              <h2 className="text-[24px] font-medium tracking-[-0.02em] text-ink sm:text-[30px]">Related pages</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {page.related.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="kit-curve border border-hairline-warm bg-card p-5 text-[16px] font-medium text-ink transition-colors hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}

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
