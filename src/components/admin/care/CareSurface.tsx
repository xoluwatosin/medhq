// The Care editing surfaces.
//
// Care follows the admin kit: square shapes, soft lines, card surfaces,
// restrained navy, comfortable control heights. A larger edit opens
// a sheet at the side of the desk and fills the screen on a phone. A small
// decision opens a short confirmation. Nothing in Care uses the older generic
// admin dialog grammar.
import { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const headingClass = "text-[17px] font-extrabold tracking-[-0.02em] text-navy";
const subClass = "mt-1 text-[13.5px] leading-relaxed text-body";

export const careButton =
  "cx-control inline-flex min-h-11 items-center justify-center gap-2 px-4 text-[14.5px] font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none";
export const carePrimary = `${careButton} bg-navy text-white hover:bg-navy/90`;
export const careGhost = `${careButton} border border-line bg-white text-ink hover:bg-desk/60`;

/** A quiet action beside a group of facts. One per block, never per row. */
export const CareEditButton = ({
  label = "Edit",
  onClick,
  disabled,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button type="button" onClick={onClick} disabled={disabled} className={cn(careGhost, "min-h-9 px-3 text-[13.5px]")}>
    {label}
  </button>
);

/**
 * A larger edit. Right hand side on a desk, the whole screen on a phone, with
 * the save and cancel always reachable at the foot.
 */
export const CareSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saveLabel = "Save changes",
  saving,
  saveDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 border-line bg-card p-0 sm:max-w-[520px]"
    >
      <header className="border-b border-line-soft px-5 py-4 sm:px-6">
        <h2 className={headingClass}>{title}</h2>
        {description && <p className={subClass}>{description}</p>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5">{children}</div>
      </div>

      {onSave && (
        <footer className="flex flex-col-reverse gap-2 border-t border-line-soft bg-card px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" className={careGhost} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={carePrimary} onClick={onSave} disabled={saving || saveDisabled}>
            {saving ? "Saving" : saveLabel}
          </button>
        </footer>
      )}
    </SheetContent>
  </Sheet>
);

/** A short decision: cancel a visit, withdraw a link, revoke access. */
export const CareConfirm = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  keepLabel = "Keep it",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  keepLabel?: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md gap-0 border-line bg-card p-0">
      <div className="px-5 py-5">
        <h2 className={headingClass}>{title}</h2>
        {description && <p className={subClass}>{description}</p>}
        {children && <div className="mt-4 flex flex-col gap-3">{children}</div>}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line-soft px-5 py-4 sm:flex-row sm:justify-end">
        <button type="button" className={careGhost} onClick={() => onOpenChange(false)}>
          {keepLabel}
        </button>
        <button type="button" className={carePrimary} onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

/** One labelled control inside a Care sheet. */
export const CareField = ({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[13px] font-bold text-ink2">{label}</span>
    {children}
    {help && <span className="text-[12.5px] text-body">{help}</span>}
  </div>
);
