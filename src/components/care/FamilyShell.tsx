// The frame every family-facing care page sits in once the request is made:
// the invitation, the family's home and the proposal. It is the site's own
// look, so a family meets one brand from the first question to their care
// record: a navy band with the tilted-word heading and a character standing
// on its bottom edge, then square white cards with hard offset shadows.
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import KitPillHeading from "@/components/kit/KitPillHeading";
import { NotchTag, Watermark } from "@/components/mc/brand";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

interface FamilyShellProps {
  /** The notch tag over the heading. */
  eyebrow: string;
  /** The page heading, set as tilted word blocks. */
  title: string;
  /** Zero based indices of the heading words filled in brand blue. */
  accent?: number[];
  /** One or two sentences under the heading. */
  lead?: React.ReactNode;
  /** Shown at the right of the navy band, normally Sign out. */
  action?: React.ReactNode;
  /** A character that stands on the bottom edge of the band. */
  art?: string;
  /** Path for the page's SEO entry; family pages are never indexed. */
  path: string;
  /** A side column on wide screens (help, notes); it follows the page on a phone. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

// The public site's container: 1440 wide with 22 and 50px gutters.
const CONTAINER = "mx-auto w-full max-w-[1440px] px-[22px] sm:px-[50px]";

export const FamilyShell = ({ eyebrow, title, accent = [], lead, action, art, path, aside, children }: FamilyShellProps) => (
  <div className="flex min-h-dvh w-full flex-col bg-background">
    <SEO title={`${title} | Medic Connect`} description={title} path={path} noindex />
    <header className="relative overflow-hidden bg-navy pt-[max(16px,env(safe-area-inset-top))] sm:pt-6">
      <Watermark glyph="o" size={460} opacity={0.12} className="-right-[150px] -top-[40px]" />
      <div className={cn(CONTAINER, "relative flex items-center justify-between gap-4")}>
        <Link to="/" aria-label="Medic Connect home" className="inline-flex min-h-11 items-center">
          <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto" />
        </Link>
        {action}
      </div>
      <div className={cn(CONTAINER, "relative flex items-end gap-4")}>
        <div className={cn("min-w-0 max-w-[820px] flex-1 pb-10 pt-7 sm:pb-16 sm:pt-12", art && "pr-[92px] sm:pr-0")}>
          <span className="inline-flex"><NotchTag tone="white" size="sm">{eyebrow}</NotchTag></span>
          <div className="mt-4">
            <KitPillHeading text={title} accent={accent} align="left" size="md" />
          </div>
          {lead && <p className="mt-4 max-w-[54ch] text-[15.5px] leading-[1.6] text-body-navy sm:text-[17px]">{lead}</p>}
        </div>
        {art && (
          <img
            src={art}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-[22px] h-[118px] w-auto object-contain object-bottom sm:static sm:ml-auto sm:h-[230px] sm:shrink-0 lg:mr-[6%] lg:h-[260px]"
          />
        )}
      </div>
    </header>
    <main className={cn(CONTAINER, "flex-1 pb-[max(112px,calc(env(safe-area-inset-bottom)+96px))] pt-10 sm:pt-16 md:pb-16")}>
      <div className={cn("grid gap-10", aside && "lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14")}>
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
        {aside && <aside className="flex min-w-0 flex-col gap-6">{aside}</aside>}
      </div>
    </main>
    {/* The site footer on wide screens only; on a phone the portal ends with its content. */}
    <div className="hidden md:block"><Footer /></div>
  </div>
);

/** A square white card with a hard offset shadow. */
export const FamilyCard = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn("border-2 border-navy bg-card p-5 shadow-offset sm:p-7", className)}>{children}</section>
);

/** A heading inside a card. */
export const FamilyHeading = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <h2 className={cn("text-[22px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[26px]", className)}>
    {children}
  </h2>
);

/** A section opener between cards: a heavy navy rule and a caps label. */
export const FamilySection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section>
    <hr className="border-t-4 border-navy" />
    <p className="eyebrow mt-4">{label}</p>
    <div className="mt-4">{children}</div>
  </section>
);

/** Quiet text under a heading or between parts. */
export const FamilyText = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <p className={cn("text-[15.5px] leading-[1.6] text-body", className)}>{children}</p>
);

/** Something to know, on tint with a brand edge. */
export const FamilyNote = ({ title, art, children }: { title?: string; art?: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-4 border-l-4 border-brand bg-tint px-4 py-4 sm:px-5">
    <div className="min-w-0 flex-1">
      {title && <p className="text-[15.5px] font-extrabold tracking-[-0.02em] text-navy">{title}</p>}
      <div className={cn("text-[14.5px] leading-[1.6] text-body", title && "mt-1")}>{children}</div>
    </div>
    {art && <img src={art} alt="" aria-hidden="true" className="h-[76px] w-auto shrink-0 object-contain sm:h-[92px]" />}
  </div>
);

export const FamilyLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-40 items-center justify-center" role="status">
    <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);

/** The one thing to do next. */
export const familyPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 border-2 border-navy bg-brand px-5 text-[15px] font-extrabold text-white shadow-offset-sm transition-all duration-150 hover:bg-navy active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45";

/** Anything quieter. */
export const familySecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 border-2 border-navy bg-card px-5 text-[15px] font-extrabold text-navy shadow-offset-sm transition-all duration-150 hover:bg-tint active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-45";

/** Sign out and back links, on the navy band. */
export const familyOnNavy =
  "inline-flex min-h-11 items-center gap-2 border-2 border-outline-navy px-3 text-[14px] font-extrabold text-white transition-colors hover:bg-white hover:text-navy";

/** Square text inputs. */
export const familyInput =
  "w-full border-2 border-navy bg-card px-4 text-[16px] text-ink placeholder:text-label focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";
