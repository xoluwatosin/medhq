// Turning stored values into English a person can read.
//
// Parsed CV values arrive in whatever shape the document used: snake_case codes,
// SHOUTED headings, lowercase fragments, and long comma runs with no "and".
// Nothing here changes stored data, it only tidies how a value is written out.

/** Acronyms and short forms that must keep their exact casing. */
const KEEP_AS_IS = new Set([
  "RN", "RM", "RPHN", "RNM", "BLS", "ACLS", "PALS", "CPR", "ICU", "NICU", "PICU",
  "A&E", "OPD", "IPD", "IV", "IM", "GP", "HSE", "NMCN", "MDCN", "PCN", "MLSCN",
  "RRBN", "NYSC", "LGA", "FCT", "WHO", "HIV", "TB", "PHC", "CHEW", "JCHEW",
  "BNSc", "BSc", "MSc", "MBBS", "PhD", "HND", "OND", "NCE", "ECG", "ECHO",
  "COVID-19", "PPE", "IPC", "IT", "UK", "US",
]);

const UPPER_LOOKUP = new Map([...KEEP_AS_IS].map((a) => [a.toUpperCase(), a]));

/** Small words that stay lowercase inside a phrase. */
const MINOR = new Set(["and", "of", "in", "for", "the", "a", "an", "to", "with", "on", "at", "or"]);

const capitalise = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Tidy a single word, preserving known acronyms and anything already mixed case. */
function tidyWord(word: string, first: boolean): string {
  if (!word) return word;
  const bare = word.replace(/[^A-Za-z0-9&.-]/g, "");
  const known = UPPER_LOOKUP.get(bare.toUpperCase());
  if (known) return word.replace(bare, known);
  // Already deliberately mixed case (e.g. "iPhone", "B.Nsc") — leave it alone.
  if (/[a-z]/.test(word) && /[A-Z]/.test(word)) return word;
  const lower = word.toLowerCase();
  if (!first) return lower;
  if (MINOR.has(lower)) return capitalise(lower);
  return capitalise(lower);
}

/**
 * Turn one stored term into readable sentence case:
 * `maternity_obstetrics` -> `Maternity obstetrics`, `REGISTERED NURSE (RN)` -> `Registered nurse (RN)`.
 * Anything a human clearly typed in mixed case is left as they wrote it.
 */
export function humaniseTerm(raw: string): string {
  const trimmed = raw.trim();
  // Underscores are always code separators; a hyphen only is when the term has
  // no spaces at all (e.g. "medical-surgical"), otherwise it is real punctuation
  // such as "Lead Nurse - Labour Ward".
  const value = (/\s/.test(trimmed) ? trimmed.replace(/_+/g, " ") : trimmed.replace(/[_-]+/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return "";
  const allCaps = value === value.toUpperCase() && /[A-Z]{2,}/.test(value);
  const allLower = value === value.toLowerCase();
  if (!allCaps && !allLower) return value;
  return value
    .split(" ")
    .map((w, i) => tidyWord(w, i === 0))
    .join(" ");
}

/** The same term written to sit mid-sentence: lowercase apart from acronyms. */
export function lowerTerm(raw: string): string {
  return humaniseTerm(raw)
    .split(" ")
    .map((w) => {
      const bare = w.replace(/[^A-Za-z0-9&.-]/g, "");
      if (UPPER_LOOKUP.has(bare.toUpperCase())) return w;
      // Proper nouns inside a phrase keep their capital (e.g. "Lagos", "Nigeria").
      if (/[A-Z]/.test(w.slice(1))) return w;
      return w.charAt(0).toLowerCase() + w.slice(1);
    })
    .join(" ");
}

/** Split a stored multi-value string into distinct, readable items. */
export function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[;,\n•|]+/)) {
    const item = humaniseTerm(part);
    if (!item) continue;
    const key = item.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Join items the way a person writes a list: "a, b and c", or "a, b, c and 4 more". */
export function joinList(items: string[], max = 6): string {
  if (items.length === 0) return "";
  if (items.length <= max) {
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }
  const shown = items.slice(0, max);
  return `${shown.join(", ")} and ${items.length - max} more`;
}

/** A list written to sit mid-sentence. */
export function lowerList(items: string[], max = 6): string {
  return joinList(items.map(lowerTerm), max);
}

/** Readable version of a stored list value, e.g. for a table cell. */
export function readableList(raw: string | null | undefined, max = 99): string {
  return joinList(splitList(raw), max);
}

/** Lowercase the opening word of a phrase when it sits mid-sentence. */
export function lowerFirst(text: string): string {
  return lowerTerm(text);
}


/** "1 year" vs "6 years", from whatever the CV said. */
export function readableYears(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return humaniseTerm(raw);
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const plus = /\+/.test(raw) ? " or more" : "";
  return `${n} ${n === 1 ? "year" : "years"}${plus}`;
}

/** One clean sentence: trimmed, capitalised, ending in a single full stop. */
export function sentence(text: string): string {
  const body = text.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (!body) return "";
  return `${capitalise(body.charAt(0)) + body.slice(1)}.`;
}
