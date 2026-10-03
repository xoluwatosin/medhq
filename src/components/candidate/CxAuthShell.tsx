// The candidate and staff front door.
//
// Mobile is one full navy screen. Desktop splits the page in half: a light
// narrative panel on the left that says where you are and what happens next,
// and the navy door itself on the right holding the form. The form styling is
// identical in both, so nothing has to change per breakpoint.
import { ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import markTint from "@/assets/brand/m-o-tint.svg";
import logoNavy from "@/assets/brand/medicconnect-logo.svg";
import { CxNavyWatermark } from "./CxShell";
import { cxInputClass } from "./primitives";

// On a phone the navy has to run under the status bar and above the home bar.
const SAFE_AREA = {
  paddingTop: "calc(3rem + env(safe-area-inset-top))",
  paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
};
const SAFE_AREA_DOOR = {
  paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
  paddingBottom: "calc(2rem + env(safe-area-inset-bottom))",
};

export const CxAuthShell = ({
  title,
  intro,
  children,
  footer,
  aside,
  className,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  /** One quiet line, pinned to the bottom of the door. */
  footer?: ReactNode;
  /** Desktop only. The half page on the left. Usually a <CxAuthAside />. */
  aside?: ReactNode;
  className?: string;
}) => {
  // No aside: keep the centred navy card (used by the short transient states).
  if (!aside) {
    return (
      <div className="cx min-h-dvh bg-navy md:flex md:items-center md:justify-center md:bg-desk md:px-4 md:py-10">
        <div
          style={SAFE_AREA}
          className={cn(
            "relative flex min-h-dvh w-full flex-col overflow-hidden bg-navy px-[22px] md:min-h-0 md:max-w-[440px] md:px-9 md:!py-10 md:cx-shell",
            className,
          )}
        >
          <CxNavyWatermark />
          <CxAuthDoor title={title} intro={intro} footer={footer}>
            {children}
          </CxAuthDoor>
        </div>
      </div>
    );
  }

  return (
    <div className="cx min-h-dvh bg-navy md:grid md:min-h-dvh md:grid-cols-[minmax(300px,34%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-desk md:flex md:flex-col md:justify-between md:px-10 md:py-12 lg:px-12">
        <img loading="lazy" decoding="async"
          src={markTint}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 h-[460px] w-[460px] opacity-60"
        />
        {aside}
      </aside>
      <div
        style={SAFE_AREA_DOOR}
        className={cn(
          "relative flex min-h-dvh flex-col overflow-hidden bg-navy px-[22px] md:items-center md:justify-center md:px-12 md:!py-12 lg:px-16",
          className,
        )}
      >
        <CxNavyWatermark />
        <div className="relative z-10 flex w-full flex-1 flex-col md:flex-none md:max-w-[480px]">
          <div className="md:hidden">
            <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="w-[118px]" />
            <div className="mt-5 h-px w-full bg-hairline-navy" />
          </div>
          <h1 className="cx-heading mt-7 text-[26px] text-white md:mt-0 md:text-[32px]">{title}</h1>

          {intro && (
            <p className="mt-2 cx-measure text-[15px] leading-relaxed text-body-navy">{intro}</p>
          )}
          <div className="mt-7 flex flex-col gap-4">{children}</div>
          {footer && (
            <div className="mt-auto pt-10 text-[14px] leading-relaxed text-muted-navy md:mt-0">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const CxAuthDoor = ({
  title,
  intro,
  footer,
  children,
}: {
  title: string;
  intro?: string;
  footer?: ReactNode;
  children: ReactNode;
}) => (
  <div className="relative z-10 flex flex-1 flex-col">
    <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="w-[132px]" />
    <h1 className="cx-heading mt-9 text-[26px] text-white">{title}</h1>
    {intro && <p className="mt-2 cx-measure text-[15px] leading-relaxed text-body-navy">{intro}</p>}
    <div className="mt-7 flex flex-col gap-4">{children}</div>
    {footer && (
      <div className="mt-auto pt-10 text-[14px] leading-relaxed text-muted-navy">{footer}</div>
    )}
  </div>
);

/**
 * The left half. Four shapes so the doors do not all read the same:
 * "statement" for the staff doors (brand line only), "points" for sign in,
 * "steps" for anything with an order to it, and "quote" for reassurance.
 */
export const CxAuthAside = ({
  eyebrow,
  heading,
  lede,
  variant = "points",
  items = [],
  quote,
  attribution,
  note,
}: {
  eyebrow?: string;
  heading?: string;
  lede?: string;
  variant?: "points" | "steps" | "quote" | "statement";
  items?: { title: string; body?: string }[];
  quote?: string;
  attribution?: string;
  note?: ReactNode;
}) => {
  if (variant === "statement") {
    return (
      <>
        <img loading="lazy" decoding="async" src={logoNavy} alt="Medic Connect" className="relative z-10 w-[150px]" />
        <p className="font-handwritten relative z-10 max-w-[14ch] text-[44px] leading-[1.05] text-ink lg:text-[52px]">
          Inspired by illness.
        </p>
        <div className="relative z-10 h-px w-16 bg-brand" />
      </>
    );
  }

  return (
  <>
    <div className="relative z-10">
      <img loading="lazy" decoding="async" src={logoNavy} alt="Medic Connect" className="mb-12 w-[150px]" />
      {eyebrow && <p className="cx-eyebrow text-brand">{eyebrow}</p>}
      <h2 className="cx-heading mt-4 max-w-[15ch] text-[36px] leading-[1.05] text-ink lg:text-[42px]">
        {heading}
      </h2>
      {lede && (
        <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-body">{lede}</p>
      )}
    </div>

    <div className="relative z-10 mt-10">
      {variant === "quote" && quote && (
        <figure className="max-w-[42ch] border-l-[3px] border-brand pl-5">
          <blockquote className="cx-heading text-[20px] leading-snug text-ink">{quote}</blockquote>
          {attribution && (
            <figcaption className="mt-3 text-[13.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {attribution}
            </figcaption>
          )}
        </figure>
      )}

      {variant === "points" && items.length > 0 && (
        <ul className="flex max-w-[44ch] flex-col gap-5">
          {items.map((it, i) => (
            <li key={it.title} className="flex gap-4">
              <span className="cx-chip flex h-8 w-8 shrink-0 items-center justify-center bg-navy text-[13.5px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15.5px] font-bold text-ink">{it.title}</p>
                {it.body && <p className="mt-1 text-[14.5px] leading-relaxed text-body">{it.body}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {variant === "steps" && items.length > 0 && (
        <ol className="flex max-w-[44ch] flex-col">
          {items.map((it, i) => (
            <li key={it.title} className="relative flex gap-4 pb-6 last:pb-0">
              {i < items.length - 1 && (
                <span aria-hidden className="absolute left-[15px] top-9 bottom-1 w-px bg-line-soft" />
              )}
              <span className="cx-chip relative z-10 flex h-8 w-8 shrink-0 items-center justify-center bg-navy text-[13.5px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15.5px] font-bold text-ink">{it.title}</p>
                {it.body && <p className="mt-1 text-[14.5px] leading-relaxed text-body">{it.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>

    <div className="relative z-10 mt-10 font-handwritten text-[22px] leading-relaxed text-muted-foreground">
      {note ?? "Inspired by illness."}
    </div>
  </>
  );
};



/** A labelled field on navy: translucent fill, hairline border, white text. */
export const CxAuthField = ({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-[13.5px] font-bold text-body-navy">
      {label}
    </label>
    {children}
    {hint && <p className="text-[13px] leading-relaxed text-muted-navy">{hint}</p>}
  </div>
);

/** The "or" rule that separates a password from a link. */
export const CxAuthOr = () => (
  <div className="flex items-center gap-3 py-0.5">
    <span className="h-px flex-1 bg-hairline-navy" />
    <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted-navy">or</span>
    <span className="h-px flex-1 bg-hairline-navy" />
  </div>
);

/**
 * A password field on navy. Native input rather than the shadcn one so the
 * translucent fill and hairline border are not fighting the default styles,
 * and the show/hide toggle sits inside the field where a thumb expects it.
 */
export const CxAuthPassword = ({
  id,
  autoComplete = "current-password",
  value,
  onChange,
  required,
  minLength,
  onNavy = true,
}: {
  id: string;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  onNavy?: boolean;
}) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(cxInputClass(onNavy), "pr-12")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className={cn(
          "absolute right-0 top-0 flex h-full w-12 items-center justify-center",
          onNavy ? "text-muted-navy hover:text-white" : "text-muted-foreground hover:text-ink",
        )}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};
