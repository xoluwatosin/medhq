// The shared skin for every short form on the site, drawn in the site's own
// language: a square card with a hard offset, a navy cap with a character on
// its edge, notched tags, illustrated choice cards and square buttons.

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NotchTag, Watermark } from "@/components/mc/brand";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check } from "lucide-react";
import { DIAL_CODES } from "./care-kinds";

interface ShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Small caps label in the navy cap. */
  eyebrow: string;
  /** Read out to screen readers in place of a visible title. */
  title: string;
  /** Zero-based index of the question showing, or null to hide progress. */
  step?: number | null;
  total?: number;
  /** A short reminder of what they have chosen so far. */
  chip?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
  /** A character standing on the bottom edge of the navy cap. */
  art?: string;
}

export const RequestShell = ({
  open, onOpenChange, eyebrow, title, step = null, total = 0, chip, children, footer, scrollRef, art,
}: ShellProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent scrollBehavior="shell" className="flex max-h-[calc(100dvh-max(32px,env(safe-area-inset-top)+env(safe-area-inset-bottom)+16px))] w-[calc(100%-28px)] max-w-[600px] flex-col gap-0 overflow-hidden rounded-none border-2 border-navy bg-navy p-0 shadow-[8px_8px_0_hsl(var(--brand))] sm:max-h-[92dvh] [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-none [&>button]:bg-primary-foreground/10 [&>button]:text-primary-foreground [&>button]:opacity-100 [&>button]:ring-offset-navy hover:[&>button]:bg-primary-foreground/20">
      <DialogTitle className="sr-only">{title}</DialogTitle>

      {/* The navy cap: the site's hero in small, with its watermark and a
          character standing on the bottom edge. */}
      <div className="relative h-[78px] shrink-0 overflow-hidden bg-navy px-5 pr-16 sm:h-[86px] sm:px-7">
        <Watermark glyph="o" size={180} opacity={0.14} className="-right-[50px] -top-[70px]" />
        <div className="relative flex h-full items-center">
          <span className="inline-flex"><NotchTag tone="white" size="sm">{eyebrow}</NotchTag></span>
        </div>
        {art && (
          <img
            src={art}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 right-[60px] h-[58px] object-contain min-[420px]:h-[70px] sm:right-20 sm:h-[82px]"
          />
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-5 sm:px-7 sm:pb-6">
        {step !== null && total > 0 && (
          <div className="mb-5">
            <div className="flex gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-[5px] flex-1 transition-colors duration-300 ${i <= step ? "bg-brand" : "bg-tint"}`} />
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-4">
              {chip ? <span className="truncate text-[13px] font-extrabold text-brand">{chip}</span> : <span />}
              <NotchTag tone="tint" size="sm">Step {step + 1} of {total}</NotchTag>
            </div>
          </div>
        )}

        {children}

        {footer && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t-2 border-navy pt-4">
            {footer}
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);

/** One question, with its helper line, sliding in as it arrives. */
export const Question = ({
  heading, help, stepKey, children,
}: { heading: string; help?: string; stepKey: string | number; children: React.ReactNode }) => (
  <div key={stepKey} className="animate-in fade-in slide-in-from-right-4 duration-300">
    <h2 className="mb-1.5 text-[22px] font-extrabold leading-[1.1] tracking-[-0.04em] text-navy sm:text-[26px]">{heading}</h2>
    {help && <p className="mb-4 text-[15px] leading-[1.55] text-body">{help}</p>}
    {children}
  </div>
);

/** "from ₦18,000" in price red, or the quoted-after-assessment line. */
export const PriceLine = ({ price }: { price?: string }) =>
  price ? (
    <span className="whitespace-nowrap tabular-nums">
      <span className="mr-1 text-[11px] font-bold text-ink">from</span>
      <b className="text-[15px] font-extrabold tracking-[-0.03em] text-price">{price}</b>
    </span>
  ) : (
    <span className="text-[11.5px] font-bold leading-tight text-label">Quoted after assessment</span>
  );

/** A square choice card. With art it carries the service illustration on a
 *  tint square, and a price when one is given. */
export const Choice = ({
  label, blurb, selected, onClick, art, price,
}: {
  label: string; blurb?: string; selected: boolean; onClick: () => void;
  art?: string;
  /** Pass "" to show "Quoted after assessment"; leave out for no price line. */
  price?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`group flex w-full items-center gap-3 border-2 bg-card p-2.5 text-left transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
      selected
        ? "border-navy bg-tint shadow-offset-blue"
        : "border-navy shadow-offset-sm hover:bg-tint/60"
    } ${art ? "" : "px-4 py-3"}`}
  >
    {art && (
      <span className="relative h-[60px] w-[64px] shrink-0 bg-tint">
        <img src={art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[56px] object-contain" />
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-[15.5px] font-extrabold leading-[1.2] tracking-[-0.02em] text-navy">{label}</span>
      {blurb && <span className="mt-0.5 block text-[13.5px] leading-[1.4] text-body">{blurb}</span>}
      {price !== undefined && <span className="mt-1 block"><PriceLine price={price} /></span>}
    </span>
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 transition-colors ${
      selected ? "border-navy bg-brand" : "border-navy bg-card"
    }`}>
      {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
    </span>
  </button>
);

/** A service to pick: a row on phones (illustration left, name and price
 *  right, so the whole list fits on one screen), a tile two or three across
 *  from small tablets up, like the Care at home cards. */
export const ServiceTile = ({
  label, art, price, onClick, selected = false,
}: { label: string; art: string; price: string; onClick: () => void; selected?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex items-center gap-3 border-2 border-navy bg-card p-1.5 text-left transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none sm:flex-col sm:items-stretch sm:gap-0 ${
      selected ? "bg-tint shadow-offset-blue" : "shadow-offset-sm hover:bg-tint/60"
    }`}
  >
    <span className="relative block h-[56px] w-[60px] shrink-0 bg-tint sm:h-[96px] sm:w-auto">
      <img src={art} alt="" className="absolute inset-x-0 bottom-0 mx-auto h-[52px] object-contain sm:h-[90px]" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2 sm:gap-1 sm:p-3 sm:pr-3">
      <b className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.02em] text-navy sm:text-[14.5px]">{label}</b>
      <span className="sm:mt-auto sm:pt-1"><PriceLine price={price} /></span>
    </span>
    <ArrowRight className="mr-1 h-4 w-4 shrink-0 text-brand sm:hidden" aria-hidden="true" />
  </button>
);

/** The site's buttons, square with a hard offset, for every request step. */
export const requestPrimary =
  "inline-flex min-h-12 items-center justify-center gap-2 border-2 border-navy bg-brand px-5 text-[15px] font-extrabold text-white shadow-offset-sm transition-all duration-150 hover:bg-navy active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45";
export const requestSecondary =
  "inline-flex min-h-12 items-center justify-center gap-2 border-2 border-navy bg-card px-5 text-[15px] font-extrabold text-navy shadow-offset-sm transition-all duration-150 hover:bg-tint active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
export const requestQuiet =
  "inline-flex min-h-11 items-center justify-center gap-2 px-3 text-[14.5px] font-bold text-body underline-offset-4 hover:text-navy hover:underline";

export const FieldLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="label-caps block text-[12px] text-label">
    {children}
  </label>
);

/** A phone field with its dialling code beside it. */
export const DialCodeField = ({
  id, dial, phone, onDial, onPhone, autoFocus,
}: {
  id: string; dial: string; phone: string;
  onDial: (v: string) => void; onPhone: (v: string) => void; autoFocus?: boolean;
}) => (
  <div className="flex gap-2">
    <Select value={dial} onValueChange={onDial}>
      <SelectTrigger className="h-12 w-[104px] shrink-0 rounded-none border-[1.5px] border-navy/40 bg-background px-3 text-[15px] font-medium">
        <SelectValue>{dial}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[260px]">
        {DIAL_CODES.map((c) => (
          <SelectItem key={`${c.code}-${c.label}`} value={c.code}>
            {c.code} &nbsp;{c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Input
      id={id}
      type="tel"
      value={phone}
      maxLength={20}
      autoFocus={autoFocus}
      className="h-12 flex-1 rounded-none border-[1.5px] border-navy/40 bg-background px-4 text-[16px] focus-visible:border-brand"
      placeholder="812 345 6789"
      onChange={(e) => onPhone(e.target.value)}
    />
  </div>
);

/** Join a dialling code and a local number into one readable number. */
export const joinPhone = (dial: string, phone: string) =>
  `${dial} ${phone.trim().replace(/^0+/, "")}`.trim();
