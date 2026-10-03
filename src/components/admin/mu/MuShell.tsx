// Shared layout furniture for Match Universe.
//
// Every screen in this area now uses the same three pieces: a page header, a
// row of stat tiles, and titled sections. That is the whole design guide, and
// it is what stops each page inventing its own arrangement of loose text.
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const MuPage = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("space-y-8 pb-10", className)}>{children}</div>
);

export const MuPageHeader = ({
  title,
  description,
  actions,
  breadcrumb,
  backTo,
  backLabel = "Back",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) => (
  <header className="space-y-3">
    {breadcrumb}
    {backTo && (
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link to={backTo}><ArrowLeft className="mr-2 h-4 w-4" />{backLabel}</Link>
      </Button>
    )}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-2xl space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  </header>
);

export interface MuStat {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "attention";
}

export const MuStats = ({ stats, columns = 3 }: { stats: MuStat[]; columns?: 2 | 3 | 4 }) => (
  <div
    className={cn(
      "grid gap-3",
      columns === 2 && "sm:grid-cols-2",
      columns === 3 && "sm:grid-cols-3",
      columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
    )}
  >
    {stats.map((s) => (
      <Card
        key={s.label}
        className={cn(
          "border-border/70 shadow-none",
          s.tone === "attention" && "border-primary/30 bg-primary/[0.04]",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
              {s.hint && <p className="mt-1 text-xs text-muted-foreground leading-snug">{s.hint}</p>}
            </div>
            {s.icon && (
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
                  s.tone === "attention" && "bg-primary/10 text-primary",
                )}
              >
                <s.icon className="h-4 w-4" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const MuSection = ({
  title,
  description,
  actions,
  children,
  padded = true,
  className,
  id,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
  id?: string;
}) => (
  <section id={id} className={cn("rounded-none border border-line bg-card", className)}>
    {(title || actions) && (
      <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {title && <h2 className="text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>}
          {description && <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className={cn(padded && "p-5")}>{children}</div>
  </section>
);

export const MuEmpty = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    {Icon && (
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
    )}
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const MuToolbar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2 rounded-none border border-border/70 bg-muted/30 p-3 lg:flex-row lg:items-center">
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Record grammar
//
// Every fact on a Match Universe screen is shown one of three ways: a labelled
// field in a grid, a status chip, or a bordered note block. Nothing is joined
// with dots into a run-on line, because a run-on line cannot be scanned and
// truncates badly on a narrow screen. These four pieces are the whole
// vocabulary; if a screen needs something else, the something else is probably
// data that does not change what the admin does next.
// ---------------------------------------------------------------------------

/** One labelled fact. Renders "Not provided" rather than collapsing silently. */
export const MuField = ({
  label,
  icon: Icon,
  children,
  value,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  children?: ReactNode;
  value?: ReactNode;
  className?: string;
}) => {
  const body = children ?? value;
  const empty = body === null || body === undefined || body === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm leading-relaxed", empty && "text-muted-foreground")}>
        {empty ? "Not provided" : body}
      </dd>
    </div>
  );
};

export const MuFieldGrid = ({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) => (
  <dl
    className={cn(
      "grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2",
      columns === 3 && "xl:grid-cols-3",
      columns === 4 && "xl:grid-cols-4",
      className,
    )}
  >
    {children}
  </dl>
);

/**
 * A record read as a table: one row per fact, label on the left, value on the
 * right. Used wherever a list of stored fields is being read rather than
 * scanned, so nothing wraps into a column of loose text.
 */
export interface MuTableRow {
  label: string;
  value?: ReactNode;
  /** Quiet line under the value, e.g. provenance. */
  note?: ReactNode;
}

export const MuTable = ({
  rows,
  emptyLabel = "Not provided",
  className,
}: {
  rows: MuTableRow[];
  emptyLabel?: string;
  className?: string;
}) => (
  <div className={cn("overflow-hidden rounded-none border border-line", className)}>
    <table className="w-full table-fixed border-collapse text-[14.5px]">
      <tbody>
        {rows.map((r, i) => {
          const empty = r.value === null || r.value === undefined || r.value === "";
          return (
            <tr key={`${r.label}-${i}`} className="max-sm:block">
              <th
                scope="row"
                className="w-[38%] border-b border-line-soft px-4 py-3 text-left align-top text-[13.5px] font-medium text-muted-foreground max-sm:block max-sm:w-full max-sm:border-b-0 max-sm:px-4 max-sm:pb-0.5 max-sm:pt-3 sm:w-[30%]"
              >
                {r.label}
              </th>
              <td className="border-b border-line-soft px-4 py-3 align-top text-[14.5px] max-sm:block max-sm:px-4 max-sm:pb-3.5 max-sm:pt-0.5">

                <span className={cn("block break-words", empty && "text-muted-foreground")}>
                  {empty ? emptyLabel : r.value}
                </span>
                {!empty && r.note && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{r.note}</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/** A note we hold on file, never truncated: hold reasons, filing notes, returns. */
export const MuNote = ({
  title,
  children,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "warning";
  icon?: LucideIcon;
}) => (
  <div
    className={cn(
      "rounded-none border p-4",
      tone === "warning"
        ? "border-destructive/30 bg-destructive/[0.06]"
        : "border-border/70 bg-muted/40",
    )}
  >
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide",
        tone === "warning" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {title}
    </p>
    <div className={cn("mt-1.5 text-sm leading-relaxed", tone === "warning" && "text-destructive")}>
      {children}
    </div>
  </div>
);

export type MuTone = "neutral" | "good" | "warning" | "bad" | "info";

const TONE_CLASS: Record<MuTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-tint text-navy",
  // Amber carries everything recoverable. Red is kept for overdue money only,
  // which never appears on a candidate record.
  warning: "bg-warn-bg text-warn-ink",
  bad: "bg-warn-bg text-warn-ink",
  info: "bg-tint text-navy",
};


/** One chip vocabulary for the whole area, so a colour always means the same thing. */
export const MuStatus = ({
  label,
  tone = "neutral",
  icon: Icon,
  className,
}: {
  label: ReactNode;
  tone?: MuTone;
  icon?: LucideIcon;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      TONE_CLASS[tone],
      className,
    )}
  >
    {Icon && <Icon className="h-3.5 w-3.5" />}
    {label}
  </span>
);

/**
 * The item shell shared by the review queue and every profile panel: a title
 * row with its status, a grid of facts, any notes, then a single decision row
 * pushed to the right so the primary action always sits in the same place.
 */
export const MuRecord = ({
  lead,
  title,
  subtitle,
  status,
  fields,
  notes,
  actions,
  className,
}: {
  lead?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  fields?: ReactNode;
  notes?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-4 px-5 py-6", className)}>
    <div className="flex items-start gap-3">
      {lead}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-snug">{title}</div>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {status && <div className="flex shrink-0 flex-wrap items-center gap-2">{status}</div>}
    </div>
    {fields && <div className="sm:pl-[3.25rem]">{fields}</div>}
    {notes && <div className="space-y-3 sm:pl-[3.25rem]">{notes}</div>}
    {actions && (
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 sm:pl-[3.25rem]">
        {actions}
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Record hero and tab rail
//
// One navy surface per screen: the hero carries who this is, the facts we hold
// on them as a labelled grid, and a single primary action. Everything below it
// is white. The tab rail is a hairline underline, not a row of navy blocks, so
// the surface stays singular.
// ---------------------------------------------------------------------------

export interface MuHeroFact {
  label: string;
  value?: ReactNode;
  icon?: LucideIcon;
}

export const MuHero = ({
  eyebrow,
  title,
  subtitle,
  facts,
  primary,
  secondary,
  aside,
  strip,
  watermark,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  facts?: MuHeroFact[];
  primary?: ReactNode;
  secondary?: ReactNode;
  aside?: ReactNode;
  strip?: ReactNode;
  /** A figure drawn behind the plate. Callers vary it per record. */
  watermark?: ReactNode;
}) => (
  <div className="border border-line">
    <div className="relative overflow-hidden bg-navy px-5 py-7 sm:px-8 sm:py-8">
      {watermark}

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-navy">{eyebrow}</p>
          )}
          <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[30px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-body-navy">{subtitle}</p>
          )}
        </div>
        {(primary || secondary || aside) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {aside}
            {primary}
            {secondary}
          </div>
        )}
      </div>

      {facts && facts.length > 0 && (
        <dl className="relative mt-7 grid border-t border-hairline-navy/60 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "min-w-0 border-b border-hairline-navy/40 py-3.5 sm:border-b-0 sm:py-4",
                i > 0 && "sm:border-l sm:border-hairline-navy/40 sm:pl-5",
                i === facts.length - 1 && "border-b-0",
                i === 0 && "sm:pr-5",
              )}
            >
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-navy">
                {f.icon && <f.icon className="h-3.5 w-3.5 shrink-0" />}
                {f.label}
              </dt>
              <dd
                className={cn(
                  "mt-1.5 break-words text-[14.5px] leading-snug sm:truncate",
                  f.value ? "text-white" : "text-body-navy",
                )}
              >
                {f.value || "Not provided"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
    {strip}
  </div>
);

/** Three plain sentences under the hero, divided by hairlines. */
export const MuHeroStrip = ({
  items,
}: {
  items: { label: string; sentence: ReactNode }[];
}) => (
  <dl className="grid divide-y divide-line-soft border-t border-line bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
    {items.map((s) => (
      <div key={s.label} className="px-5 py-4">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</dt>
        <dd className="mt-1.5 text-[14.5px] leading-snug text-foreground">{s.sentence}</dd>
      </div>
    ))}
  </dl>
);

/**
 * A quiet hairline rail on larger screens. On a phone, a long record's
 * sections become a single labelled picker, so nobody scroll-hunts thirteen
 * tabs to find Documents. The value/onChange contract is identical either
 * way, so URL-backed tab state and aliases keep working.
 */
export const MuTabRail = ({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number | null }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
  const active = tabs.find((t) => t.value === value);
  return (
    <div className={className}>
      {/* Phone: one section picker, full width, 44px target. */}
      <div className="sm:hidden">
        <label htmlFor="mu-section-nav" className="sr-only">Record section</label>
        <div className="relative">
          <select
            id="mu-section-nav"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-full appearance-none border border-line bg-card pl-4 pr-10 text-[15px] font-semibold text-foreground"
          >
            {tabs.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}{t.count ? ` (${t.count})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {active && <span className="sr-only" role="status">{active.label} selected</span>}
      </div>

      {/* Wider screens: the hairline rail. */}
      <div
        className={cn(
          "sticky top-0 z-10 -mx-1 hidden overflow-x-auto border-b border-line bg-background/95 px-1 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:block",
        )}
        role="tablist"
      >
        <div className="flex min-w-max items-stretch gap-1">
          {tabs.map((t) => {
            const isActive = t.value === value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(t.value)}
                className={cn(
                  "relative flex min-h-[44px] items-center gap-2 px-3.5 text-[14.5px] tracking-[-0.01em] transition-colors",
                  isActive ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {!!t.count && t.count > 0 && (
                  <span className="inline-flex min-w-[1.25rem] justify-center bg-warn-bg px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-warn-ink">
                    {t.count}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn("absolute inset-x-0 bottom-0 h-[2px]", isActive ? "bg-navy" : "bg-transparent")}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export type MuRecordNavGroup = {
  label: string;
  items: { value: string; label: string; count?: number | null }[];
};

/** A record-local clinical navigation spine. URL state stays with the caller. */
export const MuRecordNav = ({ groups, value, onChange, children, className }: {
  groups: MuRecordNavGroup[];
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) => {
  const items = groups.flatMap((group) => group.items);
  return (
    <div className={cn("mt-4", className)}>
      <div className="lg:hidden">
        <label htmlFor="care-record-section" className="sr-only">Record section</label>
        <select id="care-record-section" value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full border border-line bg-card px-4 text-[15px] font-semibold text-foreground">
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map((item) => <option key={item.value} value={item.value}>{item.label}{item.count ? ` (${item.count})` : ""}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Care record sections" className="hidden border border-line bg-card lg:sticky lg:top-4 lg:block">
          <div className="border-b border-line bg-navy px-4 py-4 text-white">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">Care record</p>
            <p className="mt-1 text-[15px] font-bold">Clinical workspace</p>
          </div>
          {groups.map((group) => (
            <div key={group.label} className="border-b border-line-soft py-3 last:border-0">
              <p className="px-4 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
              {group.items.map((item) => {
                const active = item.value === value;
                return <button key={item.value} type="button" aria-current={active ? "page" : undefined} onClick={() => onChange(item.value)} className={cn("flex min-h-11 w-full items-center justify-between border-l-2 px-4 text-left text-[14px]", active ? "border-brand bg-brand-tint font-bold text-navy" : "border-transparent font-medium text-body hover:bg-desk/60 hover:text-ink")}>
                  <span>{item.label}</span>{!!item.count && <span className="bg-warn-bg px-1.5 py-0.5 text-[11px] font-bold text-warn-ink">{item.count}</span>}
                </button>;
              })}
            </div>
          ))}
        </nav>
        <main className="min-w-0 pt-4 lg:pt-0">{children}</main>
      </div>
      <span className="sr-only" role="status">{items.find((item) => item.value === value)?.label} selected</span>
    </div>
  );
};

/**
 * One row: title, then its state as plain language, then a chip or a single
 * action on the right. The shape every list on these screens uses.
 */
export const MuRow = ({
  title,
  state,
  status,
  action,
  className,
}: {
  title: ReactNode;
  state?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5", className)}>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{title}</p>
      {state && <div className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{state}</div>}
    </div>
    {status && <div className="flex shrink-0 items-center gap-2">{status}</div>}
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>
);


// ---------------------------------------------------------------------------
// Ledger grammar
//
// Documents and credentials are records in a ledger, not cards. One row per
// item: an icon tile that says what kind of thing it is, a title, one or two
// plain sentences of state, and a chip. The row itself is the control; the
// decision happens in a right hand panel where the whole record is visible.
// ---------------------------------------------------------------------------

/** The small uppercase label that opens a group. */
export const MuEyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-navy", className)}>
    {children}
  </p>
);

/** A band that opens a group of ledger rows: label, then a sentence. */
export const MuGroupHead = ({
  label,
  sentence,
  actions,
  tone = "default",
}: {
  label: string;
  sentence?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "attention";
}) => (
  <div
    className={cn(
      "flex flex-wrap items-end justify-between gap-3 border-b px-5 py-3.5",
      tone === "attention" ? "border-warn-line/40 bg-warn-bg/60" : "border-line-soft bg-muted/30",
    )}
  >
    <div className="min-w-0">
      <MuEyebrow className={tone === "attention" ? "text-warn-ink" : undefined}>{label}</MuEyebrow>
      {sentence && <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{sentence}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** A bordered ledger: a group head, then rows divided by hairlines. */
export const MuLedger = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("border border-line bg-card", className)}>{children}</div>
);

export const MuLedgerBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("divide-y divide-line-soft", className)}>{children}</div>
);

/**
 * One ledger line. The whole line is the button when onOpen is given, so an
 * admin never hunts for a control: tap the thing to work on the thing.
 */
export const MuLedgerRow = ({
  icon: Icon,
  tone = "neutral",
  title,
  sentence,
  meta,
  status,
  trailing,
  onOpen,
  selected,
}: {
  icon?: LucideIcon;
  tone?: "neutral" | "attention" | "good";
  title: ReactNode;
  sentence?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  trailing?: ReactNode;
  onOpen?: () => void;
  selected?: boolean;
}) => {
  const body = (
    <>
      {Icon && (
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center",
            tone === "attention"
              ? "bg-warn-bg text-warn-ink"
              : tone === "good"
                ? "bg-tint text-navy"
                : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold tracking-[-0.01em] text-foreground">{title}</span>
        {sentence && (
          <span className="mt-0.5 block text-[13.5px] leading-snug text-muted-foreground">{sentence}</span>
        )}
        {meta && <span className="mt-1 block text-[12.5px] leading-snug text-muted-foreground/80">{meta}</span>}
      </span>
      {status && <span className="flex shrink-0 items-center gap-2 self-center">{status}</span>}
      {trailing && <span className="flex shrink-0 items-center gap-2 self-center">{trailing}</span>}
    </>
  );

  if (!onOpen) return <div className="flex items-start gap-3 px-5 py-4">{body}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-tint/50 focus-visible:bg-tint/60 focus-visible:outline-none",
        selected && "bg-tint/60",
      )}
    >
      {body}
    </button>
  );
};

/** A labelled block inside the detail panel. */
export const MuDetailBlock = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="border-t border-line-soft px-5 py-4 first:border-t-0">
    <MuEyebrow className="text-muted-foreground">{label}</MuEyebrow>
    <div className="mt-2 text-[14.5px] leading-relaxed">{children}</div>
  </div>
);
