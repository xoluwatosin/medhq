import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared layout grammar for the public site.
 *
 * Rules locked with the brand guide:
 *  - one page container width (1440) with 22 / 50px gutters
 *  - section = eyebrow + heading + hairline rule + content
 *  - surfaces use the asymmetric "kit curve" radius, never full rounding
 *  - medium density: generous but functional vertical rhythm
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
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    {title && (
      <h2 className={cn("text-[26px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]", eyebrow && "mt-3")}>
        {title}
      </h2>
    )}
    {intro && <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.7] text-body sm:text-[17px]">{intro}</p>}
    {(title || intro) && <hr className="mt-5 border-hairline-warm" />}
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
      tone === "card" && "border border-hairline-warm bg-card",
      tone === "tint" && "bg-muted",
      tone === "navy" && "bg-navy text-body-navy",
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
  "kit-curve-sm inline-flex items-center justify-center gap-2 bg-brand px-7 py-3.5 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-navy";

export const kitSecondaryButton =
  "kit-curve-sm inline-flex items-center justify-center gap-2 border-[1.5px] border-hairline-warm bg-white px-7 py-3.5 text-[16px] font-semibold text-ink transition-colors duration-200 hover:border-brand hover:text-brand";

export const kitHeroPrimaryButton =
  "kit-curve-sm inline-flex items-center justify-center gap-2 bg-white px-7 py-3.5 text-[16px] font-semibold text-navy transition-opacity duration-200 hover:opacity-90";

export const kitHeroSecondaryButton =
  "kit-curve-sm inline-flex items-center justify-center gap-2 border-[1.5px] border-outline-navy px-7 py-3.5 text-[16px] font-semibold text-white transition-colors duration-200 hover:bg-hairline-navy";

export const kitInput =
  "mt-2 w-full border border-input bg-white px-4 py-3 text-[16px] text-ink outline-none transition-colors focus:border-brand";
