// Shared shell for the pre-auth candidate journey: claim landing, account
// creation, email confirmation and the first profile answers.
//
// Built like the public site: a navy hero carries the progress, the headline
// and the person for the route; the form hangs from the hero on square paper;
// beside it a pinned note says what happens next. Phones stack the same parts
// with the form straight after the hero. Field and card styles drawn by the
// shared candidate primitives are adjusted under .cx-join only, so the
// signed-in portal is untouched.
import { ReactNode, isValidElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import { TapeLabel, Watermark } from "@/components/mc/brand";
import { art as clipArt } from "@/components/mc/art";

const JOIN_STEPS = ["Account", "Confirm", "Profile"];

interface IntroProps {
  eyebrow?: string;
  heading?: string;
  lede?: string;
  items?: { title: string; body?: string }[];
  /** The item the candidate is on now; earlier ones show as done. */
  current?: number;
  /** The person standing in the hero. */
  art?: string;
}

/**
 * Describes the journey for the shell: the line under the headline, what
 * happens next and the person in the hero. Pass it as `aside`; the shell lays
 * it out, so it renders nothing on its own.
 */
export const CxJoinAside = (_props: IntroProps) => null;

const DEFAULT_ITEMS = [
  { title: "Tell us who you are", body: "A few details and a password. Two minutes." },
  { title: "Add your documents once", body: "We hold them, so you never fill the same form twice." },
  { title: "Say when you are free", body: "We only put you forward for work that fits." },
];

const NextNote = ({ intro }: { intro: IntroProps }) => {
  const items = intro.items ?? DEFAULT_ITEMS;
  const current = intro.current ?? 0;
  return (
    <div className="relative rotate-[0.8deg] bg-tint p-6 pt-8 shadow-offset sm:p-7 sm:pt-9">
      <span aria-hidden="true" className="absolute left-1/2 -top-2 -ml-2 h-4 w-4 bg-brand shadow-[2px_2px_0_hsl(var(--navy))]" />
      <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] text-brand">What happens next</p>
      {intro.lede && <p className="mt-3 text-[15px] leading-[1.6] text-body">{intro.lede}</p>}
      <ol className="mt-5 flex flex-col gap-4">
        {items.map((it, i) => {
          const done = i < current;
          const on = i === current;
          return (
            <li key={it.title} className="flex gap-3.5">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center text-[14px] font-black",
                  on && "bg-navy text-white shadow-[3px_3px_0_hsl(var(--brand))]",
                  done && "bg-brand text-white",
                  !on && !done && "border-2 border-navy/25 text-navy/60",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn("text-[15.5px] font-extrabold leading-[1.3]", on ? "text-navy" : "text-navy/75")}>{it.title}</p>
                {it.body && <p className="mt-1 text-[14px] leading-[1.55] text-body">{it.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <TapeLabel tone="navy" tilt={-3} className="mt-7">
        Inspired by illness.
      </TapeLabel>
    </div>
  );
};

export const CxJoinShell = ({
  title,
  eyebrow,
  back,
  headerAction,
  aside,
  step,
  heroExtra,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  back?: string;
  headerAction?: ReactNode;
  /** Kept for older callers; the hero now introduces every screen. */
  mobileLead?: ReactNode;
  /** A <CxJoinAside /> describing the journey. */
  aside?: ReactNode;
  /** Where the candidate is in sign-up: 0 account, 1 confirm, 2 profile. */
  step?: number;
  /** Small things that belong under the headline, such as the chosen route. */
  heroExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const navigate = useNavigate();
  const intro: IntroProps | undefined = isValidElement(aside) ? (aside.props as IntroProps) : undefined;
  const person = intro?.art ?? clipArt.charNurse;

  return (
    <div className="cx cx-join min-h-dvh bg-white">
      <header className="relative overflow-hidden bg-navy">
        <Watermark glyph="inf" size={620} opacity={0.12} className="-right-[200px] -top-[160px] hidden md:block" />
        
        <div
          className="relative mx-auto flex max-w-[1180px] items-center gap-2 px-3 py-3.5 md:px-10 md:pt-6"
          style={{ paddingTop: "calc(0.875rem + env(safe-area-inset-top))" }}
        >
          {back ? (
            <button
              type="button"
              onClick={() => (back.startsWith("http") ? (window.location.href = back) : navigate(back))}
              aria-label="Go back"
              className="flex h-11 w-11 items-center justify-center text-white md:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-11 md:hidden" />
          )}
          <Link to="/" className="flex flex-1 items-center justify-center md:flex-none md:justify-start">
            <img decoding="async" src={logoWhite} alt="Medic Connect" className="w-[118px] md:w-[150px]" />
          </Link>
          <div className="flex flex-1 items-center justify-end gap-2 [&_a]:!text-white [&_button]:!text-white">{headerAction}</div>
        </div>

        <div className="relative mx-auto max-w-[1180px] px-[18px] pb-6 pt-1 md:px-10 md:pb-[130px] md:pt-10">
          <div className="max-w-[620px]">
            {step !== undefined && (
              <ol aria-label={`Step ${step + 1} of ${JOIN_STEPS.length}: ${JOIN_STEPS[step]}`} className="hidden max-w-[440px] items-stretch md:flex">
                {JOIN_STEPS.map((label, i) => (
                  <li
                    key={label}
                    aria-current={i === step ? "step" : undefined}
                    className={cn(
                      "min-w-0 flex-1 whitespace-nowrap py-2.5 pr-4 text-[12px] font-extrabold sm:text-[13px]",
                      i ? "mc-step -ml-1.5 pl-[22px]" : "mc-step-first pl-3.5",
                      i === step ? "bg-brand text-white" : i < step ? "bg-white/20 text-white" : "bg-white text-navy",
                    )}
                  >
                    {i < step ? `✓ ${label}` : label}
                  </li>
                ))}
              </ol>
            )}
            {step !== undefined && (
              <div aria-hidden="true" className="flex items-center gap-3 md:hidden">
                <span className="text-[13px] font-extrabold text-brand-soft">
                  Step {step + 1} of {JOIN_STEPS.length}
                </span>
                <span className="flex flex-1 gap-1">
                  {JOIN_STEPS.map((l, i) => (
                    <span key={l} className={cn("h-1 flex-1", i <= step ? "bg-brand-soft" : "bg-white/20")} />
                  ))}
                </span>
              </div>
            )}
            {eyebrow && <p className="eyebrow mt-9 hidden !text-brand-soft md:block">{eyebrow}</p>}
            <h1 className="mt-3 text-[28px] leading-[1.02] tracking-[-0.05em] !text-white sm:text-[44px] md:text-[56px]">{title}</h1>
            {intro?.heading && <p className="mt-4 hidden max-w-[38ch] md:block text-[16.5px] leading-[1.5] text-body-navy md:text-[20px]">{intro.heading}</p>}
            {heroExtra && <div className="mt-5 hidden md:block">{heroExtra}</div>}
          </div>
          <img
            src={person}
            alt=""
            className="pointer-events-none absolute bottom-0 right-4 hidden h-[200px] max-w-[34%] object-contain object-right-bottom md:block md:right-10 md:h-[300px] lg:right-[90px] lg:h-[340px]"
          />
        </div>
      </header>

      <main
        className={cn(
          "relative mx-auto grid max-w-[1180px] gap-10 px-[18px] pb-16 pt-6 md:-mt-[96px] md:grid-cols-[minmax(0,1fr)_300px] md:px-10 md:pt-0 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-16",
          className,
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        {intro && (
          <div className="md:pt-[130px]">
            <NextNote intro={intro} />
          </div>
        )}
      </main>
    </div>
  );
};
