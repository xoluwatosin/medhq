// The Request care surface, as a full page.
//
// The dialog version lives in RequestShell. Everything below draws the same
// thing — navy heading, segmented progress, one clear reading column and a single action bar —
// for journeys that are answered from a link rather than a pop-up.

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormPageProps {
  /** Small caps label in the navy cap. */
  eyebrow: string;
  /** The page heading for screen readers. */
  title: string;
  /** Zero-based index of the step showing, or null to hide progress. */
  step?: number | null;
  total?: number;
  /** A short reminder of where the person is. */
  chip?: React.ReactNode;
  /** Shown to the right of the chip, normally the saved state. */
  status?: React.ReactNode;
  /** The numbered section rail, drawn under the progress. */
  rail?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const FormPage = ({
  eyebrow, title, step = null, total = 0, chip, status, rail, children, footer,
}: FormPageProps) => (
  <div className="mc-a11y-form flex min-h-dvh w-full flex-col bg-card">
    <header className="relative flex min-h-[62px] shrink-0 items-center overflow-hidden bg-navy px-4 pb-2.5 pt-[max(10px,env(safe-area-inset-top))] sm:min-h-[70px] sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className="absolute right-5 top-[-42px] h-28 w-28 rounded-full border-[18px] border-primary-foreground/10 sm:right-10"
          aria-hidden="true"
        />
        <span className="label-caps text-[10px] text-muted-navy">{eyebrow}</span>
      </div>
    </header>

    <main className="flex flex-1">
      <div data-read-aloud className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-10 sm:pt-6">
        <h1 className="sr-only">{title}</h1>

        {step !== null && total > 0 && (
          <div className="mb-3 space-y-1.5">
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-[3px] flex-1 rounded-full transition-colors duration-300",
                    i <= step ? "bg-brand" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              {chip ? <span className="truncate text-[13px] font-medium text-brand">{chip}</span> : <span />}
              {status ?? (
                <span className="label-caps shrink-0 text-[10px] text-label">
                  Step {step + 1} of {total}
                </span>
              )}
            </div>
          </div>
        )}

        {rail}
        <div className="flex flex-1 flex-col justify-center py-1 sm:py-3">
          {children}
        </div>

        {footer && (
          <div className="mt-4 flex flex-row-reverse items-center gap-2 border-t border-hairline-warm pt-4 sm:justify-start sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </main>
  </div>
);

/** The one action that moves the person forward. */
export const PrimaryAction = ({
  onClick, disabled, children,
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <Button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-11 min-w-0 flex-1 rounded-lg px-4 text-[14px] font-semibold sm:w-auto sm:min-w-[148px] sm:flex-none"
  >
    {children}
  </Button>
);

/** Back, or anything else quieter than the primary action. */
export const SecondaryAction = ({
  onClick, children,
}: { onClick: () => void; children: React.ReactNode }) => (
  <Button
    type="button"
    variant="outline"
    onClick={onClick}
    className="h-11 min-w-[88px] rounded-lg border-hairline-warm px-4 text-[14px] font-semibold sm:w-auto sm:min-w-[104px]"
  >
    {children}
  </Button>
);

/** A quiet panel inside the warm card: a person, a section, a summary. */
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
                "flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold transition-colors sm:h-11 sm:w-11",
                isCurrent
                  ? "bg-navy text-primary-foreground"
                  : done
                    ? "border border-brand/40 bg-tint text-navy"
                    : "border border-hairline-warm bg-background text-body hover:border-brand/50",
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
