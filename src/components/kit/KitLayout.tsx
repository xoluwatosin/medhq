import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared layout grammar for the public site.
 *
 * Rules locked with the brand guide:
 *  - one page container width (1440) with 22 / 50px gutters
 *  - section = eyebrow + heading + hairline rule + content
 *  - surfaces are square with hard offset shadows; 10px only on controls
 *  - headings are 800 with tight tracking; a heavy navy rule opens a section
 */

export const KitMain = ({ children, className }: { children: ReactNode; className?: string }) => (
  <main className={cn("mx-auto max-w-[1440px] px-[22px] py-16 sm:px-[50px] sm:py-20", className)}>
    {children}
  </main>
);

interface KitSectionProps {
  title?: string;
  eyebrow?: string;
  intro?: string;
  /** Narrow reading measure for prose heavy sections. */
  narrow?: boolean;
  children: ReactNode;
  className?: string;
}

export const KitSection = ({ title, eyebrow, intro, narrow, children, className }: KitSectionProps) => (
  <section className={cn("mt-14 first:mt-0 sm:mt-20", narrow && "mx-auto max-w-[820px]", className)}>
    {(title || intro) && <hr className="mb-6 border-t-4 border-navy" />}
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    {title && (
      <h2 className={cn("text-[32px] leading-[1] tracking-[-0.05em] sm:text-[44px]", eyebrow && "mt-3")}>
        {title}
      </h2>
    )}
    {intro && <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.7] text-body sm:text-[17px]">{intro}</p>}
    <div className={cn(title || intro ? "mt-8" : undefined)}>{children}</div>
  </section>
);

export const KitPanel = ({
  children,
  className,
  tone = "card",
}: {
  children: ReactNode;
  className?: string;
  tone?: "card" | "tint" | "navy";
}) => (
  <div
    className={cn(
      "kit-curve p-6 sm:p-8",
      tone === "card" && "border-2 border-navy bg-card shadow-offset-tint",
      tone === "tint" && "bg-muted",
      tone === "navy" && "bg-navy text-body-navy shadow-offset-blue",
      className,
    )}
  >
    {children}
  </div>
);

export const KitFacts = ({ items }: { items: { label: string; value: ReactNode }[] }) => (
  <dl className="divide-y divide-hairline-warm">
    {items.map((item) => (
      <div key={item.label} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
        <dt className="label-caps text-label">{item.label}</dt>
        <dd className="text-[16px] leading-[1.6] text-ink">{item.value}</dd>
      </div>
    ))}
  </dl>
);

export const kitPrimaryButton =
  "kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 bg-brand px-7 py-3.5 text-[16px] font-extrabold text-white transition-colors duration-200 hover:bg-navy";

export const kitSecondaryButton =
  "kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 border-[1.5px] border-brand bg-white px-7 py-3.5 text-[16px] font-extrabold text-brand transition-colors duration-200 hover:border-navy hover:text-navy";

export const kitHeroPrimaryButton =
  "kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-extrabold text-navy transition-colors duration-200 hover:bg-tint";

export const kitHeroSecondaryButton =
  "kit-curve-sm inline-flex min-h-[48px] items-center justify-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-extrabold text-white transition-colors duration-200 hover:bg-hairline-navy";

export const kitInput =
  "kit-curve-sm mt-2 w-full border-[1.5px] border-input bg-white px-4 py-3 text-[16px] text-ink outline-none transition-colors focus:border-brand";
