// The frame a family answers questions in, from a link: the pre-assessment,
// its opening intake and the care details page.
//
// It is the house style on a phone: a slim navy bar with the logo, where they
// are and a menu, one progress line along its foot, the questions at the top
// of a plain reading column, and the action bar pinned to the bottom of the
// screen so the next step is always under the thumb.

import { Menu } from "lucide-react";
import { Watermark } from "@/components/mc/brand";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

interface FormPageProps {
  /** Shown in the bar when nothing more specific is given. */
  eyebrow: string;
  /** The page heading for screen readers. */
  title: string;
  /** Where the person is, shown in the bar: "Folake's health". */
  heading?: React.ReactNode;
  /** Zero-based index of the step showing, or null to hide progress. */
  step?: number | null;
  total?: number;
  /** How far through, from 0 to 1. Takes priority over step and total. */
  progress?: number | null;
  /** A short reminder of where the person is, over the questions. */
  chip?: React.ReactNode;
  /** Shown to the right of the chip, normally the saved state. */
  status?: React.ReactNode;
  /** Anything drawn above the questions, such as the intake's stages. */
  rail?: React.ReactNode;
  /** Opens the menu: sections, help, text size. */
  onMenu?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const FormPage = ({
  eyebrow, title, heading, step = null, total = 0, progress = null, chip, status, rail, onMenu, children, footer,
}: FormPageProps) => {
  const done = progress ?? (step !== null && total > 0 ? (step + 1) / total : null);
  return (
    <div className="mc-a11y-form cx-family flex min-h-dvh w-full flex-col bg-background">
      <header className="sticky top-0 z-40 overflow-hidden bg-navy pt-[env(safe-area-inset-top)]">
        <Watermark glyph="o" size={150} opacity={0.12} className="-right-[46px] -top-[52px]" />
        <div className="relative mx-auto flex h-[58px] w-full max-w-2xl items-center gap-3 px-4 sm:h-[64px] sm:px-8">
          <img src={logoWhite} alt="Medic Connect" className="h-[22px] w-auto shrink-0 sm:h-[26px]" />
          <span aria-hidden="true" className="h-7 w-px shrink-0 bg-white/25" />
          <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.02em] text-white sm:text-[16px]">
            {heading ?? eyebrow}
          </p>
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              aria-label="Menu: sections, help and text size"
              className="-mr-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center text-white transition-colors hover:bg-white/10"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>
        {done !== null && (
          <div
            className="relative h-[5px] w-full bg-white/15"
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(done * 100)}
          >
            <div className="h-full bg-[#8FA2FF] transition-[width] duration-500 ease-out" style={{ width: `${Math.max(3, done * 100)}%` }} />
          </div>
        )}
      </header>

      <main className="flex flex-1">
        <div data-read-aloud className="mx-auto flex w-full max-w-2xl flex-col px-5 pb-6 pt-6 sm:px-8 sm:pt-10">
          <h1 className="sr-only">{title}</h1>
          {(chip || status) && (
            <div className="mb-5 flex min-h-6 items-center justify-between gap-4">
              {chip ? <span className="label-caps min-w-0 truncate text-[11px] text-brand">{chip}</span> : <span />}
              {status}
            </div>
          )}
          {rail}
          <div className="flex flex-1 flex-col">{children}</div>
        </div>
      </main>

      {footer && (
        <div className="sticky bottom-0 z-30 border-t-2 border-navy bg-background/95 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex w-full max-w-2xl flex-row-reverse items-center gap-3 px-5 sm:justify-start sm:px-8">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
};

/** The one action that moves the person forward. */
export const PrimaryAction = ({
  onClick, disabled, quiet, children,
}: { onClick: () => void; disabled?: boolean; quiet?: boolean; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "inline-flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-2 border-2 border-navy px-5 text-[16px] font-extrabold shadow-offset-sm transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[180px] sm:flex-none",
      // Quiet when it only moves past an unanswered page: answering stays the loud thing.
      quiet ? "bg-card text-navy hover:bg-tint" : "bg-brand text-white hover:bg-navy",
    )}
  >
    {children}
  </button>
);

/** Back, or anything else quieter than the primary action. */
export const SecondaryAction = ({
  onClick, children, label,
}: { onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="inline-flex min-h-[52px] min-w-[52px] items-center justify-center gap-2 border-2 border-navy bg-card px-4 text-[15px] font-extrabold text-navy shadow-offset-sm transition-all duration-150 hover:bg-tint active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
  >
    {children}
  </button>
);

/** A quiet panel: a person, a section, a summary. */
export const FormCard = ({
  className, children,
}: { className?: string; children: React.ReactNode }) => (
  <div className={cn("border-t border-hairline-warm py-4 first:border-t-0", className)}>
    {children}
  </div>
);

/** The numbered sections, each one reachable at any point. */
export const SectionRail = ({
  count, current, answered, onSelect,
}: {
  count: number;
  /** One-based number of the section showing. */
  current: number;
  /** One-based numbers of the sections already answered. */
  answered?: number[];
  onSelect: (number: number) => void;
}) => (
  <nav aria-label="Sections" className="-mx-4 mb-4 overflow-x-auto px-4 sm:-mx-8 sm:px-8">
    <ul className="flex w-max gap-2">
      {Array.from({ length: count }).map((_, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const done = answered?.includes(n);
        return (
          <li key={n}>
            <button
              type="button"
              onClick={() => onSelect(n)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Go to section ${n} of ${count}`}
              className={cn(
                "flex h-10 w-10 items-center justify-center text-[14px] font-bold transition-colors sm:h-11 sm:w-11",
                isCurrent
                  ? "bg-navy text-primary-foreground"
                  : done
                    ? "border-2 border-navy bg-tint text-navy"
                    : "border-2 border-hairline-warm bg-background text-body hover:border-navy",
              )}
            >
              {n}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);
