// A date and a time together, kept as two controls because a single native
// datetime input behaves differently on every platform.
//
// The value in and out is an ISO string the database can hold. The date half
// reuses DateField, so calendar behaviour is never solved twice.
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { fromISODate, toISODate } from "@/lib/format";
import DateField from "./DateField";
import TimeField from "./TimeField";

export interface DateTimeFieldProps {
  /** ISO 8601, or empty. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  help?: string;
  error?: string | null;
  /** YYYY-MM-DD bounds for the date half. */
  min?: string;
  max?: string;
  disabled?: boolean;
  disabledReason?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
}

const split = (value: string) => {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const hours = `${parsed.getHours()}`.padStart(2, "0");
  const minutes = `${parsed.getMinutes()}`.padStart(2, "0");
  return { date: toISODate(parsed), time: `${hours}:${minutes}` };
};

const join = (date: string, time: string): string => {
  if (!date) return "";
  const day = fromISODate(date);
  if (!day) return "";
  const [hours, minutes] = (time || "00:00").split(":");
  day.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return day.toISOString();
};

export const DateTimeField = ({
  value,
  onChange,
  label,
  help,
  error,
  min,
  max,
  disabled,
  disabledReason,
  readOnly,
  required,
  className,
}: DateTimeFieldProps) => {
  const parts = useMemo(() => split(value), [value]);

  return (
    <fieldset className={cn("flex w-full min-w-0 flex-col gap-1.5 border-0 p-0", className)}>
      {label && (
        <legend className="mb-1 break-words p-0 text-[13.5px] font-medium leading-snug text-muted-foreground">
          {label}
          {required && <span aria-hidden className="ml-1 text-destructive">*</span>}
        </legend>
      )}
      <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2">
        <DateField
          label="Date"
          value={parts.date}
          min={min}
          max={max}
          disabled={disabled}
          disabledReason={disabledReason}
          readOnly={readOnly}
          error={null}
          onChange={(date) => onChange(join(date, parts.time))}
        />
        <TimeField
          label="Time"
          value={parts.time}
          disabled={disabled || !parts.date}
          disabledReason={!parts.date ? "Choose a date first." : disabledReason}
          readOnly={readOnly}
          onChange={(time) => onChange(join(parts.date, time))}
        />
      </div>
      {help && <p className="text-[13.5px] leading-relaxed text-muted-foreground">{help}</p>}
      {error && (
        <p role="alert" className="text-[13.5px] font-medium leading-relaxed text-destructive">{error}</p>
      )}
    </fieldset>
  );
};

export default DateTimeField;
