// The right hand working panel.
//
// A ledger row says what a thing is. This panel is where the thing is read in
// full and decided on: the whole record above, one decision bar below, always
// in the same place so the hand learns it.
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MuEyebrow } from "@/components/admin/mu/MuShell";

export const MuDetailSheet = ({
  open,
  onOpenChange,
  eyebrow,
  title,
  subtitle,
  status,
  children,
  decisions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  decisions?: ReactNode;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 border-l border-line p-0 sm:max-w-[34rem]"
    >
      <header className="bg-navy px-5 py-6 pr-12">
        {eyebrow && (
          <MuEyebrow className="text-muted-navy">{eyebrow}</MuEyebrow>
        )}
        <h2 className="mt-2 text-[21px] font-bold leading-tight tracking-[-0.02em] text-white">{title}</h2>
        {subtitle && <p className="mt-1.5 text-[14px] leading-snug text-body-navy">{subtitle}</p>}
        {status && <div className="mt-3 flex flex-wrap items-center gap-2">{status}</div>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

      {decisions && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card px-5 py-4">
          {decisions}
        </footer>
      )}
    </SheetContent>
  </Sheet>
);

/** A quiet key and value pair inside the panel. */
export const MuDetailFacts = ({
  rows,
  className,
}: {
  rows: { label: string; value: ReactNode }[];
  className?: string;
}) => (
  <dl className={cn("divide-y divide-line-soft", className)}>
    {rows.map((r) => (
      <div key={r.label} className="flex gap-4 px-5 py-3">
        <dt className="w-[9.5rem] shrink-0 text-[13px] font-medium text-muted-foreground">{r.label}</dt>
        <dd className="min-w-0 flex-1 break-words text-[14px] leading-relaxed">{r.value ?? "Not recorded"}</dd>
      </div>
    ))}
  </dl>
);

export default MuDetailSheet;
