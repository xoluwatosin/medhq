// The shared skin for every short form on the site: the navy cap, the
// segmented progress, one question at a time, and a quiet footer.

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
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
}

export const RequestShell = ({
  open, onOpenChange, eyebrow, title, step = null, total = 0, chip, children, footer, scrollRef,
}: ShellProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent scrollBehavior="shell" className="flex max-h-[calc(100dvh-max(32px,env(safe-area-inset-top)+env(safe-area-inset-bottom)+16px))] w-[calc(100%-24px)] max-w-[540px] flex-col gap-0 overflow-hidden rounded-[24px] border-0 bg-card p-0 shadow-[var(--shadow-dialog)] sm:max-h-[92dvh] [&>button]:right-4 [&>button]:top-3.5 [&>button]:z-10 [&>button]:bg-primary-foreground/10 [&>button]:text-primary-foreground [&>button]:opacity-100 [&>button]:ring-offset-navy hover:[&>button]:bg-primary-foreground/20">
      <DialogTitle className="sr-only">{title}</DialogTitle>

      <div className="relative flex h-[54px] shrink-0 items-center bg-navy px-4 pr-14 sm:h-[58px] sm:px-6 sm:pr-16">
        <div className="absolute right-5 top-[-42px] h-28 w-28 rounded-full border-[18px] border-primary-foreground/10" aria-hidden="true" />
        <span className="label-caps text-[9px] text-muted-navy">{eyebrow}</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-5">
        {step !== null && total > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-brand" : "bg-muted"}`} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              {chip ? <span className="truncate text-[11px] font-medium text-brand">{chip}</span> : <span />}
              <span className="label-caps shrink-0 text-[9px] text-label">Step {step + 1} of {total}</span>
            </div>
          </div>
        )}

        {children}

        {footer && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline-warm pt-3.5">
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
    <h2 className="mb-1 text-[18px] font-bold leading-[1.25] text-navy sm:text-[20px]">{heading}</h2>
    {help && <p className="mb-3 text-[14px] leading-relaxed text-body">{help}</p>}
    {children}
  </div>
);

export const Choice = ({
  label, blurb, selected, onClick,
}: { label: string; blurb?: string; selected: boolean; onClick: () => void }) => (
  <Button
    type="button"
    variant="outline"
    onClick={onClick}
    className={`group h-auto min-h-0 w-full justify-start gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 active:scale-[0.99] ${
      selected
        ? "border-brand bg-tint shadow-[0_0_0_1px_hsl(var(--brand))] hover:bg-tint"
        : "border-hairline-warm bg-card hover:border-brand/60 hover:bg-tint/50"
    }`}
  >
    <span className="min-w-0 flex-1 whitespace-normal">
      <span className="block text-[14px] font-semibold leading-[1.3] text-ink">{label}</span>
      {blurb && <span className="mt-0.5 block text-[13px] font-normal leading-[1.4] text-muted-foreground">{blurb}</span>}
    </span>
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
      selected ? "border-brand bg-brand" : "border-hairline group-hover:border-brand/50"
    }`}>
      {selected && <Check className="h-3 w-3 text-primary-foreground" />}
    </span>
  </Button>
);

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
      <SelectTrigger className="h-12 w-[104px] shrink-0 rounded-xl border-hairline-warm bg-background px-3 text-[15px] font-medium">
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
      className="h-12 flex-1 rounded-xl border-hairline-warm bg-background px-4 text-[16px]"
      placeholder="812 345 6789"
      onChange={(e) => onPhone(e.target.value)}
    />
  </div>
);

/** Join a dialling code and a local number into one readable number. */
export const joinPhone = (dial: string, phone: string) =>
  `${dial} ${phone.trim().replace(/^0+/, "")}`.trim();
