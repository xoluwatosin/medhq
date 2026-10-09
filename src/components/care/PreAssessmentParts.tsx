// The pieces of the pre-assessment that are not questions: the welcome, the
// page that opens each chapter, the menu, and the thank-you. Drawn in the
// house style the care offer uses, so a family meets one brand from the first
// question to their offer.
import { ArrowRight, Check, Clock, MessageCircle, PauseCircle, SkipForward, Type } from "lucide-react";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

export const HELP_PHONE = "+234 812 698 8237";
export const HELP_WHATSAPP = "https://wa.me/2348126988237";

/* ---- The welcome ------------------------------------------------------- */

export const Welcome = ({
  greeting, heading, lead, minutes, chapters, haveReady, art, startLabel, onStart, onChangeWho, staffBanner,
}: {
  greeting: string;
  heading: string;
  lead: string;
  minutes: number;
  chapters: string[];
  haveReady: string | null;
  art: string;
  startLabel: string;
  onStart: () => void;
  onChangeWho?: () => void;
  staffBanner?: React.ReactNode;
}) => (
  <div className="mc-a11y-form flex min-h-dvh flex-col bg-background">
    {staffBanner}
    <div className="relative overflow-hidden bg-navy pt-[max(16px,env(safe-area-inset-top))]">
      <Watermark glyph="o" size={560} opacity={0.12} className="-right-[240px] -top-[120px]" />
      <div className="relative mx-auto w-full max-w-2xl px-5 sm:px-8">
        <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto" />
      </div>
      <div className="relative mx-auto flex w-full max-w-2xl items-end gap-3 px-5 sm:px-8">
        <div className="min-w-0 flex-1 pb-8 pt-9 sm:pb-12 sm:pt-12">
          <span className="inline-flex animate-in fade-in duration-500"><NotchTag tone="white" size="sm">Before your visit</NotchTag></span>
          <p className="mt-5 text-[16px] font-bold text-body-navy animate-in fade-in duration-500">{greeting}</p>
          <h1 className="mt-1.5 animate-in fade-in slide-in-from-bottom-3 text-[32px] font-extrabold leading-[1.04] tracking-[-0.045em] text-white duration-700 sm:text-[46px]">
            {heading}
          </h1>
        </div>
        <img
          src={art}
          alt=""
          aria-hidden="true"
          className="pointer-events-none -mr-2 h-[150px] w-auto shrink-0 self-end object-contain object-bottom animate-in fade-in duration-700 sm:h-[230px]"
        />
      </div>
    </div>

    <div data-read-aloud className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-6 pt-7 sm:px-8 sm:pt-10">
      <p className="text-[16px] leading-[1.6] text-body sm:text-[17px]">{lead}</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Clock, title: `About ${minutes} minutes`, line: "Fewer if some questions do not apply." },
          { icon: PauseCircle, title: "Saves as you go", line: "Stop at any time and come back to this link." },
          { icon: SkipForward, title: "Skip what you are unsure of", line: "We go through it with you at the visit." },
        ].map(({ icon: Icon, title, line }) => (
          <li key={title} className="flex items-start gap-3 border-2 border-navy bg-card p-3.5 shadow-offset-sm sm:flex-col">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-tint text-brand">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold tracking-[-0.02em] text-navy">{title}</span>
              <span className="mt-0.5 block text-[14px] leading-[1.45] text-body">{line}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <p className="label-caps text-[11px] text-label">What we will ask about</p>
        <ol className="mt-3 flex flex-col">
          {chapters.map((title, i) => (
            <li key={title} className="flex items-center gap-3 border-t border-hairline-warm py-2.5 first:border-t-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-navy text-[13px] font-extrabold text-white">{i + 1}</span>
              <span className="text-[15.5px] font-bold text-ink">{title}</span>
            </li>
          ))}
        </ol>
      </div>

      {haveReady && (
        <p className="mt-6 border-l-4 border-brand bg-tint px-4 py-3.5 text-[14.5px] leading-[1.55] text-body">
          <b className="text-navy">Good to have nearby: </b>{haveReady}
        </p>
      )}

      {onChangeWho && (
        <p className="mt-6 text-[14.5px] text-body">
          Not right?{" "}
          <button type="button" onClick={onChangeWho} className="font-bold text-brand underline underline-offset-2">
            Change who the care is for
          </button>
        </p>
      )}
    </div>

    <div className="sticky bottom-0 z-30 border-t-2 border-navy bg-background/95 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur">
      <div className="mx-auto w-full max-w-2xl px-5 sm:px-8">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 border-2 border-navy bg-brand px-5 text-[16.5px] font-extrabold text-white shadow-offset-sm transition-all hover:bg-navy active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:w-auto sm:min-w-[240px]"
        >
          {startLabel} <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
);

/* ---- The page that opens a chapter ------------------------------------ */

export const ChapterCover = ({
  number, count, who, title, line, questions, art,
}: {
  number: number;
  count: number;
  who: string | null;
  title: string;
  line: string;
  questions: number;
  art: string;
}) => (
  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
    <div className="relative -mx-5 -mt-6 overflow-hidden bg-tint px-5 pb-0 pt-7 sm:-mx-8 sm:-mt-10 sm:px-8 sm:pt-10">
      <span aria-hidden="true" className="pointer-events-none absolute -right-3 -top-8 text-[150px] font-black leading-none text-navy/[0.06]">{number}</span>
      <p className="label-caps relative text-[11px] text-brand">
        {who ? `${who} · ` : ""}Part {number} of {count}
      </p>
      <h2 className="relative mt-2 max-w-[16ch] text-[30px] font-extrabold leading-[1.04] tracking-[-0.045em] text-navy sm:text-[40px]">{title}</h2>
      <img src={art} alt="" aria-hidden="true" className="relative ml-auto mt-2 h-[150px] w-auto object-contain object-bottom sm:h-[190px]" />
    </div>
    <div className="pt-6">
      <p className="text-[16px] leading-[1.6] text-body sm:text-[17px]">{line}</p>
      <p className="mt-3 inline-flex items-center gap-2 text-[14px] font-bold text-label">
        <Clock className="h-4 w-4" aria-hidden="true" />
        {questions === 1 ? "1 question" : `${questions} questions`}, about {Math.max(1, Math.ceil((questions * 20) / 60))} {Math.ceil((questions * 20) / 60) > 1 ? "minutes" : "minute"}
      </p>
    </div>
  </div>
);

/* ---- The menu ---------------------------------------------------------- */

export interface MenuChapter {
  key: string;
  title: string;
  who: string | null;
  state: "done" | "current" | "todo";
  onGo: () => void;
}

export const MenuSheet = ({
  open, onOpenChange, chapters, onReview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: MenuChapter[];
  onReview?: () => void;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="cx-family flex w-[88vw] max-w-sm flex-col gap-0 overflow-y-auto rounded-none border-l-2 border-navy p-0 [&>button]:right-3 [&>button]:top-[max(14px,env(safe-area-inset-top))] [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-none [&>button]:text-white [&>button]:opacity-100 [&>button>svg]:h-6 [&>button>svg]:w-6">
      <div className="bg-navy px-5 pb-5 pt-[max(20px,env(safe-area-inset-top))]">
        <SheetTitle className="text-[22px] font-extrabold tracking-[-0.04em] text-white">Your questions</SheetTitle>
        <SheetDescription className="mt-1 text-[14px] leading-[1.5] text-body-navy">
          Everything saves as you go. Jump to any part.
        </SheetDescription>
      </div>
      <ol className="flex flex-col px-3 py-3">
        {chapters.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => { c.onGo(); onOpenChange(false); }}
              aria-current={c.state === "current" ? "step" : undefined}
              className={cn(
                "flex min-h-[56px] w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-tint",
                c.state === "current" && "bg-tint",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border-2 text-[13px] font-extrabold",
                  c.state === "done" ? "border-brand bg-brand text-white" : c.state === "current" ? "border-navy bg-navy text-white" : "border-navy/25 text-label",
                )}
              >
                {c.state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : c.state === "current" ? <span className="h-2 w-2 bg-white" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0">
                {c.who && <span className="block text-[12px] font-bold text-label">{c.who}</span>}
                <span className="block text-[15.5px] font-extrabold tracking-[-0.02em] text-navy">{c.title}</span>
              </span>
            </button>
          </li>
        ))}
        {onReview && (
          <li>
            <button
              type="button"
              onClick={() => { onReview(); onOpenChange(false); }}
              className="flex min-h-[56px] w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-tint"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-navy/25 text-label">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-[15.5px] font-extrabold tracking-[-0.02em] text-navy">Check and send</span>
            </button>
          </li>
        )}
      </ol>
      <div className="mt-auto flex flex-col gap-2 border-t-2 border-navy px-5 py-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <a
          href={HELP_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center gap-3 text-[15px] font-extrabold text-navy"
        >
          <MessageCircle className="h-5 w-5 text-brand" aria-hidden="true" /> Questions? WhatsApp us
        </a>
        <button
          type="button"
          onClick={() => { onOpenChange(false); window.dispatchEvent(new CustomEvent("medic:open-accessibility")); }}
          className="inline-flex min-h-12 items-center gap-3 text-left text-[15px] font-extrabold text-navy"
        >
          <Type className="h-5 w-5 text-brand" aria-hidden="true" /> Text size and reading aloud
        </button>
        <p className="mt-1 text-[13.5px] leading-[1.5] text-label">
          Or call us on {HELP_PHONE}, 7am to 10pm every day.
        </p>
      </div>
    </SheetContent>
  </Sheet>
);

/* ---- Thank you --------------------------------------------------------- */

export const Thanks = ({
  first, art, steps, children, staffBanner,
}: {
  first: string | null;
  art: string;
  steps: { title: string; line: string }[];
  children?: React.ReactNode;
  staffBanner?: React.ReactNode;
}) => (
  <div className="mc-a11y-form flex min-h-dvh flex-col bg-background">
    {staffBanner}
    <div className="relative overflow-hidden bg-navy pt-[max(16px,env(safe-area-inset-top))]">
      <Watermark glyph="o" size={520} opacity={0.12} className="-right-[220px] -top-[120px]" />
      <div className="relative mx-auto w-full max-w-2xl px-5 sm:px-8">
        <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto" />
      </div>
      <div className="relative mx-auto flex w-full max-w-2xl items-end gap-3 px-5 sm:px-8">
        <div className="min-w-0 flex-1 pb-8 pt-9 sm:pb-12">
          <span className="flex h-12 w-12 items-center justify-center bg-white text-navy shadow-[0_0_0_7px_rgba(255,255,255,0.14)] animate-in zoom-in duration-500">
            <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-[32px] font-extrabold leading-[1.04] tracking-[-0.045em] text-white animate-in fade-in slide-in-from-bottom-3 duration-700 sm:text-[44px]">
            Thank you{first ? `, ${first}` : ""}
          </h1>
          <p className="mt-3 text-[17px] font-bold leading-[1.4] text-body-navy">We have your answers.</p>
        </div>
        <img src={art} alt="" aria-hidden="true" className="pointer-events-none -mr-2 h-[150px] w-auto shrink-0 self-end object-contain object-bottom sm:h-[220px]" />
      </div>
    </div>
    <div data-read-aloud className="mx-auto w-full max-w-2xl px-5 pb-16 pt-8 sm:px-8">
      <p className="label-caps text-[11px] text-label">What happens next</p>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-4 border-2 border-navy bg-card p-4 shadow-offset-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-navy text-[15px] font-extrabold text-white">{i + 1}</span>
            <span>
              <span className="block text-[16px] font-extrabold tracking-[-0.02em] text-navy">{s.title}</span>
              <span className="mt-0.5 block text-[14.5px] leading-[1.5] text-body">{s.line}</span>
            </span>
          </li>
        ))}
      </ol>
      {children}
    </div>
  </div>
);
