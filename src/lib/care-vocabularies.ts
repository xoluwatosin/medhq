// Controlled Care vocabularies: one shared source of stable codes and labels.
//
// The database stores the code. Screens render the label from here. Nothing
// depends on the wording of a label, and a label can be reworded without
// touching a single stored value.
import { ALL_LANGUAGES } from "@/lib/languages";
import { NIGERIA_STATES, getLGAsForState } from "@/lib/nigeria-locations";
import { RELATIONSHIPS } from "@/lib/care";

export interface Term {
  code: string;
  label: string;
  /** Retired terms stay readable on old records but cannot be chosen again. */
  active?: boolean;
}

/** The one way a human value becomes a stable code. Mirrored in SQL backfills. */
export const toCode = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const SEX_TERMS: Term[] = [
  { code: "female", label: "Female" },
  { code: "male", label: "Male" },
  { code: "intersex", label: "Intersex" },
  { code: "not_stated", label: "Not stated" },
];

export const RELATIONSHIP_TERMS: Term[] = [
  ...RELATIONSHIPS.map((r) => ({ code: toCode(r), label: r })),
  { code: "other", label: "Other" },
];

export const LANGUAGE_TERMS: Term[] = ALL_LANGUAGES.map((l) => ({ code: toCode(l), label: l }));

export const STATE_TERMS: Term[] = [...NIGERIA_STATES]
  .sort((a, b) => a.localeCompare(b))
  .map((s) => ({ code: toCode(s), label: s }));

/** LGA codes are state-scoped, so two states may hold the same LGA name. */
export const lgaTerms = (stateCode: string | null | undefined): Term[] => {
  if (!stateCode) return [];
  const state = STATE_TERMS.find((s) => s.code === stateCode);
  if (!state) return [];
  return [...getLGAsForState(state.label)]
    .sort((a, b) => a.localeCompare(b))
    .map((l) => ({ code: `${stateCode}__${toCode(l)}`, label: l }));
};

const labelFrom = (terms: Term[], code: string | null | undefined, fallback = "Not recorded") =>
  (code && terms.find((t) => t.code === code)?.label) || (code ? `Not on the list (${code})` : fallback);

export const sexLabel = (code?: string | null) => labelFrom(SEX_TERMS, code);
export const relationshipLabel = (code?: string | null, other?: string | null) =>
  code === "other" ? (other?.trim() || "Other")
    : code === "self" ? "Self"
    : labelFrom(RELATIONSHIP_TERMS, code, "Relationship not recorded");
export const languageLabel = (code?: string | null) => labelFrom(LANGUAGE_TERMS, code);
export const stateLabel = (code?: string | null) => labelFrom(STATE_TERMS, code);
export const lgaLabel = (stateCode?: string | null, code?: string | null) =>
  labelFrom(lgaTerms(stateCode ?? null), code);

export const languageLabels = (codes?: string[] | null) =>
  (codes ?? []).map((c) => languageLabel(c));

/** Age is derived from date of birth at the moment it is read. Never stored. */
export const ageFromDob = (dob?: string | null): number | null => {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

/** How an age reads on a record, including when the date of birth is a guess. */
export const ageText = (dob?: string | null, estimated?: boolean | null): string => {
  const age = ageFromDob(dob);
  if (age === null) return "Age not recorded";
  return estimated ? `About ${age}` : `${age}`;
};
