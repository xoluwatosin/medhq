// A time of day, held as HH:mm on a 24 hour clock.
import { cn } from "@/lib/utils";
import { FieldShell, fieldControlClass } from "./FieldShell";

export interface TimeFieldProps {
  /** HH:mm, or empty. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  disabledReason?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
}

export const TimeField = ({
  value,
  onChange,
  label,
  hideLabel,
  help,
  error,
  min,
  max,
  step = 300,
  disabled,
  disabledReason,
  readOnly,
  required,
  className,
  name,
}: TimeFieldProps) => (
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
        <p id={controlId} className={cn(fieldControlClass(invalid, true))}>{value || "Not recorded"}</p>
      ) : (
        <input
          id={controlId}
          name={name}
          type="time"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldControlClass(invalid), "appearance-none")}
        />
      )
    }
  </FieldShell>
);

export default TimeField;
