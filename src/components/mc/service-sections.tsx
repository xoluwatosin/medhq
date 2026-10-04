import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Chevrons, Tape } from "./brand";

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
