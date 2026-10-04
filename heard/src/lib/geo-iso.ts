// ISO 3166-1 countries and ISO 3166-2 subdivisions, with dial codes and time
// zones. Loaded lazily so the dataset only ships with the volunteer portal.
import { getLGAsForState } from "@/lib/nigeria-locations";

export interface IsoCountry { code: string; name: string; dial: string; timezones: string[] }
export interface IsoSubdivision { code: string; name: string }

const PINNED = ["NG", "GB", "US", "CA", "GH", "KE", "ZA", "IE"];

let cache: typeof import("country-state-city") | null = null;
export const loadGeo = async () => (cache ??= await import("country-state-city"));

export const countriesSorted = (geo: typeof import("country-state-city")): IsoCountry[] => {
  const all = geo.Country.getAllCountries().map((c) => ({
    code: c.isoCode,
    name: c.name,
    dial: c.phonecode.replace(/^\+/, "").split(/[^0-9]/)[0],
    timezones: (c.timezones ?? []).map((t) => t.zoneName),
  }));
  const pinned = PINNED.map((code) => all.find((c) => c.code === code)).filter(Boolean) as IsoCountry[];
  return [...pinned, ...all.filter((c) => !PINNED.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name))];
};

export const subdivisionsOf = (geo: typeof import("country-state-city"), country: string): IsoSubdivision[] =>
  geo.State.getStatesOfCountry(country)
    .filter((s) => /^[A-Z0-9]{1,3}$/.test(s.isoCode))
    .map((s) => ({ code: `${country}-${s.isoCode}`, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

/** Nigerian LGAs for an ISO subdivision code (NG-FC → FCT list). */
export const nigerianLgas = (subdivisionName: string, code: string): string[] =>
  code === "NG-FC" ? getLGAsForState("FCT") : getLGAsForState(subdivisionName);

/** Prefer the device zone when it belongs to the country; otherwise the country's first zone. */
export const suggestTimezone = (country: IsoCountry | undefined): string => {
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!country || !country.timezones.length) return device;
  return country.timezones.includes(device) ? device : country.timezones[0];
};

export const timezoneLabel = (zone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${zone.replace(/_/g, " ")} (${off.replace("GMT", "UTC") || "UTC"})`;
  } catch {
    return zone;
  }
};

const NATIONAL_LENGTH: Record<string, [number, number]> = { NG: [10, 10], GB: [10, 10], US: [10, 10], CA: [10, 10], GH: [9, 9], KE: [9, 9], ZA: [9, 9], IE: [7, 9] };

/** National digits → E.164, or null if invalid. Strips spaces, a leading 0 and a pasted dial code. */
export const toE164 = (dial: string, national: string, country: string): string | null => {
  let digits = national.replace(/\D/g, "");
  if (digits.startsWith("00" + dial)) digits = digits.slice(2 + dial.length);
  else if (digits.startsWith(dial) && digits.length > (NATIONAL_LENGTH[country]?.[1] ?? 12)) digits = digits.slice(dial.length);
  digits = digits.replace(/^0+/, "");
  const [min, max] = NATIONAL_LENGTH[country] ?? [4, 14 - dial.length + 1];
  if (digits.length < min || digits.length > max || dial.length + digits.length > 15) return null;
  return `+${dial}${digits}`;
};

export const nationalFromE164 = (e164: string | null | undefined, dial: string): string =>
  e164 && e164.startsWith(`+${dial}`) ? e164.slice(dial.length + 1) : "";
