// How a care request from the website reads on the enquiry desk.
import { DIAL_CODES, kindByLine } from "@/components/request/care-kinds";

/**
 * A care request read as a sentence, not as the fields it was stored in.
 * Older requests stored "For me", and a blank when the question was skipped
 * because the service was chosen on its own page.
 */
export const careRequestRows = (answers: Record<string, unknown>, lineName: (key: string | null) => string) => {
  const text = (key: string) => (typeof answers[key] === "string" ? String(answers[key]).trim() : "");
  const forWhom = text("for_whom");
  const who = text("who_needs_care");
  const self = /^for (me|themselves)$/i.test(forWhom);
  const rows: { label: string; value: string }[] = [];
  rows.push({
    label: "Who the care is for",
    value: self
      ? `The person enquiring${who ? ` (${who.replace(/^themselves, /i, "")})` : ""}`
      : forWhom
        ? `Someone else${who ? `: ${who.charAt(0).toLowerCase()}${who.slice(1)}` : ""}`
        : "Not asked",
  });
  if (text("kind_of_care")) rows.push({ label: "Care asked for", value: text("kind_of_care") });
  if (text("how_soon")) rows.push({ label: "How soon", value: text("how_soon") });
  const page = text("confirmed_from_page");
  rows.push({
    label: "How they chose it",
    value: page
      ? page.endsWith("(changed)")
        ? `Started on the ${page.replace(/ \((confirmed|changed)\)$/, "").toLowerCase()} page, then chose something else`
        : `Chose ${page.replace(/ \((confirmed|changed)\)$/, "").toLowerCase()} from its own page`
      : "Chose from the list of care",
  });
  const earlier = Array.isArray(answers.prior_interests) ? (answers.prior_interests as unknown[]).map(String) : [];
  if (earlier.length > 0) {
    rows.push({ label: "Also looked at", value: earlier.map((l) => kindByLine(l)?.label ?? lineName(l)).join(", ") });
  }
  return rows;
};

export const isCareRequest = (answers: Record<string, unknown>) => "kind_of_care" in answers || "for_whom" in answers;

/** The country a phone number dials from, for a family calling from abroad. */
export const phoneCountry = (phone: string | null) => {
  const digits = (phone ?? "").replace(/\s/g, "");
  const match = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find((d) => digits.startsWith(d.code));
  return match?.label ?? null;
};
