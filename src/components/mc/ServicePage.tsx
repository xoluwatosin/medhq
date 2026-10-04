import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import MedicHeader from "@/components/MedicHeader";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import CareRequestDialog from "@/components/CareRequestDialog";
import FacilityEnquiryForm, { type FacilityServiceKey } from "@/components/facilities/FacilityEnquiryForm";
import { KitMain } from "@/components/kit/KitLayout";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { CarerID, EmergencyBox, NotchTag, TapeLabel, Watermark } from "@/components/mc/brand";
import { SectionHead } from "@/components/mc/service-sections";
import { GOVERNED_FEES } from "@/content/seo/governed-modules";
import { cn } from "@/lib/utils";

/**
 * The shared layout for the main service pages (eldercare, postnatal and the
 * rest). Each page passes its own words, art, photo and prices; the layout is
 * built twice, like the door pages:
 *  - desktop: illustrated hero with the people standing on the line three fact
 *    cards hang from, then one taped photo moment, and sections that each
 *    answer a question a family asks: what a visit looks like, who comes to
 *    the door, what it costs (the assessment shown apart from the care
 *    price), how it starts, and what if something goes wrong;
 *  - phones: the same order in one column.
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
  /**
   * Facility pages (staffing, support, research): the hero and closing band
   * point to the staffing enquiry form, which replaces the fees and the home
   * assessment, and there is no emergency box.
   */
  facility?: { service: FacilityServiceKey; button: string; formTitle: string; formIntro: string };
  whatsappText: string;
  /** Three short facts that hang from the hero. `from` prints "from" before a price. */
  facts: { value: string; label: string; from?: boolean }[];
  moment: { photo: string; alt: string; title: string; body: string };
  /** An example visit, told as visit notes with the time on tape. */
  visit: { title: string; intro: string; items: { time: string; title: string; text: string }[] };
  /** Who comes to the door: the badge and what is checked. Facility pages set their own eyebrow, title and badge name. */
  carer: { art: string; role: string; checks: string[]; eyebrow?: string; title?: string; badge?: string };
  /** Real worries, each with a short plain answer. */
  worries: { worry: string; answer: string }[];
  feeSkus: string[];
  /** When no fee is published (nanny, paediatric): why the fee is quoted after the assessment. */
  quoted?: string;
  steps: { title: string; text: string }[];
  /** Further questions, collapsed; pages whose FAQs go to Google must show them too. */
  faqs?: { q: string; a: string }[];
  /** An optional linked panel, e.g. care from abroad. */
  crossLink?: { href: string; tag: string; title: string; body: string; art: string };
  cta: { headline: string; body: string; person: string };
  children?: ReactNode;
}

const TILTS = [-1.1, 0.9, -0.7];

const ServicePage = ({ c }: { c: ServicePageConfig }) => {
  // Phones: one step and one worry open at a time; the first of each starts open.
  const [step, setStep] = useState(0);
  const [openWorry, setOpenWorry] = useState(0);
  const fees = c.feeSkus.map((s) => GOVERNED_FEES[s]).filter((f) => f && f.sku !== "PUB-ASSESSMENT");

  const buttons = (onPhone: boolean) => (
    <div className={cn("flex gap-3", onPhone ? "mt-6 flex-col sm:flex-row" : "mt-8 flex-row")}>
      {c.facility ? (
        <a
          href="#enquiry"
          className="inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue transition-colors hover:bg-tint"
        >
          {c.facility.button}
        </a>
      ) : (
        <CareRequestDialog
          serviceLineKey={c.serviceLine}
          source={`hero:${c.serviceLine}`}
          trigger={
            <button className="inline-flex min-h-[48px] items-center justify-center rounded-control bg-white px-6 text-[16px] font-extrabold text-navy shadow-offset-blue transition-colors hover:bg-tint">
              Request care
            </button>
          }
        />
      )}
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
                <b className={cn("shrink-0 text-[21px] font-black tracking-[-0.04em] tabular-nums lg:text-[34px]", /* Price red only for a price, never for a plain fact. */ i === 0 && f.value.startsWith("₦") ? "text-price" : "text-navy")}>
                  {f.from && <span className="mr-1.5 text-[14px] font-bold tracking-normal text-ink lg:text-[16px]">from</span>}
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
          </div>
        </section>

        {/* What a visit looks like: the services, shown happening. */}
        <section aria-labelledby="visit-heading" className="mt-20 lg:mt-28">
          <SectionHead id="visit-heading" eyebrow="What a visit looks like" title={c.visit.title} intro={c.visit.intro} />
          <ol className="relative grid gap-6 lg:grid-cols-5 lg:gap-5">
            <span aria-hidden="true" className="absolute left-0 right-0 top-[17px] hidden h-[3px] bg-navy lg:block" />
            {c.visit.items.map((v, i) => (
              <li key={v.time} className="relative flex gap-4 lg:flex-col lg:gap-3">
                <TapeLabel tone={i === c.visit.items.length - 1 ? "navy" : "blue"} tilt={i % 2 ? 1.5 : -1.5} className="shrink-0 self-start">
                  {v.time}
                </TapeLabel>
                <div>
                  <h3 className="text-[18px] leading-[1.2] tracking-[-0.03em]">{v.title}</h3>
                  <p className="mt-1 text-[15px] leading-[1.55] text-body">{v.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Who comes to the door. */}
        <section aria-labelledby="carer-heading" className="mt-20 grid items-center gap-10 lg:mt-28 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-20">
          <div className="flex justify-center pt-6 lg:justify-start">
            <CarerID name={c.carer.badge ?? "Your carer"} role={c.carer.role} src={c.carer.art} tilt={-3} />
          </div>
          <div>
            <hr className="mb-6 border-t-4 border-navy" />
            <p className="eyebrow">{c.carer.eyebrow ?? "Who comes to the door"}</p>
            <h2 id="carer-heading" className="mt-3 text-[30px] leading-none tracking-[-0.05em] sm:text-[44px]">
              {c.carer.title ?? "Checked before they meet them."}
            </h2>
            <ul className="mt-7 grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {c.carer.checks.map((ch) => (
                <li key={ch} className="flex items-start gap-3.5">
                  <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-navy text-[15px] font-black text-white">
                    ✓
                  </span>
                  <span className="text-[17px] font-bold leading-[1.4] text-navy">{ch}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {c.facility ? (
          /* Facility pages: work is quoted per scope, so the enquiry form takes the place of fees. */
          <section id="enquiry" aria-labelledby="enquiry-heading" className="mt-20 scroll-mt-28 lg:mt-28">
            <SectionHead id="enquiry-heading" eyebrow="Quoted per scope" title={c.facility.formTitle} intro={c.facility.formIntro} />
            <div className="max-w-[640px]">
              <FacilityEnquiryForm initialService={c.facility.service} />
            </div>
          </section>
        ) : (
          <>
        {/* Prices: the care price, then the assessment, shown apart so the two are never confused. */}
        <section aria-labelledby="prices-heading" className="mt-20 lg:mt-28">
          <SectionHead
            id="prices-heading"
            eyebrow="What it costs"
            title="Indicative fees"
            intro={
              fees.length > 0
                ? "A guide to what care typically costs. Your fee is confirmed in the care plan agreed after the assessment."
                : undefined
            }
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-7">
            <div>
              {fees.length > 0 ? (
                <>
                <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand">Care, by way of example</p>
                <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
                  {fees.map((f) => (
                    <li key={f.sku} className="flex items-center justify-between gap-3 border-2 border-navy bg-white px-4 py-3 sm:flex-col sm:items-stretch sm:justify-start sm:gap-2 sm:p-5">
                      {/* Prices read as "from" with no hours or units, so the label drops any duration too. */}
                      <p className="text-[16px] font-extrabold leading-[1.25] text-navy">{f.label.replace(/,\s*\d+\s*hours?$/i, "")}</p>
                      <p className="shrink-0 whitespace-nowrap text-[22px] font-black tracking-[-0.04em] text-price tabular-nums sm:mt-auto sm:pt-2 sm:text-[28px]">
                        <span className="mr-1.5 text-[15px] font-bold tracking-normal text-ink">from</span>₦{f.amountNaira.toLocaleString("en-NG")}
                      </p>
                    </li>
                  ))}
                </ul>
                </>
              ) : (
                <div className="flex h-full flex-col justify-center gap-2 border-2 border-navy bg-white p-6">
                  <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-brand">The care</p>
                  <p className="text-[26px] font-black leading-[1.1] tracking-[-0.04em] text-navy">Quoted after the assessment</p>
                  <p className="text-[15.5px] leading-[1.6] text-body">{c.quoted}</p>
                </div>
              )}
            </div>
            <div className="relative mt-4 flex flex-col gap-3 bg-navy p-6 pt-8 shadow-offset-blue lg:mt-0">
              <NotchTag tone="tint" outlined size="sm" className="absolute -top-3 left-6">
                One-off, before care starts
              </NotchTag>
              <p className="text-[18px] font-extrabold leading-[1.25] text-white">The home assessment</p>
              <p className="text-[34px] font-black tracking-[-0.04em] text-white tabular-nums">₦35,000</p>
              <p className="text-[15px] leading-[1.6] text-body-navy">
                A care coordinator visits once, before any care begins, to understand the needs and the home and agree the care
                plan with you. It is separate from the price of the care itself.
              </p>
            </div>
          </div>
        </section>
          </>
        )}

        {/* How it starts. */}
        <section aria-labelledby="how-heading" className="mt-20 lg:mt-28">
          <SectionHead id="how-heading" eyebrow="How it starts" title="From first message to first visit" />
          <ol className="hidden gap-6 lg:grid lg:grid-cols-4">
            {c.steps.map((st, i) => (
              <li key={st.title} className="relative border-t-4 border-navy pt-5">
                <span className={cn("grid h-11 w-11 place-items-center text-[20px] font-black text-white shadow-offset-sm", i === c.steps.length - 1 ? "bg-navy" : "bg-brand")}>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[20px] leading-[1.15] tracking-[-0.035em]">{st.title}</h3>
                <p className="mt-1.5 text-[15.5px] leading-[1.6] text-body">{st.text}</p>
              </li>
            ))}
          </ol>
          {/* Phones: the steps as arrows; tap one to read it. */}
          <div className="lg:hidden">
            <div role="tablist" aria-label="Steps" className="flex items-stretch">
              {c.steps.map((st, i) => (
                <button
                  key={st.title}
                  type="button"
                  role="tab"
                  aria-selected={step === i}
                  aria-label={`Step ${i + 1}: ${st.title}`}
                  onClick={() => setStep(i)}
                  className={cn(
                    "min-h-[48px] min-w-0 flex-1 text-[17px] font-black transition-colors",
                    i ? "mc-step -ml-1.5 pl-4" : "mc-step-first",
                    step === i ? "bg-brand text-white" : i < step ? "bg-navy text-white" : "bg-tint text-navy",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="mt-4 border-l-4 border-brand pl-4">
              <h3 className="text-[20px] leading-[1.15] tracking-[-0.035em]">{c.steps[step].title}</h3>
              <p className="mt-1.5 text-[15.5px] leading-[1.6] text-body">{c.steps[step].text}</p>
              {step < c.steps.length - 1 && (
                <button type="button" onClick={() => setStep(step + 1)} className="mt-3 text-[15px] font-extrabold text-brand">
                  Next step <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Worries, answered: the family's worry in grey, our answer in navy. */}
        <section aria-labelledby="worries-heading" className="mt-20 lg:mt-28">
          <SectionHead id="worries-heading" eyebrow="If something changes" title="Your worries, answered" />
          <ul className="hidden gap-6 lg:grid lg:grid-cols-2">
            {c.worries.map((w) => (
              <li key={w.worry} className="flex flex-col gap-2 bg-tint px-6 py-6 sm:px-7">
                <span className="text-[20px] font-medium leading-[1.25] tracking-[-0.03em] text-muted-foreground sm:text-[22px]">
                  &#8220;{w.worry}&#8221;
                </span>
                <span className="text-[19px] font-extrabold leading-[1.25] tracking-[-0.03em] text-navy sm:text-[21px]">{w.answer}</span>
              </li>
            ))}
          </ul>
          {/* Phones: the first worry open; tap the others to read the answer. */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {c.worries.map((w, i) => {
              const isOpen = openWorry === i;
              return (
                <li key={w.worry} className="bg-tint">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenWorry(isOpen ? -1 : i)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
                  >
                    <span className="text-[17px] font-medium leading-[1.3] tracking-[-0.02em] text-muted-foreground">&#8220;{w.worry}&#8221;</span>
                    <span aria-hidden="true" className="text-[20px] font-black text-navy">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <p className="px-5 pb-4 text-[18px] font-extrabold leading-[1.3] tracking-[-0.02em] text-navy">{w.answer}</p>}
                </li>
              );
            })}
          </ul>
          {!c.facility && <EmergencyBox className="mt-6 lg:max-w-[640px]" />}
        </section>

        {c.faqs && c.faqs.length > 0 && (
          <section aria-labelledby="faq-heading" className="mt-20 lg:mt-28">
            <SectionHead id="faq-heading" eyebrow="Questions" title="More questions" />
            <ul className="max-w-[860px] divide-y-2 divide-navy/10 border-y-2 border-navy/10">
              {c.faqs.map((f) => (
                <li key={f.q}>
                  <details className="group py-1">
                    <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-extrabold leading-[1.3] text-navy [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden="true" className="text-[22px] font-black text-brand group-open:hidden">+</span>
                      <span aria-hidden="true" className="hidden text-[22px] font-black text-brand group-open:inline">−</span>
                    </summary>
                    <p className="max-w-[70ch] pb-4 text-[16px] leading-[1.65] text-body">{f.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        {/* Desktop only: on phones the hero's buttons are enough, so the page ends without repeating them. */}
        <div className="hidden lg:block">
          <CTASection headline={c.cta.headline} body={c.cta.body} person={c.cta.person} serviceLine={c.serviceLine} hideRequestCare={!!c.facility} />
        </div>
      </KitMain>

      <Footer />
    </div>
  );
};

export default ServicePage;
