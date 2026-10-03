// One way to write a date, a phone number and an amount, used everywhere in
// the Care path. A value we do not hold reads "Not recorded" rather than an
// unexplained blank.

export const NOT_RECORDED = "Not recorded";

const asDate = (value: Date | string | number | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 3 Sep 2026. Pass `withYear: false` for dates inside the current year. */
export const formatDate = (
  value: Date | string | number | null | undefined,
  options?: { fallback?: string; withYear?: boolean },
): string => {
  const date = asDate(value);
  if (!date) return options?.fallback ?? NOT_RECORDED;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(options?.withYear === false ? {} : { year: "numeric" }),
  });
};

/** 14:30 */
export const formatTime = (
  value: Date | string | number | null | undefined,
  options?: { fallback?: string },
): string => {
  const date = asDate(value);
  if (!date) return options?.fallback ?? NOT_RECORDED;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

/** 3 Sep 2026, 14:30 */
export const formatDateTime = (
  value: Date | string | number | null | undefined,
  options?: { fallback?: string },
): string => {
  const date = asDate(value);
  if (!date) return options?.fallback ?? NOT_RECORDED;
  return `${formatDate(date)}, ${formatTime(date)}`;
};

/* ---------- dates as plain calendar strings ---------- */

/** A Date to the YYYY-MM-DD a date input and the database both understand. */
export const toISODate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/** YYYY-MM-DD read as a local calendar day, never shifted by a timezone. */
export const fromISODate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return asDate(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

/* ---------- phone ---------- */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** Dial code without the plus. */
  dial: string;
  /** Digits after the dial code, longest first where a country varies. */
  nationalLengths: number[];
  /** The zero a national format carries and E.164 does not. */
  trunkPrefix?: string;
}

// Nigeria first because that is nearly every number we hold. The rest are the
// countries families and staff actually call us from.
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "NG", name: "Nigeria", dial: "234", nationalLengths: [10], trunkPrefix: "0" },
  { code: "GB", name: "United Kingdom", dial: "44", nationalLengths: [10], trunkPrefix: "0" },
  { code: "US", name: "United States", dial: "1", nationalLengths: [10] },
  { code: "CA", name: "Canada", dial: "1", nationalLengths: [10] },
  { code: "GH", name: "Ghana", dial: "233", nationalLengths: [9], trunkPrefix: "0" },
  { code: "KE", name: "Kenya", dial: "254", nationalLengths: [9], trunkPrefix: "0" },
  { code: "ZA", name: "South Africa", dial: "27", nationalLengths: [9], trunkPrefix: "0" },
  { code: "AE", name: "United Arab Emirates", dial: "971", nationalLengths: [9], trunkPrefix: "0" },
  { code: "IE", name: "Ireland", dial: "353", nationalLengths: [9], trunkPrefix: "0" },
  { code: "DE", name: "Germany", dial: "49", nationalLengths: [11, 10], trunkPrefix: "0" },
  { code: "FR", name: "France", dial: "33", nationalLengths: [9], trunkPrefix: "0" },
  { code: "IT", name: "Italy", dial: "39", nationalLengths: [10, 9] },
  { code: "ES", name: "Spain", dial: "34", nationalLengths: [9] },
  { code: "NL", name: "Netherlands", dial: "31", nationalLengths: [9], trunkPrefix: "0" },
  { code: "AU", name: "Australia", dial: "61", nationalLengths: [9], trunkPrefix: "0" },
];

export const DEFAULT_PHONE_COUNTRY = "NG";

export const phoneCountry = (code: string | null | undefined): PhoneCountry =>
  PHONE_COUNTRIES.find((c) => c.code === code) ??
  (PHONE_COUNTRIES.find((c) => c.code === DEFAULT_PHONE_COUNTRY) as PhoneCountry);

const digitsOf = (value: string) => value.replace(/\D/g, "");

/** The country a stored number belongs to, longest dial code first. */
export const countryForE164 = (value: string | null | undefined): PhoneCountry | null => {
  if (!value) return null;
  const digits = digitsOf(value);
  if (!digits) return null;
  const candidates = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const hit = candidates.find((c) => digits.startsWith(c.dial));
  return hit ?? null;
};

/**
 * What the person typed, in the country they are in, turned into E.164.
 * Returns null while the number is too short to be a real one, so a consumer
 * can tell "not finished" from "finished and wrong".
 */
export const toE164 = (input: string, countryCode: string = DEFAULT_PHONE_COUNTRY): string | null => {
  const country = phoneCountry(countryCode);
  const typed = input.trim();
  if (!typed) return null;

  // Typed in full international form: trust the number, not the picker.
  if (typed.startsWith("+") || typed.startsWith("00")) {
    const digits = digitsOf(typed.startsWith("00") ? typed.slice(2) : typed);
    return digits.length >= 8 ? `+${digits}` : null;
  }

  let digits = digitsOf(typed);
  if (country.trunkPrefix && digits.startsWith(country.trunkPrefix)) {
    digits = digits.slice(country.trunkPrefix.length);
  }
  if (digits.startsWith(country.dial) && digits.length > Math.max(...country.nationalLengths)) {
    digits = digits.slice(country.dial.length);
  }
  if (!digits) return null;
  const longest = Math.max(...country.nationalLengths);
  const shortest = Math.min(...country.nationalLengths);
  if (digits.length < shortest || digits.length > longest) return null;
  return `+${country.dial}${digits}`;
};

/** The national part of a stored number, for showing in the input box. */
export const nationalPart = (value: string | null | undefined): string => {
  if (!value) return "";
  const country = countryForE164(value);
  const digits = digitsOf(value);
  if (!country) return value.trim();
  return digits.slice(country.dial.length);
};

/** +234 812 698 8237 */
export const formatPhone = (
  value: string | null | undefined,
  options?: { fallback?: string },
): string => {
  if (!value || !value.trim()) return options?.fallback ?? NOT_RECORDED;
  const country = countryForE164(value);
  const digits = digitsOf(value);
  if (!country) return value.trim();
  const rest = digits.slice(country.dial.length);
  const groups = rest.length > 6
    ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6)]
    : [rest.slice(0, 3), rest.slice(3)];
  return `+${country.dial} ${groups.filter(Boolean).join(" ")}`.trim();
};

/* ---------- money ---------- */

/** Naira by default, whole units, never a bare number. */
export const formatMoney = (
  value: number | string | null | undefined,
  options?: { currency?: string; fallback?: string; decimals?: boolean },
): string => {
  const amount = typeof value === "string" ? Number(value) : value;
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return options?.fallback ?? NOT_RECORDED;
  }
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: options?.currency ?? "NGN",
    minimumFractionDigits: options?.decimals ? 2 : 0,
    maximumFractionDigits: options?.decimals ? 2 : 0,
  }).format(amount);
};
