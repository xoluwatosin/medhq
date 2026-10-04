import { Link } from "react-router-dom";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { KitMain } from "@/components/kit/KitLayout";
import { EmergencyBox, Watermark } from "@/components/mc/brand";
import FeePanel from "@/components/mc/FeePanel";
import { otherPersonThan } from "@/components/mc/people";
import { ChecklistSheet, ComparisonTable, RelatedLinks, SectionHead, WhyBand } from "@/components/mc/service-sections";
import { renderFeeTokens, type GovernedFee, type GovernedModule } from "@/content/seo/governed-modules";
import { processSummary } from "@/content/seo/process-summaries";
import { cn } from "@/lib/utils";

/**
 * The shared layout for the SEO pages (the governed core pages and the
 * expansion pages), in the same language as the service pages: an
 * illustrated navy hero with three facts hanging from it, the direct answer
 * beside one real photo, who it is for as a checklist, what is included,
 * fees with the assessment shown apart, the steps, then related pages.
 * Every word comes from the registry mirrors; this file only lays it out.
 */

export type SeoKind = "care" | "childcare" | "staffing" | "jobs" | "guide";

export interface SeoPageProps {
  path: string;
  kind: SeoKind;
  eyebrow: string;
  title: string;
  metaDescription: string;
  jsonLd: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
  h1: string;
  promise: string;
  heroArt: string[];
  photo: { src: string; alt: string };
  answer: { heading: string; paragraphs: string[]; points: string[] };
  audience?: { title: string; entries: string[] };
  comparison?: { heading: string; leftLabel: string; rightLabel: string; rows: { label: string; left: string; right: string }[] };
  checklist?: { heading: string; items: string[] };
  included?: { title: string; cards: { title: string; description: string }[] };
  /** Published fees for the page, without the assessment. */
  fees: GovernedFee[];
  modules: GovernedModule[];
  reasons: { title: string; description: string }[];
  bandPerson: string;
  related?: { label: string; path: string }[];
}

const WATERMARK: Record<SeoKind, "o" | "inf" | "full"> = { care: "o", childcare: "inf", staffing: "full", jobs: "inf", guide: "o" };
const TILTS = [-1.1, 0.9, -0.7];
const SMALL_WORDS = new Set(["a", "an", "and", "at", "after", "before", "do", "for", "i", "in", "of", "or", "the", "to", "vs", "who", "what", "how", "does", "should", "need", "home", "care"]);

/** The word drawn in the accent box: the longest word that carries the topic. */
const accentIndex = (h1: string) => {
  const words = h1.split(" ");
  let best = 0;
  words.forEach((w, i) => {
    const clean = w.replace(/[^a-z-]/gi, "").toLowerCase();
    if (!SMALL_WORDS.has(clean) && clean.length > words[best].replace(/[^a-z-]/gi, "").length) best = i;
  });
  return best;
};

const btnPrimary =
  "inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue transition-colors hover:bg-tint";
const btnGhost =
  "inline-flex min-h-[48px] items-center justify-center rounded-control border-2 border-white/40 px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-white/10";

const SeoPage = (p: SeoPageProps) => {
  const isTalent = p.kind === "jobs" || p.kind === "staffing";
  const showFees = p.kind === "care" || p.kind === "childcare" || p.fees.length > 0;
  const fees = [...p.fees].sort((a, b) => a.amountNaira - b.amountNaira);
  const lowest = fees[0];
  const long = p.h1.split(" ").length > 3;

  // Three facts hang from the hero: the price first where there is one, then the assessment and the licence.
  const facts: { value: string; label: string; from?: boolean }[] = isTalent
    ? [
        { value: "HEFAMAA", label: "Licensed and accredited" },
        { value: "Insured", label: "Professional indemnity insurance" },
        { value: "HFN", label: "Member of the Healthcare Federation of Nigeria" },
      ]
    : lowest
      ? [
          { value: `₦${lowest.amountNaira.toLocaleString("en-NG")}`, label: lowest.label.replace(/,\s*\d+\s*hours?$/i, ""), from: true },
          { value: "₦35,000", label: "One-off home assessment, before care starts" },
          { value: "HEFAMAA", label: "Licensed and accredited" },
        ]
      : p.kind === "guide"
        ? [
            { value: "₦35,000", label: "One-off home assessment, before care starts" },
            { value: "Vetted", label: "Identity, registration and references reviewed" },
            { value: "HEFAMAA", label: "Licensed and accredited" },
          ]
        : [
            { value: "₦35,000", label: "One-off home assessment, before care starts" },
            { value: "Quoted", label: "The care is priced after the assessment" },
            { value: "HEFAMAA", label: "Licensed and accredited" },
          ];

  const whatsappText = `Hello Medic Connect, I'm asking about ${p.h1.toLowerCase().replace(/\?$/, "")}.`;
  const buttons = (onPhone: boolean) => (
    <div className={cn("flex gap-3", onPhone ? "mt-6 flex-col sm:flex-row" : "mt-8 flex-row")}>
      {p.kind === "jobs" ? (
        <Link to="/join" className={btnPrimary}>
          Join our network
        </Link>
      ) : p.kind === "staffing" ? (
        <Link to="/for-facilities" className={btnPrimary}>
          Discuss your staffing
        </Link>
      ) : (
        <CareRequestDialog source={`hero:${p.path}`} trigger={<button className={btnPrimary}>Request care</button>} />
      )}
      <a href={`https://wa.me/2348126988237?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer" className={btnGhost}>
        Chat on WhatsApp
      </a>
    </div>
  );

  const heading = <KitPillHeading text={p.h1} accent={[accentIndex(p.h1)]} align="left" size={long ? "md" : "lg"} />;

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <SEO title={p.title} description={p.metaDescription} path={p.path} jsonLd={p.jsonLd} noindex={p.noindex} />
      <MedicHeader />

      {/* Phones and tablets: headline across the top, the person beside the promise. */}
      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px] lg:hidden">
        <Watermark glyph={WATERMARK[p.kind]} size={300} opacity={0.12} className="-right-[90px] -top-[30px]" />
        <div className="relative mx-auto max-w-[720px] px-[22px] pb-[120px] sm:px-[50px]">
          <p className="eyebrow !text-brand-soft">{p.eyebrow}</p>
          <div className="mt-3">{heading}</div>
          <p className="mt-5 max-w-[60%] text-[15px] leading-[1.55] text-body-navy sm:text-[18px]">{p.promise}</p>
          <div className="max-w-[60%]">{buttons(true)}</div>
          <img
            src={p.heroArt[0]}
            alt=""
            className="pointer-events-none absolute bottom-[96px] right-3 h-[210px] max-w-[38%] object-contain object-right-bottom sm:right-[40px] sm:h-[260px]"
          />
        </div>
      </section>

      {/* Desktop: the people stand on the line the facts hang from. */}
      <section className="relative -mt-[114px] hidden overflow-hidden bg-navy pt-[150px] lg:block">
        <Watermark glyph={WATERMARK[p.kind]} size={620} opacity={0.12} className="-right-[200px] -top-[120px]" />
        <div className="relative mx-auto max-w-[1440px] px-[50px] pb-[200px]">
          <div className={cn(p.heroArt.length > 1 ? "max-w-[640px]" : "max-w-[720px]")}>
            <p className="eyebrow !text-brand-soft">{p.eyebrow}</p>
            {/* Only one hero shows at a time; the hidden one is display:none, so the page has one visible h1. */}
            <div className="mt-4">{heading}</div>
            <p className="mt-6 max-w-[52ch] text-[19px] leading-[1.6] text-body-navy">{p.promise}</p>
            {buttons(false)}
          </div>
          <div className="pointer-events-none absolute bottom-[14px] right-[80px] flex items-end xl:right-[140px]">
            {p.heroArt.map((src, i) => (
              <img key={src} src={src} alt="" className={cn("h-[300px] object-contain xl:h-[340px]", i > 0 && "-ml-6")} />
            ))}
          </div>
        </div>
      </section>

      <KitMain className="relative -mt-[96px] pt-0 lg:-mt-[100px]">
        <section aria-label="At a glance" className="relative">
          <div aria-hidden="true" className="absolute inset-x-0 top-[2px] hidden h-[3px] bg-brand-soft lg:block" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-7">
            {facts.map((f, i) => (
              <li
                key={f.label}
                style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
                className={cn(
                  "mc-tilt flex items-center gap-4 border-2 border-navy px-5 py-4 lg:flex-col lg:items-start lg:gap-1 lg:px-6 lg:py-5",
                  i === 0 ? "bg-white shadow-offset" : i === 1 ? "bg-tint shadow-offset" : "bg-white shadow-offset-blue",
                )}
              >
                <b className={cn("shrink-0 text-[21px] font-black tracking-[-0.04em] tabular-nums lg:text-[34px]", i === 0 && f.value.startsWith("₦") ? "text-price" : "text-navy")}>
                  {f.from && <span className="mr-1.5 text-[14px] font-bold tracking-normal text-ink lg:text-[16px]">from</span>}
                  {f.value}
                </b>
                <span className="min-w-0 text-[14px] font-bold leading-[1.35] text-body lg:text-[15px]">{f.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* The direct answer beside one real photo. */}
        <section aria-labelledby="answer-heading" className="mt-20 grid items-center gap-10 lg:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <figure className="relative order-2 mx-auto w-full max-w-[320px] rotate-[-2deg] bg-white p-3 pb-4 shadow-offset sm:max-w-[440px] lg:order-1 lg:mx-0">
            <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[3deg] bg-tint-deep/80" />
            <img src={p.photo.src} alt={p.photo.alt} loading="lazy" className="aspect-[4/3.4] w-full object-cover" />
          </figure>
          <div className="order-1 lg:order-2">
            <p className="eyebrow">In short</p>
            <h2 id="answer-heading" className="mt-3 text-[30px] leading-[1.02] tracking-[-0.05em] sm:text-[44px]">
              {p.answer.heading}
            </h2>
            {p.answer.paragraphs.map((para) => (
              <p key={para} className="mt-5 max-w-[62ch] text-[17px] leading-[1.7] text-body sm:text-[18px]">
                {renderFeeTokens(para)}
              </p>
            ))}
            {p.answer.points.length > 0 && (
              <ul className="mt-6 grid gap-3">
                {p.answer.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3.5">
                    <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center bg-brand text-[13px] font-black text-white">
                      ✓
                    </span>
                    <span className="text-[16px] font-bold leading-[1.45] text-navy">{pt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {p.audience && p.audience.entries.length > 0 && (
          <section aria-labelledby="audience-heading" className="mt-20 lg:mt-28">
            <SectionHead id="audience-heading" title={p.audience.title} />
            <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {p.audience.entries.map((e) => (
                <li key={e} className="flex items-start gap-3.5">
                  <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-navy text-[15px] font-black text-white">
                    ✓
                  </span>
                  <span className="text-[17px] font-bold leading-[1.4] text-navy">{e}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* These two carry their own padding; drop the bottom so the next section's margin sets the gap. */}
        {p.comparison && <div className="mt-6 [&>section]:pb-0"><ComparisonTable {...p.comparison} /></div>}
        {p.checklist && <div className="mt-6 [&>section]:pb-0"><ChecklistSheet heading={p.checklist.heading} items={p.checklist.items} /></div>}

        {p.included && p.included.cards.length > 0 && (
          <section aria-labelledby="included-heading" className="mt-20 lg:mt-28">
            <SectionHead id="included-heading" title={p.included.title} />
            <ol className={cn("grid gap-5 sm:grid-cols-2 lg:gap-7", p.included.cards.length % 3 === 0 && "lg:grid-cols-3", p.included.cards.length === 4 && "lg:grid-cols-4")}>
              {p.included.cards.map((card, i) => (
                <li
                  key={card.title}
                  style={{ ["--mc-tilt" as string]: `${TILTS[i % 3] / 2}deg` }}
                  className={cn("mc-tilt flex flex-col gap-2 border-2 border-navy p-6", i % 2 ? "bg-tint shadow-offset" : "bg-white shadow-offset")}
                >
                  <span className="text-[32px] font-black leading-none tracking-[-0.06em] text-brand tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-1 text-[20px] leading-[1.15] tracking-[-0.03em]">{card.title}</h3>
                  <p className="text-[15.5px] leading-[1.6] text-body">{card.description}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {showFees && (
          <section aria-labelledby="prices-heading" className="mt-20 lg:mt-28">
            <SectionHead
              id="prices-heading"
              eyebrow="What it costs"
              title="Indicative fees"
              intro={
                p.fees.length > 0
                  ? "A guide to what care typically costs. Your fee is confirmed in the care plan agreed after the assessment."
                  : undefined
              }
            />
            <FeePanel
              fees={fees}
              quoted={
                p.kind === "childcare"
                  ? "Fees depend on the support, the hours and your child's needs, so we quote once we have assessed them."
                  : "Fees depend on the care needed and the hours, so we quote once we have assessed them."
              }
            />
          </section>
        )}

        {p.modules.length > 0 && (
          <section aria-labelledby="how-heading" className="mt-20 lg:mt-28">
            <SectionHead id="how-heading" eyebrow="Step by step" title="How this works" />
            <ol className="max-w-[860px] border-2 border-navy bg-white shadow-offset-tint">
              {p.modules.map((m, i) => (
                <li key={m.code} className={cn(i > 0 && "border-t-2 border-navy/10")}>
                  <details className="group" open={i === 0}>
                    <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-4 px-5 py-3 [&::-webkit-details-marker]:hidden">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center text-[17px] font-black text-white tabular-nums", i === 0 ? "bg-brand" : "bg-navy")}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[17px] font-extrabold leading-[1.3] text-navy">{m.heading}</span>
                      <span aria-hidden="true" className="text-[22px] font-black text-brand group-open:hidden">+</span>
                      <span aria-hidden="true" className="hidden text-[22px] font-black text-brand group-open:inline">−</span>
                    </summary>
                    <p className="max-w-[70ch] px-5 pb-5 pl-[76px] text-[16px] leading-[1.7] text-body">
                      {renderFeeTokens(processSummary(m.code, m.paragraphs[0] ?? ""))}
                    </p>
                  </details>
                </li>
              ))}
            </ol>
            {!isTalent && <EmergencyBox className="mt-6 lg:max-w-[640px]" />}
          </section>
        )}

        <WhyBand eyebrow={isTalent ? "Why work with us" : "Why families choose us"} reasons={p.reasons} person={otherPersonThan(p.path, p.bandPerson)} />

        {p.related && p.related.length > 0 && <RelatedLinks links={p.related} />}

        {/* Desktop only: on phones the hero's buttons are enough. */}
        <div className="hidden lg:block">
          {p.kind === "jobs" ? (
            <CTASection
              headline="Work with Medic Connect"
              body="Join the candidate pool or apply for an advertised opportunity."
              hideRequestCare
              primaryButton={{ text: "Join our network", href: "/join" }}
            />
          ) : p.kind === "staffing" ? (
            <CTASection
              headline="Staff your service"
              body="Tell us the roles, the shifts and the location, and we will scope the cover."
              hideRequestCare
              primaryButton={{ text: "Tell us what you need", href: "/for-facilities" }}
            />
          ) : (
            <CTASection headline="Ready to arrange care?" body="Tell us what is needed and we will arrange the assessment." />
          )}
        </div>
      </KitMain>

      <Footer />
    </div>
  );
};

export default SeoPage;
