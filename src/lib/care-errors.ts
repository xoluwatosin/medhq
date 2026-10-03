// What staff are told when a Care action fails.
//
// Our own database functions raise plain sentences: "The pre-assessment has not
// come back yet", "That person is not an approved assessor". Those are worth
// showing. Anything that reads like machinery - a constraint name, a null
// column, a permission code - is written to the console for us and replaced
// with a sentence a coordinator can act on.
const TECHNICAL = [
  "violates", "constraint", "null value", "duplicate key", "relation ", "column ",
  "permission denied", "syntax error", "invalid input", "function ", "operator ",
  "pgrst", "jwt", "rls", "row-level security", "record \"", "sql", "type ",
  "failed to fetch", "does not exist", "uuid", "500", "504",
];

export interface CareErrorLike {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

/** True where the message is one of ours and safe to put in front of staff. */
const isHuman = (message: string): boolean => {
  const text = message.toLowerCase();
  if (text.length > 160) return false;
  if (/[_{}[\]]|\$\$|::/.test(message)) return false;
  return !TECHNICAL.some((needle) => text.includes(needle));
};

/**
 * The sentence to show. `fallback` is what staff see when the failure is
 * technical, and should say what could not be done and what to try.
 */
export const careErrorMessage = (
  error: CareErrorLike | Error | null | undefined,
  fallback: string,
): string => {
  const message = (error as CareErrorLike | null)?.message ?? "";
  if (message && isHuman(message)) return message;
  if (error) console.error("Care action failed", error);
  return fallback;
};
