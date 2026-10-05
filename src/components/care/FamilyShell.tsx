// The frame every family-facing care page sits in once the request is made:
// the invitation, the family's home and the proposal. It is the same navy cap
// and single reading column as the request and pre-assessment forms, so a
// family meets one look from the first question to their care record.
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";
import logoWhite from "@/assets/brand/medicconnect-logo-white.svg";

interface FamilyShellProps {
  /** Small caps label under the logo. */
  eyebrow: string;
  /** The page heading. */
  title: string;
  /** One or two sentences under the heading. */
  lead?: React.ReactNode;
  /** Shown at the right of the navy cap, normally Sign out. */
  action?: React.ReactNode;
  /** Path for the page's SEO entry; family pages are never indexed. */
  path: string;
  children: React.ReactNode;
}

export const FamilyShell = ({ eyebrow, title, lead, action, path, children }: FamilyShellProps) => (
  <div className="flex min-h-dvh w-full flex-col bg-desk">
    <SEO title={`${title} | Medic Connect`} description={title} path={path} noindex />
    <header className="relative overflow-hidden bg-navy px-4 pb-6 pt-[max(16px,env(safe-area-inset-top))] sm:px-8 sm:pb-8 sm:pt-6">
      <div
        className="absolute right-[-30px] top-[-60px] h-44 w-44 rounded-full border-[26px] border-primary-foreground/10"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
        <Link to="/" aria-label="Medic Connect home" className="inline-flex min-h-11 items-center">
          <img src={logoWhite} alt="Medic Connect" className="h-8 w-auto" />
        </Link>
        {action}
      </div>
      <div className="relative mx-auto mt-6 w-full max-w-2xl">
        <span className="label-caps text-[11px] !text-[#A8B0E8]">{eyebrow}</span>
        <h1 className="mt-2 text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-primary-foreground sm:text-[34px]">
          {title}
        </h1>
        {lead && <p className="mt-2 max-w-xl text-[15.5px] leading-relaxed text-[#C6CBF0]">{lead}</p>}
      </div>
    </header>
    <main className="flex-1 px-4 pb-[max(28px,env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">{children}</div>
    </main>
  </div>
);

/** A white panel in the reading column. */
export const FamilyCard = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn("rounded-2xl border border-hairline-warm bg-card p-5 sm:p-6", className)}>{children}</section>
);

/** A heading inside a card. */
export const FamilyHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">{children}</h2>
);

/** Quiet text under a heading or between parts. */
export const FamilyText = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <p className={cn("text-[15px] leading-relaxed text-body", className)}>{children}</p>
);

/** Something to know, on tint. */
export const FamilyNote = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-tint px-4 py-3">
    {title && <p className="text-[14.5px] font-semibold text-ink">{title}</p>}
    <div className={cn("text-[14.5px] leading-relaxed text-body", title && "mt-0.5")}>{children}</div>
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-brand/90 disabled:opacity-50";

/** Anything quieter. */
export const familySecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-hairline-warm bg-card px-5 text-[15px] font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-50";

/** Sign out, on the navy cap. */
export const familyOnNavy =
  "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold text-primary-foreground/90 hover:bg-primary-foreground/10";
