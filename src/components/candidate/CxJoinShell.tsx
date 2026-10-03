// Shared shell for the pre-auth candidate journey: route picker, claim landing,
// account creation, and phone verification.
//
// Two shapes. Without an aside it is the plain shape: a navy top bar with the
// logo, then a white content area on the desk colour. With an aside, desktop
// mirrors the sign-in doors rather than repeating them: there the navy holds
// the form, here the navy holds the narrative and the form sits on paper.
import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";
import { CxNavyWatermark } from "./CxShell";

/**
 * The one decorated panel the join journey uses. Every screen in the journey
 * carries the same treatment so the flow reads as one place, not four pages.
 */
export const CxJoinAside = ({
  eyebrow = "Join Medic Connect",
  heading = "One profile, and the work comes to you.",
  lede,
  items = DEFAULT_ITEMS,
}: {
  eyebrow?: string;
  heading?: string;
  lede?: string;
  items?: { title: string; body?: string }[];
}) => (
  <>
    <CxNavyWatermark />
    <div className="relative z-10">
      <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="mb-12 w-[150px]" />
      <p className="cx-eyebrow text-muted-navy">{eyebrow}</p>
      <h2 className="cx-heading mt-4 max-w-[16ch] text-[34px] leading-[1.05] text-white lg:text-[40px]">
        {heading}
      </h2>
      {lede && <p className="mt-5 max-w-[46ch] text-[15.5px] leading-relaxed text-body-navy">{lede}</p>}
    </div>

    <ol className="relative z-10 mt-10 flex max-w-[44ch] flex-col">
      {items.map((it, i) => (
        <li key={it.title} className="relative flex gap-4 pb-6 last:pb-0">
          {i < items.length - 1 && (
            <span aria-hidden className="absolute left-[15px] bottom-1 top-9 w-px bg-hairline-navy" />
          )}
          <span className="cx-chip relative z-10 flex h-8 w-8 shrink-0 items-center justify-center bg-white text-[13.5px] font-extrabold text-navy">
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-[15.5px] font-bold text-white">{it.title}</p>
            {it.body && <p className="mt-1 text-[14.5px] leading-relaxed text-body-navy">{it.body}</p>}
          </div>
        </li>
      ))}
    </ol>

    <div className="relative z-10 mt-10 font-handwritten text-[22px] leading-relaxed text-muted-navy">
      Inspired by illness.
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
  children: ReactNode;
  className?: string;
}) => {
  const navigate = useNavigate();

  const topBar = (
    <header
      className={cn(
        "relative flex items-center gap-2 overflow-hidden bg-navy px-3 py-3.5",
        aside && "md:hidden",
      )}
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
      <Link to="/" className="flex flex-1 items-center md:flex-none">
        <img loading="lazy" decoding="async" src={logoWhite} alt="Medic Connect" className="w-[118px]" />
      </Link>
      <div className="flex flex-1 items-center justify-end gap-2">{headerAction}</div>
    </header>
  );

  const main = (
    <main
      className={cn(
        "flex-1 px-[18px] py-6 md:px-10 md:py-[34px]",
        aside && "md:flex md:flex-col md:justify-center",
        className,
      )}
    >
      <div className={cn("mx-auto flex w-full flex-col gap-[26px]", aside ? "max-w-[520px]" : "max-w-[900px]")}>
        <div className={cn("flex items-start justify-between gap-4", mobileLead && "hidden md:flex")}>
          <div>
            {eyebrow && <p className="cx-eyebrow mb-2 text-brand">{eyebrow}</p>}
            <h1 className="cx-heading text-[25px] text-ink md:text-[27px]">{title}</h1>
          </div>
          {aside && headerAction && <div className="hidden md:block">{headerAction}</div>}
        </div>
        {children}
      </div>
    </main>
  );


  if (!aside) {
    return (
      <div className="cx flex min-h-dvh flex-col bg-desk">
        {topBar}
        {main}
      </div>
    );
  }

  return (
    <div className="cx min-h-dvh bg-desk md:grid md:min-h-dvh md:grid-cols-[minmax(300px,34%)_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy md:flex md:flex-col md:justify-center md:gap-2 md:px-10 md:py-12 lg:px-12">
        {aside}
      </aside>
      <div className="flex min-h-dvh flex-col bg-desk">
        {topBar}
        {mobileLead && <div className="md:hidden">{mobileLead}</div>}
        {main}
      </div>
    </div>
  );
};
