/**
 * Candidate-facing copy boundary for imported profile facts.
 *
 * Notes are an internal audit record and may contain parser, sweep, source or
 * workflow language. They are classified here, never rendered verbatim.
 */
export const candidateFieldExplanation = ({
  id,
  value,
  note,
}: {
  id: string;
  value: string | null;
  note: string | null;
}): string | null => {
  const internalNote = note?.trim() ?? "";

  // Gap copy is written by the portal itself, not imported from an audit row.
  if (id.startsWith("gap:")) return internalNote || null;

  if (/not confident|could not match|read this correctly/i.test(internalNote)) {
    return "We could not read this clearly from your records. Please choose or enter the correct answer below.";
  }

  if (/documents? say|profile says|more than one|but your profile/i.test(internalNote)) {
    return "We found more than one possible answer in your records. Please choose or enter the correct one below.";
  }

  if (/^from\s+/i.test(internalNote)) {
    return "We found this in one of your documents. Please confirm that it is correct or change it below.";
  }

  return value
    ? "We found this in your records. Please confirm that it is correct or change it below."
    : "Please choose or enter the correct answer below.";
};

const INTERNAL_VALUE = /\b(sweep\d*|auto[-_ ]?enrich(?:ment|ed)?|candidate_updated|candidate_stated|cv_parsed|admin_set|queried|settled|promoted)\b/i;

const INTERNAL_MESSAGE = /\b(sweep\d*|auto[-_ ]?enrich(?:ment|ed)?|candidate_updated|candidate_stated|cv_parsed|admin_set|queried|settled|promoted|parser|model|confidence|source[_ ]?(?:table|field)?|migration|rpc|database)\b/i;

/** Keep deliberate staff instructions, but never expose operational vocabulary. */
export const candidateOperationalNote = (
  note: string | null | undefined,
  fallback: string,
): string => {
  const text = note?.trim() ?? "";
  if (!text || INTERNAL_MESSAGE.test(text)) return fallback;
  return text;
};

/** Turn parser-shaped values into plain candidate answers without exposing codes. */
export const candidateFieldValue = (value: string): string => {
  if (!value) return "";
  let parsedValue: unknown = value.trim();

  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }
  }

  if (Array.isArray(parsedValue)) {
    parsedValue = parsedValue
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const readable = record.label ?? record.name ?? record.value ?? record.language;
          return typeof readable === "string" ? readable : "";
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  } else if (parsedValue && typeof parsedValue === "object") {
    const record = parsedValue as Record<string, unknown>;
    const readable = record.label ?? record.name ?? record.value ?? record.language;
    parsedValue = typeof readable === "string" ? readable : "";
  }

  const text = typeof parsedValue === "string" ? parsedValue : "";
  if (INTERNAL_VALUE.test(text)) return "";

  return text
    .split(",")
    .map((item) => item.trim().replace(/_/g, " ").replace(/\s+/g, " "))
    .filter(Boolean)
    .join(", ");
};