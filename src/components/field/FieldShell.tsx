// The frame every shared Care field sits in: a label that wraps safely, help
// that is allowed only when it changes the answer, and an error beneath the
// control that the control itself points at.
import { ReactNode, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldShellProps {
  label?: ReactNode;
  /** Reads to a screen reader when the visible label is not enough. */
  hideLabel?: boolean;
  help?: ReactNode;
  error?: string | null;
  /** Said out loud when the control is disabled, so the reason is never hidden. */
  disabledReason?: string;
  required?: boolean;
  className?: string;
  children: (ids: { controlId: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export const fieldControlClass = (invalid?: boolean, readOnly?: boolean) =>
  cn(
    "flex min-h-11 w-full min-w-0 items-center gap-2 border bg-background px-3 py-2 text-[15px] text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
    readOnly ? "border-dashed border-line-soft bg-muted/40" : "border-input",
    invalid && "border-destructive",
  );

export const FieldShell = ({
  label,
  hideLabel,
  help,
  error,
  disabledReason,
  required,
  className,
  children,
}: FieldShellProps) => {
  const base = useId();
  const controlId = `${base}-control`;
  const helpId = `${base}-help`;
  const errorId = `${base}-error`;
  const reasonId = `${base}-reason`;
  const describedBy = [help ? helpId : null, disabledReason ? reasonId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={controlId}
          className={cn(
            "break-words text-[13.5px] font-medium leading-snug text-muted-foreground",
            hideLabel && "sr-only",
          )}
        >
          {label}
          {required && <span aria-hidden className="ml-1 text-destructive">*</span>}
        </label>
      )}
      {help && (
        <p id={helpId} className="text-[13.5px] leading-relaxed text-muted-foreground">
          {help}
        </p>
      )}
      {children({ controlId, describedBy, invalid: !!error })}
      {disabledReason && (
        <p id={reasonId} className="text-[13px] leading-relaxed text-muted-foreground">
          {disabledReason}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[13.5px] font-medium leading-relaxed text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default FieldShell;
