// How a question is worded, decided once.
//
// The same question is asked of a person answering for themselves and of a
// relative answering for someone else. Rather than holding two strings and
// letting them drift apart, the definition writes one string with tokens in it
// and this file resolves them. A definition never contains "they" or "she"
// where the subject has not been established.
import type { CareResponses } from "@/lib/care";

export interface CopyVoice {
  /** The person answering is the person receiving care. */
  self: boolean;
  /** What to call the person receiving care, when it is not the respondent. */
  recipient: string;
  /** The respondent is the child's parent or guardian. */
  parent: boolean;
}

/**
 * Tokens a definition may use. Anything else is left alone, so an unresolved
 * token is visible in review rather than silently swallowed.
 */
const TOKENS = [
  "subject", "Subject", "possessive", "Possessive",
  "do", "Do", "are", "Are", "have", "Have", "is", "Is", "was", "Was",
  "them", "their", "child", "Child",
] as const;

const nameFrom = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts = [o.first, o.preferred].filter((v) => typeof v === "string" && v.trim());
    if (parts.length) return String(parts[parts.length - 1]).trim();
  }
  return "";
};

/** The voice a set of answers is written in. */
export const voiceFor = (
  responses: CareResponses,
  fallbackName?: string | null,
): CopyVoice => {
  const self = String(responses.who_for ?? "") === "myself";
  const preferred = nameFrom(responses.recipient_preferred_name);
  const first = nameFrom(responses.recipient_first_name);
  const recipient = preferred || first || nameFrom(fallbackName) || "the person receiving care";
  return {
    self,
    recipient,
    parent: String(responses.is_parent_guardian ?? "") === "yes",
  };
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const possessiveOf = (name: string) =>
  name === "the person receiving care" ? "the care recipient's" : `${name}'s`;

const valueFor = (token: string, voice: CopyVoice): string => {
  const subject = voice.self ? "you" : voice.recipient;
  const possessive = voice.self ? "your" : possessiveOf(voice.recipient);
  switch (token) {
    case "subject": return subject;
    case "Subject": return capitalise(subject);
    case "possessive": return possessive;
    case "Possessive": return capitalise(possessive);
    case "do": return voice.self ? "do" : "does";
    case "Do": return voice.self ? "Do" : "Does";
    case "are": return voice.self ? "are" : "is";
    case "Are": return voice.self ? "Are" : "Is";
    case "is": return voice.self ? "are" : "is";
    case "Is": return voice.self ? "Are" : "Is";
    case "have": return voice.self ? "have" : "has";
    case "Have": return voice.self ? "Have" : "Has";
    case "was": return voice.self ? "were" : "was";
    case "Was": return voice.self ? "Were" : "Was";
    case "them": return voice.self ? "you" : voice.recipient;
    case "their": return possessive;
    // A child is named. "Your child" is only used by a parent or guardian.
    case "child": return voice.parent && voice.recipient === "the person receiving care"
      ? "your child" : voice.recipient;
    case "Child": return capitalise(
      voice.parent && voice.recipient === "the person receiving care" ? "your child" : voice.recipient,
    );
    default: return `{${token}}`;
  }
};

/** One string, written in the voice these answers belong in. */
export const resolveCopy = (text: string | null | undefined, voice: CopyVoice): string => {
  if (!text) return text ?? "";
  return text.replace(/\{([A-Za-z]+)\}/g, (whole, token: string) =>
    (TOKENS as readonly string[]).includes(token) ? valueFor(token, voice) : whole);
};

/** Every token this engine knows, for validation before publication. */
export const COPY_TOKENS: readonly string[] = TOKENS;
