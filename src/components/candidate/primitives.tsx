// Candidate experience primitives.
//
// The visual contract lives in docs/candidate-experience/design-guide.md. Only
// these pieces exist: three kinds of card, one pill vocabulary, three button
// ranks, a field, a row, an eyebrow and a sentence for empty. If a screen needs
// something that is not here, the screen is probably doing too much.
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------- eyebrow ---------- */

export const CxEyebrow = ({
  children,
  onNavy = false,
  className,
}: {
  children: ReactNode;
  onNavy?: boolean;
  className?: string;
}) => (
  <p className={cn("cx-eyebrow", onNavy ? "text-muted-navy" : "text-brand", className)}>
    {children}
  </p>
);

/* ---------- status pills ---------- */

// Three tones, and the words that belong to each. A pill is a state, never a
// link. Settled or in our hands is calm blue, "you can fix this" is amber,
// closed and optional are grey. Nothing in here is ever red.
export type CxPillTone = "settled" | "needs-you" | "quiet";

const SETTLED = ["accepted", "done", "set", "confirmed", "being checked", "being reviewed"];
const NEEDS = ["needs you", "returned to you"];

export const toneForState = (label: string): CxPillTone => {
  const l = label.trim().toLowerCase();
  if (NEEDS.includes(l)) return "needs-you";
  if (SETTLED.includes(l)) return "settled";
  return "quiet";
};

const PILL_TONE: Record<CxPillTone, string> = {
  settled: "bg-tint text-navy",
  "needs-you": "bg-warn-bg text-warn-ink",
  quiet: "bg-grey-pill text-muted-foreground",
};

export const CxPill = ({
  children,
  tone,
  className,
}: {
  children: string;
  tone?: CxPillTone;
  className?: string;
}) => (
  <span
    className={cn(
      "cx-pill inline-flex shrink-0 items-center px-3 py-1.5 text-[12.5px] font-extrabold leading-none",
      PILL_TONE[tone ?? toneForState(children)],
      className,
    )}
  >
    {children}
  </span>
);

/* ---------- buttons ---------- */

// Primary is navy, and there is one per screen. On navy it inverts. Secondary
// is white with a hairline. Tertiary is text: Change, Edit, Withdraw.
import { Slot } from "@radix-ui/react-slot";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  rank?: "primary" | "secondary" | "tertiary";
  onNavy?: boolean;
  full?: boolean;
  asChild?: boolean;
};

export const CxButton = ({
  rank = "primary",
  onNavy = false,
  full = false,
  asChild = false,
  className,
  ...props
}: BtnProps) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      {...props}
      className={cn(
        "cx-control inline-flex min-h-11 items-center justify-center gap-2 text-[15px] font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none",
        rank !== "tertiary" && "px-5 py-3.5",
        rank === "primary" &&
          (onNavy ? "bg-white text-navy hover:bg-white/90" : "bg-navy text-white hover:bg-navy/90"),
        rank === "secondary" &&
          (onNavy
            ? "border-[1.5px] border-white/80 bg-transparent text-white hover:bg-white/10"
            : "border border-line bg-white text-ink hover:bg-desk/60"),
        rank === "tertiary" &&
          (onNavy ? "text-body-navy hover:text-white" : "text-brand hover:text-navy") + " min-h-0 px-0",
        full && "w-full",
        className,
      )}
    />
  );
};

/* ---------- cards ---------- */

// Quiet is the default. Emphasis carries the single next action, one per
// screen. Action-needed is bordered amber and holds the reason and the fix.
export const CxCard = ({
  kind = "quiet",
  children,
  className,
  id,
}: {
  kind?: "quiet" | "emphasis" | "navy" | "needs-you";
  children: ReactNode;
  className?: string;
  id?: string;
}) => (
  <div
    id={id}
    className={cn(
      "cx-card",
      kind === "quiet" && "border border-line bg-white",
      kind === "emphasis" && "cx-card-emph border-[1.5px] border-navy bg-white",
      kind === "navy" && "cx-card-emph relative overflow-hidden bg-navy text-body-navy",
      kind === "needs-you" && "cx-card-warn border-[1.5px] border-warn-line bg-white",
      className,
    )}
  >
    {children}
  </div>
);


// The one wash block inside an action-needed card: what we need instead.
export const CxFixBlock = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="cx-chip border border-warn-line bg-warn-wash px-4 py-3.5">
    {title && <p className="text-[13.5px] font-bold text-warn-ink">{title}</p>}
    <p className="mt-1 text-[14.5px] leading-relaxed text-ink2">{children}</p>
  </div>
);

/* ---------- rows ---------- */

export const CxRows = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("flex flex-col divide-y divide-line-soft", className)}>{children}</div>
);

// Title, then a plain sentence about the state, then a pill or a tertiary link.
// The middle column has to say something a pill cannot.
export const CxRow = ({
  title,
  sentence,
  right,
  art,
  className,
}: {
  title: string;
  sentence?: ReactNode;
  right?: ReactNode;
  /** An optional clip art object at the start of the row. */
  art?: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-[22px] sm:py-[17px]",
      className,
    )}
  >
    <div className="flex min-w-0 items-center gap-4">
      {art && <img src={art} alt="" loading="lazy" className="h-12 w-12 shrink-0 object-contain" />}
      <div className="min-w-0">
        <p className="text-[15.5px] font-bold text-ink">{title}</p>
        {sentence && <p className="mt-1 cx-measure text-[14.5px] leading-relaxed text-body">{sentence}</p>}
      </div>
    </div>
    {right && <div className={cn("flex shrink-0 items-center gap-3", art && "pl-16 sm:pl-0")}>{right}</div>}
  </div>
);

/* ---------- fields ---------- */

export const CxField = ({
  label,
  helper,
  onNavy = false,
  children,
}: {
  label: string;
  helper?: string;
  onNavy?: boolean;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className={cn("text-[13.5px] font-bold", onNavy ? "text-muted-navy" : "text-ink2")}>{label}</label>
    {children}
    {helper && (
      <p className={cn("text-[13px] leading-relaxed", onNavy ? "text-body-navy" : "text-muted-foreground")}>
        {helper}
      </p>
    )}
  </div>
);

export const cxInputClass = (onNavy = false) =>
  cn(
    "cx-chip min-h-11 w-full px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-faint",
    onNavy
      ? "border border-hairline-navy bg-white/[0.08] text-white focus:border-white/70"
      : "border border-line bg-white text-ink focus:border-brand",
  );

/* ---------- section and empty ---------- */

export const CxSection = ({
  eyebrow,
  title,
  intro,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  intro?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <section className={cn("flex flex-col gap-4", className)}>
    {(title || eyebrow || actions) && (
      <div className="cx-section-head flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <CxEyebrow className="mb-1.5">{eyebrow}</CxEyebrow>}
          {title && <h2 className="cx-heading text-[19px] text-ink">{title}</h2>}
          {intro && <p className="mt-1.5 cx-measure text-[14.5px] leading-relaxed text-body">{intro}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

// Empty is a sentence, never a blank and never a zero.
export const CxEmpty = ({ children, action, art }: { children: string; action?: ReactNode; art?: string }) => (
  <div className="flex items-center gap-5 px-5 py-8 sm:px-[22px]">
    {art && <img src={art} alt="" loading="lazy" className="h-20 w-20 shrink-0 object-contain" />}
    <div className="flex flex-col items-start gap-3">
      <p className="cx-measure text-[15px] leading-relaxed text-body">{children}</p>
      {action}
    </div>
  </div>
);
