import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import AudienceHero from "@/components/home/AudienceHero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { GovernedFee, GovernedModule } from "@/content/seo/governed-modules";
import { renderFeeTokens } from "@/content/seo/governed-modules";
import { processSummary } from "@/content/seo/process-summaries";
import { Chevrons, ClipArt, NotchTag, PinNote, Snapshot, Stamp, Tape } from "./brand";

/**
 * Sections shared by the service page templates (governed and expansion SEO
 * pages), built from the brand devices so roughly 75 routes read as one system.
 * Copy always comes from the governed registry mirrors; nothing here adds a claim.
 */

/** One square with a tick, the brand's stand-in for a check icon. */
export const Tick = ({ onNavy = false }: { onNavy?: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "mt-[3px] grid h-5 w-5 shrink-0 place-items-center text-[12px] font-black",
      onNavy ? "bg-white text-navy" : "bg-brand text-white",
    )}
  >
    ✓
  </span>
);

/** Section heading with the heavy navy rule that opens a section. */
export const SectionHead = ({ eyebrow, title, intro, id }: { eyebrow?: string; title: string; intro?: ReactNode; id?: string }) => (
  <div className="mb-8 sm:mb-10">
    <hr className="mb-6 border-t-4 border-navy" />
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h2 id={id} className={cn("text-[30px] leading-none tracking-[-0.05em] sm:text-[44px]", eyebrow && "mt-3")}>
      {title}
    </h2>
    {intro && <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.65] text-body">{intro}</p>}
  </div>
);

/** Navy hero: the page promise on the left, a taped snapshot with the accreditation stamp on the right. */
export const ServiceHero = ({
  tag,
  title,
  promise,
  image,
  actions,
}: {
  tag: string;
  title: string;
  promise: string;
  image?: string;
  actions: ReactNode;
}) => (
  <AudienceHero variant="split">
    <div className={cn("grid items-center gap-12", image && "lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16")}>
      <div className="flex flex-col gap-6">
        <NotchTag tone="blue">{tag}</NotchTag>
        <h1 className="text-[40px] leading-[0.98] tracking-[-0.055em] !text-white sm:text-[56px] xl:text-[64px]">{title}</h1>
        <p className="max-w-[44ch] text-[18px] leading-[1.55] text-body-navy sm:text-[20px]">{promise}</p>
        <div className="flex flex-col gap-3 pt-1 sm:flex-row">{actions}</div>
      </div>
      {image && (
        <div className="relative mx-auto w-full max-w-[460px] pt-6 lg:pt-0">
          <Snapshot src={image} alt={title} tilt={-2} />
          <Stamp title="HEFAMAA" sub="ACCREDITED" onNavy tilt={8} className="absolute -right-2 -top-4 bg-navy sm:-right-6" />
        </div>
      )}
    </div>
  </AudienceHero>
);

/** The direct answer, on a tint panel, with its points as ticked squares. */
export const AnswerPanel = ({
  heading,
  paragraphs,
  points = [],
  art,
}: {
  heading: string;
  paragraphs: string[];
  points?: string[];
  /** A clip art object, stood beside the answer on a white backing square. */
  art?: string;
}) => (
  <section aria-labelledby="direct-answer-heading" className="relative bg-tint px-6 py-8 sm:px-10 sm:py-10 lg:pr-[230px]">
    <Tape width={110} tilt={-3} className="-top-3 left-8" />
    {art && <ClipArt src={art} size={170} backing="none" className="absolute bottom-6 right-8 hidden lg:block" />}
    <p className="eyebrow">In short</p>
    <h2 id="direct-answer-heading" className="mt-3 text-[28px] leading-[1.05] tracking-[-0.045em] sm:text-[36px]">
      {heading}
    </h2>
    {paragraphs.map((p) => (
      <p key={p} className="mt-4 max-w-[70ch] text-[17px] leading-[1.7] text-ink sm:text-[18px]">
        {renderFeeTokens(p)}
      </p>
    ))}
    {points.length > 0 && (
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {points.map((point) => (
          <li key={point} className="flex gap-3 text-[15px] leading-[1.6] text-body">
            <Tick />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/** Who the page is for, as pinned notes in alternating tones and tilts. */
const NOTE_TONES = ["tint", "white", "blue", "tint"] as const;
const NOTE_TILTS = [-1.5, 1.2, -0.8, 1.6, -1.2, 0.8];
export const AudienceNotes = ({ title, entries }: { title: string; entries: string[] }) => (
  <section className="py-14 sm:py-20">
    <SectionHead title={title} />
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map((entry, i) => (
        <PinNote key={entry} tone={NOTE_TONES[i % NOTE_TONES.length]} tilt={NOTE_TILTS[i % NOTE_TILTS.length]}>
          {entry}
        </PinNote>
      ))}
    </div>
  </section>
);

/** Parts of the service: numbered, taped photo cards with a hard offset. */
export const IncludedCards = ({ title, cards }: { title: string; cards: { title: string; description: string; image: string }[] }) => (
  <section className="py-14 sm:py-20">
    <SectionHead title={title} />
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <article
          key={card.title}
          style={{ ["--mc-tilt" as string]: `${NOTE_TILTS[i % NOTE_TILTS.length] / 2}deg` }}
          className="mc-tilt relative flex flex-col border-2 border-navy bg-white shadow-offset"
        >
          <Tape width={70} tilt={i % 2 ? 4 : -4} className="-top-3 left-1/2 z-10 -ml-[35px]" />
          <img src={card.image} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
          <div className="flex flex-1 flex-col gap-2 p-5">
            <span className="text-[34px] font-black leading-none tracking-[-0.06em] text-brand">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-[20px] leading-[1.15]">{card.title}</h3>
            <p className="text-[15px] leading-[1.6] text-body">{card.description}</p>
          </div>
        </article>
      ))}
    </div>
  </section>
);

/** Published prices as tags. Lowercase "from", and the assessment line always follows. */
export const PriceTags = ({ fees }: { fees: GovernedFee[] }) => {
  const shown = fees.filter((f) => f.sku !== "PUB-ASSESSMENT");
  return (
    <section className="py-14 sm:py-20" aria-labelledby="prices-heading">
      <SectionHead
        id="prices-heading"
        eyebrow="What it costs"
        title="Prices"
        intro="Published prices are either fixed or a from price. Ongoing, live-in and package care is quoted after assessment."
      />
      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((fee) => (
            <div key={fee.sku} className="mc-fold flex flex-col gap-3 border-2 border-navy bg-white p-6">
              <NotchTag tone="tint" size="sm">{fee.unit}</NotchTag>
              <p className="text-[17px] font-extrabold leading-[1.25] text-navy">{fee.label}</p>
              <p className="mt-auto text-[30px] font-extrabold tracking-[-0.03em] text-price tabular-nums">
                {fee.treatment === "from" && <span className="mr-1.5 text-[16px] font-bold text-ink">from</span>}₦
                {fee.amountNaira.toLocaleString("en-NG")}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4 bg-navy px-6 py-5">
        <Chevrons />
        <p className="text-[16px] font-extrabold text-white">Every care plan starts with a ₦35,000 home care needs assessment.</p>
      </div>
    </section>
  );
};

/** The governed process modules, numbered in square navy blocks. */
export const ProcessSteps = ({ modules }: { modules: GovernedModule[] }) => (
  <section className="py-14 sm:py-20">
    <SectionHead eyebrow="Step by step" title="How this works" />
    <Accordion type="single" collapsible className="max-w-3xl border-2 border-navy bg-white shadow-offset-tint">
      {modules.map((module, index) => (
        <AccordionItem key={module.code} value={module.code} className="border-b border-hairline px-5 last:border-b-0 sm:px-6">
          <AccordionTrigger className="py-4 text-left hover:no-underline">
            <span className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center bg-navy text-[16px] font-black text-white tabular-nums">
                {index + 1}
              </span>
              <span className="text-[17px] font-extrabold text-navy">{module.heading}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pl-14">
            <p className="text-[16px] leading-[1.7] text-body">
              {renderFeeTokens(processSummary(module.code, module.paragraphs[0] ?? ""))}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);

/** Why Medic Connect, on a navy band with ticked squares. */
export const WhyBand = ({
  eyebrow,
  reasons,
  person,
}: {
  eyebrow?: string;
  reasons: { title: string; description: string }[];
  /** A character, standing on the bottom edge of the band. */
  person?: string;
}) => (
  <section className={cn("relative my-14 overflow-hidden bg-navy px-6 py-12 sm:my-20 sm:px-12 sm:py-14", person && "lg:pr-[260px]")}>
    {person && (
      <img src={person} alt="" aria-hidden="true" loading="lazy" className="pointer-events-none absolute bottom-0 right-10 hidden h-[300px] lg:block" />
    )}
    {eyebrow && <p className="eyebrow mb-3 !text-muted-navy">{eyebrow}</p>}
    <h2 className="text-[30px] leading-none tracking-[-0.05em] !text-white sm:text-[44px]">Why Medic Connect</h2>
    <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {reasons.map((r) => (
        <li key={r.title} className="flex gap-3.5">
          <Tick onNavy />
          <span>
            <b className="block text-[17px] font-extrabold text-white">{r.title}</b>
            <span className="mt-1 block text-[15px] leading-[1.6] text-body-navy">{r.description}</span>
          </span>
        </li>
      ))}
    </ul>
  </section>
);

/** Related pages as folder-tab links with a chevron run. */
export const RelatedLinks = ({ links }: { links: { label: string; path: string }[] }) => (
  <section className="py-14 sm:py-16">
    <SectionHead eyebrow="Keep reading" title="Related pages" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className="group flex items-center justify-between gap-4 border-2 border-navy bg-white px-5 py-4 shadow-offset-sm transition-colors duration-200 hover:bg-tint"
        >
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-navy">{link.label}</span>
          <Chevrons colors={["hsl(var(--brand))", "hsl(var(--brand))", "hsl(var(--navy))"]} size={14} />
        </Link>
      ))}
    </div>
  </section>
);

/** Two-column comparison, framed in navy. */
export const ComparisonTable = ({
  heading,
  leftLabel,
  rightLabel,
  rows,
}: {
  heading: string;
  leftLabel: string;
  rightLabel: string;
  rows: { label: string; left: string; right: string }[];
}) => (
  <section className="py-14 sm:py-20">
    <SectionHead title={heading} />
    <div className="max-w-4xl border-2 border-navy bg-white shadow-offset-tint">
      <div className="hidden grid-cols-3 gap-6 bg-navy px-5 py-4 sm:grid">
        <span className="sr-only">Comparison</span>
        <p className="label-caps !text-muted-navy">{leftLabel}</p>
        <p className="label-caps !text-muted-navy">{rightLabel}</p>
      </div>
      {rows.map((row, i) => (
        <div key={row.label} className={cn("grid gap-1 px-5 py-4 sm:grid-cols-3 sm:gap-6", i > 0 && "border-t border-hairline")}>
          <p className="text-[15px] font-extrabold text-navy">{row.label}</p>
          <p className="text-[15px] leading-[1.6] text-body">
            <span className="label-caps mb-1 block sm:hidden">{leftLabel}</span>
            {row.left}
          </p>
          <p className="text-[15px] leading-[1.6] text-body">
            <span className="label-caps mb-1 block sm:hidden">{rightLabel}</span>
            {row.right}
          </p>
        </div>
      ))}
    </div>
  </section>
);

/** A checklist on a sheet of paper. */
export const ChecklistSheet = ({ heading, items }: { heading: string; items: string[] }) => (
  <section className="py-14 sm:py-20">
    <SectionHead title={heading} />
    <div className="relative max-w-3xl border-2 border-navy bg-white p-6 shadow-offset sm:p-8">
      <Tape width={90} tilt={3} className="-top-3 right-10" />
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[16px] leading-[1.6] text-ink">
            <Tick />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </section>
);
