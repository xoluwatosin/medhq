import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { Chevrons, NotchTag, Watermark } from "@/components/mc/brand";
import { SectionHead } from "@/components/mc/service-sections";
import { GOVERNED_FEES } from "@/content/seo/governed-modules";
import { cn } from "@/lib/utils";

/**
 * The shared layout for the main service pages (eldercare, postnatal and the
 * rest). Each page passes its own words, art, photo and prices; the layout is
 * built twice, like the door pages:
 *  - desktop: illustrated hero with the people standing on the line three fact
 *    cards hang from, then one taped photo moment, who it is for, what is
 *    included, prices, how it works, and the closing band;
 *  - phones: the same order, one column, tiles two up.
 * Illustrations explain; the one photo is there to reassure. No text sits on
 * the photo, and it is never washed blue.
 */

export interface ServicePageConfig {
  /** Eyebrow above the headline, e.g. "Eldercare in Lagos". */
  eyebrow: string;
  /** The emotional headline, set in boxed words. */
  headline: string;
  /** Index of the headline word drawn in the accent box. */
  accentWord: number;
  lead: string;
  /** People standing on the hero line (one or two). */
  heroArt: string[];
  watermark: "o" | "cross" | "inf" | "full";
  serviceLine: string;
  whatsappText: string;
  /** Three short facts that hang from the hero: a big value and a line. */
  facts: { value: string; label: string }[];
  moment: { photo: string; alt: string; title: string; body: string; aside?: { title: string; body: string } };
  /** Who the service is for, as a ticked list. */
  audience: string[];
  /** One person standing beside the list. */
  audienceArt: string;
  included: { title: string; text: string; art: string }[];
  feeSkus: string[];
  steps: { title: string; text: string }[];
  /** An optional linked panel, e.g. care from abroad. */
  crossLink?: { href: string; tag: string; title: string; body: string; art: string };
  cta: { headline: string; body: string; person: string };
  children?: ReactNode;
}

const TILTS = [-1.1, 0.9, -0.7];

const ServicePage = ({ c }: { c: ServicePageConfig }) => {
  const fees = c.feeSkus.map((s) => GOVERNED_FEES[s]).filter((f) => f && f.sku !== "PUB-ASSESSMENT");
  const words = c.headline.split(" ");

  const buttons = (onPhone: boolean) => (
    <div className={cn("flex gap-3", onPhone ? "mt-6 flex-col sm:flex-row" : "mt-8 flex-row")}>
      <CareRequestDialog
        serviceLineKey={c.serviceLine}
        source={`hero:${c.serviceLine}`}
        trigger={
          <button className="inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue transition-colors hover:bg-tint">
            Request care
          </button>
        }
      />
      <a
        href={`https://wa.me/2348126988237?text=${encodeURIComponent(c.whatsappText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[48px] items-center justify-center rounded-control border-2 border-white/40 px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-white/10"
      >
        Chat on WhatsApp
      </a>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background animate-fade-in">
      <MedicHeader />

      {/* Phones and tablets: headline left, the people beside the copy. */}
      <section className="relative -mt-[80px] overflow-hidden bg-navy pt-[108px] sm:-mt-[114px] sm:pt-[150px] lg:hidden">
        <Watermark glyph={c.watermark} size={300} opacity={0.12} className="-right-[90px] -top-[30px]" />
        <div className="relative mx-auto max-w-[720px] px-[22px] pb-[120px] sm:px-[50px]">
          <p className="eyebrow !text-brand-soft">{c.eyebrow}</p>
          <div className="mt-3">
            <KitPillHeading text={c.headline} accent={[c.accentWord]} align="left" />
          </div>
          <p className="mt-5 max-w-[62%] text-[15px] leading-[1.55] text-body-navy sm:text-[18px]">{c.lead}</p>
          <div className="max-w-[62%]">{buttons(true)}</div>
          <img
            src={c.heroArt[0]}
            alt=""
            className="pointer-events-none absolute bottom-[96px] -right-2 h-[230px] max-w-[40%] object-contain object-right-bottom sm:right-[40px] sm:h-[280px]"
          />
        </div>
      </section>

      {/* Desktop: the people stand on the line the fact cards hang from. */}
      <section className="relative -mt-[114px] hidden overflow-hidden bg-navy pt-[150px] lg:block">
        <Watermark glyph={c.watermark} size={620} opacity={0.12} className="-right-[200px] -top-[120px]" />
        <div className="relative mx-auto max-w-[1440px] px-[50px] pb-[200px]">
          <div className="max-w-[760px]">
            <p className="eyebrow !text-brand-soft">{c.eyebrow}</p>
            <div className="mt-4">
              {/* Only one hero shows at a time; the hidden one is display:none, so the page has one visible h1. */}
              <KitPillHeading text={c.headline} accent={[c.accentWord]} align="left" />
            </div>
            <p className="mt-6 max-w-[52ch] text-[19px] leading-[1.6] text-body-navy">{c.lead}</p>
            {buttons(false)}
          </div>
          <div className="pointer-events-none absolute bottom-[14px] right-[80px] flex items-end xl:right-[140px]">
            {c.heroArt.map((src, i) => (
              <img key={src} src={src} alt="" className={cn("h-[340px] object-contain", i > 0 && "-ml-6")} />
            ))}
          </div>
        </div>
      </section>

      <KitMain className="relative -mt-[96px] pt-0 lg:-mt-[100px]">
        {/* Three facts hang from the hero, so the price and the first step are read before anything else. */}
        <section aria-label="At a glance" className="relative">
          <div aria-hidden="true" className="absolute inset-x-0 top-[2px] hidden h-[3px] bg-brand-soft lg:block" />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-7">
            {c.facts.map((f, i) => (
              <li
                key={f.label}
                style={{ ["--mc-tilt" as string]: `${TILTS[i]}deg` }}
                className={cn(
                  "mc-tilt flex items-center gap-4 border-2 border-navy px-5 py-4 lg:flex-col lg:items-start lg:gap-1 lg:px-6 lg:py-5",
                  i === 0 ? "bg-white shadow-offset" : i === 1 ? "bg-tint shadow-offset" : "bg-white shadow-offset-blue",
                )}
              >
                <b className={cn("shrink-0 text-[21px] font-black tracking-[-0.04em] tabular-nums lg:text-[34px]", i === 0 ? "text-price" : "text-navy")}>
                  {f.value}
                </b>
                <span className="min-w-0 text-[14px] font-bold leading-[1.35] text-body lg:text-[15px]">{f.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* The photo moment: one real picture, taped like a snapshot print. */}
        <section className="mt-20 grid items-center gap-10 lg:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
          <figure className="relative mx-auto w-full max-w-[460px] rotate-[-2deg] bg-white p-3 pb-4 shadow-offset lg:mx-0">
            <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-[3deg] bg-tint-deep/80" />
            <img src={c.moment.photo} alt={c.moment.alt} loading="lazy" className="aspect-[4/3.4] w-full object-cover" />
          </figure>
          <div>
            <h2 className="text-[30px] leading-[1.02] tracking-[-0.05em] sm:text-[44px]">{c.moment.title}</h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-[1.7] text-body sm:text-[19px]">{c.moment.body}</p>
            {c.moment.aside && (
              <div className="mt-8 flex gap-4 border-l-4 border-brand bg-tint px-5 py-4">
                <div>
                  <p className="text-[16px] font-extrabold text-navy">{c.moment.aside.title}</p>
                  <p className="mt-1 text-[15px] leading-[1.6] text-body">{c.moment.aside.body}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Who it is for: a plain ticked list beside one person, so the objects stay with the services below. */}
        <section aria-labelledby="who-heading" className="mt-20 lg:mt-28">
          <SectionHead id="who-heading" eyebrow="Who it is for" title="Is this the right care?" />
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
            <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {c.audience.map((a) => (
                <li key={a} className="flex items-start gap-3.5">
                  <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-navy text-[15px] font-black text-white">
                    ✓
                  </span>
                  <span className="text-[17px] font-bold leading-[1.4] text-navy">{a}</span>
                </li>
              ))}
            </ul>
            <div className="relative hidden h-[300px] bg-tint lg:block">
              <img src={c.audienceArt} alt="" loading="lazy" className="absolute inset-x-0 bottom-0 mx-auto h-[280px] object-contain" />
            </div>
          </div>
        </section>

        {/* What is included: everything visible, an object for each. */}
        <section aria-labelledby="included-heading" className="mt-20 lg:mt-28">
          <SectionHead id="included-heading" eyebrow="What is included" title="Care that fits the day" />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {c.included.map((s, i) => (
              <li key={s.title} className={cn("flex gap-5 border-2 border-navy bg-white p-5 lg:p-6", i % 3 === 1 ? "shadow-offset-blue" : "shadow-offset")}>
                <div className="grid h-[84px] w-[84px] shrink-0 place-items-center bg-tint">
                  <img src={s.art} alt="" loading="lazy" className="h-[68px] w-[68px] object-contain" />
                </div>
                <div>
                  <h3 className="text-[19px] leading-[1.15] tracking-[-0.03em]">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-[1.55] text-body">{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Prices from the published price list. */}
        <section aria-labelledby="prices-heading" className="mt-20 lg:mt-28">
          <SectionHead
            id="prices-heading"
            eyebrow="What it costs"
            title="Prices"
            intro="Published prices are fixed or a from price. Ongoing, live-in and package care is quoted after the assessment."
          />
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {fees.map((f, i) => (
              <li key={f.sku} className="relative flex flex-col gap-2 border-2 border-navy bg-white p-6 pt-7">
                <NotchTag tone={i === 0 ? "blue" : "tint"} outlined={i !== 0} size="sm" className="absolute -top-3 left-5">
                  {f.unit}
                </NotchTag>
                <p className="text-[17px] font-extrabold leading-[1.25] text-navy">{f.label}</p>
                <p className="mt-auto pt-2 text-[32px] font-black tracking-[-0.04em] text-price tabular-nums">
                  {f.treatment === "from" && <span className="mr-1.5 text-[15px] font-bold text-ink">from</span>}₦
                  {f.amountNaira.toLocaleString("en-NG")}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-4 bg-navy px-6 py-5">
            <Chevrons />
            <p className="text-[16px] font-extrabold text-white">Every care plan starts with a ₦35,000 home care needs assessment.</p>
          </div>
        </section>

        {/* How it works: visible steps, starting with the assessment. */}
        <section aria-labelledby="how-heading" className="mt-20 lg:mt-28">
          <SectionHead id="how-heading" eyebrow="How it works" title="From first message to first visit" />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {c.steps.map((s, i) => (
              <li key={s.title} className="relative border-t-4 border-navy pt-5">
                <span className={cn("grid h-11 w-11 place-items-center text-[20px] font-black text-white shadow-offset-sm", i === c.steps.length - 1 ? "bg-navy" : "bg-brand")}>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[20px] leading-[1.15] tracking-[-0.035em]">{s.title}</h3>
                <p className="mt-1.5 text-[15.5px] leading-[1.6] text-body">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {c.crossLink && (
          <Link
            to={c.crossLink.href}
            className="group mt-20 flex flex-col items-start gap-6 border-2 border-navy bg-tint p-6 shadow-offset sm:flex-row sm:items-center sm:p-8 lg:mt-28"
          >
            <img src={c.crossLink.art} alt="" loading="lazy" className="h-[150px] shrink-0 object-contain" />
            <div className="flex-1">
              <NotchTag tone="blue" size="sm">
                {c.crossLink.tag}
              </NotchTag>
              <h2 className="mt-3 text-[24px] leading-[1.1] tracking-[-0.04em] sm:text-[30px]">{c.crossLink.title}</h2>
              <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.6] text-body">{c.crossLink.body}</p>
            </div>
            <span className="text-[16px] font-extrabold text-brand group-hover:text-navy">
              Find out more <span aria-hidden="true">→</span>
            </span>
          </Link>
        )}

        {c.children}

        <CTASection headline={c.cta.headline} body={c.cta.body} person={c.cta.person} serviceLine={c.serviceLine} />
      </KitMain>

      <Footer />
    </div>
  );
};

export default ServicePage;
