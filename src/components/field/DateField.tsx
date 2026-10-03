// One date control for the whole Care path.
//
// Calendar overflow is solved here and nowhere else: on a device without a
// real pointer we hand over to the native date picker, which is both easier on
// a phone and incapable of overflowing the page. On a pointer device the
// calendar opens in a popover that is kept inside the viewport.
import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDate, fromISODate, toISODate } from "@/lib/format";
import { FieldShell, fieldControlClass } from "./FieldShell";

/** True where the device has a real pointer, so a calendar popover makes sense. */
export const usePointerDevice = () => {
  const [pointer, setPointer] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
      : true,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const listen = () => setPointer(query.matches);
    query.addEventListener("change", listen);
    return () => query.removeEventListener("change", listen);
  }, []);
  return pointer;
};

export interface DateFieldProps {
  /** YYYY-MM-DD, or empty. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
  /** YYYY-MM-DD. */
  min?: string;
  max?: string;
  disabled?: boolean;
  disabledReason?: string;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Overrides the control skin, for surfaces with their own field styling. */
  controlClassName?: string;
  name?: string;
}

export const DateField = ({
  value,
  onChange,
  label,
  hideLabel,
  help,
  error,
  min,
  max,
  disabled,
  disabledReason,
  readOnly,
  required,
  placeholder = "Choose a date",
  className,
  controlClassName,
  name,
}: DateFieldProps) => {
  const pointer = usePointerDevice();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => fromISODate(value) ?? undefined, [value]);
  const minDate = useMemo(() => fromISODate(min) ?? undefined, [min]);
  const maxDate = useMemo(() => fromISODate(max) ?? undefined, [max]);

  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      help={help}
      error={error}
      disabledReason={disabled ? disabledReason : undefined}
      required={required}
      className={className}
    >
      {({ controlId, describedBy, invalid }) =>
        readOnly ? (
          <p id={controlId} className={cn(cn(fieldControlClass(invalid, true), controlClassName))}>
            {formatDate(fromISODate(value))}
          </p>
        ) : !pointer ? (
          <input
            id={controlId}
            name={name}
            type="date"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(e) => onChange(e.target.value)}
            className={cn(cn(fieldControlClass(invalid), controlClassName), "appearance-none")}
          />
        ) : (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                id={controlId}
                name={name}
                type="button"
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className={cn(cn(fieldControlClass(invalid), controlClassName), "justify-between text-left")}
              >
                <span className={cn("truncate", !value && "text-muted-foreground")}>
                  {value ? formatDate(fromISODate(value)) : placeholder}
                </span>
                <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              collisionPadding={12}
              avoidCollisions
              className="z-50 w-auto max-w-[min(20rem,calc(100vw-1.5rem))] overflow-auto p-0"
            >
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected}
                fromDate={minDate}
                toDate={maxDate}
                onSelect={(date) => {
                  onChange(date ? toISODate(date) : "");
                  setOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )
      }
    </FieldShell>
  );
};

export default DateField;
