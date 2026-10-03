// A phone number, entered the way people actually write it and handed on in
// E.164.
//
// The country sits beside the box rather than being guessed from the digits,
// and the component exposes both the normalised number and the country it was
// read in, so a later consumer can persist the country without this component
// changing. Nothing here writes to the database.
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PHONE_COUNTRY, PHONE_COUNTRIES, countryForE164, formatPhone, nationalPart, phoneCountry, toE164,
} from "@/lib/format";
import { FieldShell, fieldControlClass } from "./FieldShell";

export interface PhoneFieldProps {
  /** Whatever is held today: E.164, a local number, or empty. */
  value: string;
  /**
   * The normalised number, null while it is not yet a usable number, along
   * with the country it was read in and the raw typing.
   */
  onChange: (next: { e164: string | null; country: string; raw: string }) => void;
  /** ISO 3166-1 alpha-2. Derived from the value when not supplied. */
  country?: string;
  onCountryChange?: (country: string) => void;
  label?: string;
  hideLabel?: boolean;
  help?: string;
  error?: string | null;
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

export const PhoneField = ({
  value,
  onChange,
  country,
  onCountryChange,
  label,
  hideLabel,
  help,
  error,
  disabled,
  disabledReason,
  readOnly,
  required,
  placeholder = "812 698 8237",
  className,
  controlClassName,
  name,
}: PhoneFieldProps) => {
  const derived = useMemo(() => countryForE164(value)?.code ?? DEFAULT_PHONE_COUNTRY, [value]);
  const [ownCountry, setOwnCountry] = useState(country ?? derived);
  const selected = country ?? ownCountry;

  // Follow a value that arrives or changes from outside, but never fight the
  // person who has just chosen a country by hand.
  useEffect(() => {
    if (country) return;
    if (value && value.trim().startsWith("+")) setOwnCountry(derived);
  }, [country, derived, value]);

  const [typed, setTyped] = useState(() => (value?.trim().startsWith("+") ? nationalPart(value) : value ?? ""));
  useEffect(() => {
    const next = value?.trim().startsWith("+") ? nationalPart(value) : value ?? "";
    setTyped((current) => (toE164(current, selected) === toE164(next, selected) ? current : next));
    // The value is owned outside; follow it when it genuinely differs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (raw: string, countryCode: string) => {
    onChange({ e164: toE164(raw, countryCode), country: countryCode, raw });
  };

  const setCountry = (next: string) => {
    if (country) onCountryChange?.(next);
    else {
      setOwnCountry(next);
      onCountryChange?.(next);
    }
    emit(typed, next);
  };

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
          <p id={controlId} className={cn(cn(fieldControlClass(invalid, true), controlClassName))}>{formatPhone(value)}</p>
        ) : (
          <div className="flex w-full min-w-0 gap-2">
            <select
              aria-label="Country code"
              value={selected}
              disabled={disabled}
              onChange={(e) => setCountry(e.target.value)}
              className={cn(cn(fieldControlClass(invalid), controlClassName), "w-[7.5rem] shrink-0 appearance-none bg-background")}
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} +{c.dial}
                </option>
              ))}
            </select>
            <input
              id={controlId}
              name={name}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={placeholder}
              value={typed}
              disabled={disabled}
              required={required}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(e) => { setTyped(e.target.value); emit(e.target.value, selected); }}
              className={cn(cn(fieldControlClass(invalid), controlClassName), "min-w-0 flex-1")}
            />
          </div>
        )
      }
    </FieldShell>
  );
};

export const phoneCountryName = (code: string) => phoneCountry(code).name;

export default PhoneField;
