// Shared shell for the pre-auth candidate journey: route picker, claim landing,
// account creation, email confirmation and the first profile answers.
//
// In the house style of the public site: on desktop a navy half page carries
// the narrative (watermark, the person, the steps with the current one lit)
// and the form sits on white paper with a hard offset. Phones get a navy bar,
// the three-step progress, then the form. Styles that the shared candidate
// primitives draw are adjusted under .cx-join only, so the signed-in portal is
// untouched.
import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import { ChevronSteps, TapeLabel, Watermark } from "@/components/mc/brand";
import { art as clipArt } from "@/components/mc/art";

const JOIN_STEPS = ["Account", "Confirm", "Profile"];

/**
 * The one decorated panel the join journey uses. Every screen carries the same
 * treatment so the flow reads as one place, not four pages.
 */
export const CxJoinAside = ({
  eyebrow = "Join Medic Connect",
  heading = "One profile, and the work comes to you.",
  lede,
  items = DEFAULT_ITEMS,
  current = 0,
  art = clipArt.charNurse,
}: {
  eyebrow?: string;
  heading?: string;
  lede?: string;
  items?: { title: string; body?: string }[];
  /** The item the candidate is on now; earlier ones show as done. */
  current?: number;
  /** The person standing at the foot of the panel. */
  art?: string;
}) => (
  <>
    <Watermark glyph="inf" size={520} opacity={0.12} className="-right-[180px] -top-[120px]" />
    <div className="relative z-10">
      <Link to="/">
        <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="mb-10 w-[150px]" />
      </Link>
      <p className="eyebrow !text-brand-soft">{eyebrow}</p>
      <h2 className="mt-4 max-w-[15ch] text-[34px] leading-[1.02] tracking-[-0.05em] !text-white lg:text-[42px]">{heading}</h2>
      {lede && <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.6] text-body-navy">{lede}</p>}
    </div>

    <ol className="relative z-10 mt-9 flex max-w-[42ch] flex-col gap-4">
      {items.map((it, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={it.title} className="flex gap-4">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center text-[15px] font-black",
                on && "bg-white text-navy shadow-[4px_4px_0_hsl(var(--brand))]",
                done && "bg-brand text-white",
                !on && !done && "border-2 border-white/30 text-white/70",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-[15.5px] font-extrabold", on ? "text-white" : "text-body-navy")}>{it.title}</p>
              {it.body && <p className="mt-1 text-[14px] leading-[1.55] text-body-navy">{it.body}</p>}
            </div>
          </li>
        );
      })}
    </ol>

    <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-10">
      <TapeLabel tone="tint" tilt={-3} className="mb-6">
        Inspired by illness.
      </TapeLabel>
      <img src={art} alt="" className="pointer-events-none -mb-12 h-[200px] object-contain lg:h-[230px]" />
    </div>
  </>
);

const DEFAULT_ITEMS = [
  { title: "Tell us who you are", body: "A few details and a password. Two minutes." },
  { title: "Add your documents once", body: "We hold them, so you never fill the same form twice." },
  { title: "Say when you are free", body: "We only put you forward for work that fits." },
];

export const CxJoinShell = ({
  title,
  eyebrow,
  back,
  headerAction,
  mobileLead,
  aside,
  step,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  back?: string;
  headerAction?: ReactNode;
  /** Optional mobile-only introduction placed directly below the navy bar. */
  mobileLead?: ReactNode;
  /** Desktop only. The navy half page on the left. Usually a <CxJoinAside />. */
  aside?: ReactNode;
  /** Where the candidate is in sign-up: 0 account, 1 confirm, 2 profile. */
  step?: number;
  children: ReactNode;
  className?: string;
}) => {
  const navigate = useNavigate();

  const topBar = (
    <header
      className={cn("relative flex items-center gap-2 overflow-hidden bg-navy px-3 py-3.5", aside && "md:hidden")}
      style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
    >
      <Watermark glyph="inf" size={180} opacity={0.12} className="-right-[50px] -top-[60px]" />
      {back ? (
        <button
          type="button"
          onClick={() => (back.startsWith("http") ? (window.location.href = back) : navigate(back))}
          aria-label="Go back"
          className="relative flex h-11 w-11 items-center justify-center text-white md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : (
        <span className="w-11 md:hidden" />
      )}
      <Link to="/" className="relative flex flex-1 items-center md:flex-none">
        <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="w-[118px]" />
      </Link>
      <div className="relative flex flex-1 items-center justify-end gap-2">{headerAction}</div>
    </header>
  );

  const progress =
    step !== undefined ? (
      <div aria-label={`Step ${step + 1} of ${JOIN_STEPS.length}: ${JOIN_STEPS[step]}`} role="img">
        <ChevronSteps steps={JOIN_STEPS} current={step} />
      </div>
    ) : null;

  const main = (
    <main className={cn("flex-1 px-[18px] py-6 md:px-10 md:py-[34px]", aside && "md:flex md:flex-col md:justify-center", className)}>
      <div className={cn("mx-auto flex w-full flex-col gap-[26px]", aside ? "max-w-[540px]" : "max-w-[900px]")}>
        {progress && <div className={cn(mobileLead && "hidden md:block")}>{progress}</div>}
        <div className={cn("flex items-start justify-between gap-4", mobileLead && "hidden md:flex")}>
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h1 className="text-[28px] leading-[1.05] tracking-[-0.05em] text-navy md:text-[36px]">{title}</h1>
          </div>
          {aside && headerAction && <div className="hidden pt-1 md:block">{headerAction}</div>}
        </div>
        {children}
      </div>
    </main>
  );

  if (!aside) {
    return (
      <div className="cx cx-join flex min-h-dvh flex-col bg-white">
        {topBar}
        {main}
      </div>
    );
  }

  return (
    <div className="cx cx-join min-h-dvh bg-white md:grid md:min-h-dvh md:grid-cols-[minmax(320px,36%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-2 md:px-10 md:pt-12 lg:px-12">
        {aside}
      </aside>
      <div className="flex min-h-dvh flex-col bg-white">
        {topBar}
        {mobileLead && <div className="md:hidden">{mobileLead}</div>}
        {mobileLead && progress && <div className="px-[18px] pt-5 md:hidden">{progress}</div>}
        {main}
      </div>
    </div>
  );
};
