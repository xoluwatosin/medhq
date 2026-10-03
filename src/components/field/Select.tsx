// A single choice from a short list, in the same frame as every other field.
//
// A native select is used on purpose: it never overflows, it is keyboard and
// screen reader correct everywhere, and on a phone it opens the platform
// picker. Longer lists belong in SearchableSelect.
import { cn } from "@/lib/utils";
import { FieldShell, fieldControlClass } from "./FieldShell";

export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: FieldOption[];
  label?: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
}

export const SelectField = ({
  value,
  onChange,
  options,
  label,
  hideLabel,
  help,
  error,
  placeholder = "Choose one",
  disabled,
  disabledReason,
  readOnly,
  required,
  className,
  name,
}: SelectFieldProps) => (
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
        <p id={controlId} className={cn(fieldControlClass(invalid, true))}>
          {options.find((o) => o.value === value)?.label ?? "Not recorded"}
        </p>
      ) : (
        <select
          id={controlId}
          name={name}
          value={value}
          disabled={disabled}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldControlClass(invalid), "appearance-none bg-background")}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
  </FieldShell>
);

export default SelectField;
