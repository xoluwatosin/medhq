import { supabase } from "@/integrations/supabase/client";

/**
 * Every Heard consumer write goes through the heard-submit Edge Function,
 * which validates and calls a security-definer database function. The browser
 * never writes to a heard_ table, and never reads one directly.
 */
export type HeardSubmitKind =
  | "message"
  | "story"
  | "letter"
  | "letter_subscribe"
  | "phone_waitlist";

export interface HeardSubmitPayload {
  kind: HeardSubmitKind;
  content?: string;
  subject?: string;
  heading?: string;
  signItAs?: string;
  email?: string;
  consentVersion?: string;
  source?: string;
}

/** The consent version recorded with letter submissions and letter opt-ins. */
export const HEARD_CONSENT_VERSION = "v1";

export const heardSubmit = async (payload: HeardSubmitPayload): Promise<void> => {
  const { data, error } = await supabase.functions.invoke("heard-submit", {
    body: payload,
  });
  const returned = data as { ok?: boolean; error?: string } | null;
  if (error || returned?.error || !returned?.ok) {
    throw new Error(returned?.error ?? error?.message ?? "Submission failed");
  }
};

export interface HeardPublicLetter {
  public_ref: string;
  heading: string | null;
  content: string;
  sign_it_as: string | null;
  published_at: string | null;
}

/**
 * Approved Letter Room letters, read through the security-definer function
 * that returns published fields only. No email, no status, no moderation data.
 */
export const fetchPublicLetters = async (limit = 40): Promise<HeardPublicLetter[]> => {
  const { data, error } = await supabase.rpc("heard_public_letters", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as HeardPublicLetter[];
};

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const HEARD_ERRORS = {
  required: "That field needs something.",
  email: "Enter a valid email address.",
  generic: "Something went wrong. Try again.",
  message: "Your message couldn't be sent.",
  story: "Your story couldn't be submitted.",
  letter: "Your letter couldn't be submitted.",
} as const;
