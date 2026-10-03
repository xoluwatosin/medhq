// Pre-issue validation for a contract.
//
// Issuing freezes the wording and emails the candidate, so this pass runs
// before that point of no return. It is deliberately plain data in, plain
// results out, so the editor and the tests both exercise the same rules.
//
// The shape mirrors the real contract record: pay and dates live on the
// contract itself, while the {{token}} placeholders resolve against the
// fields map (see resolveBody in ContractDocument).
import type { ContractAnnex, ContractClause, ContractFields } from "@/lib/contracts";
import { CONTRACT_FIELDS } from "@/lib/contracts";

export type CheckSeverity = "error" | "warning";

export interface ContractCheck {
  id: string;
  severity: CheckSeverity;
  /** Short label, e.g. "Start date". */
  label: string;
  /** What is wrong, in one sentence. */
  message: string;
  /** Where the fix lives, so the UI can jump the editor there. */
  area: "details" | "letter" | `clause:${string}` | `annex:${string}`;
}

export interface ContractCheckInput {
  fields: ContractFields;
  clauses: ContractClause[];
  annexes: ContractAnnex[];
  isClinical?: boolean;
  /** Contract-level terms, taken from the record itself. */
  startDate?: string | null;
  endDate?: string | null;
  payAmount?: number | null;
  payCurrency?: string | null;
  /** Today's date, injectable for tests. Defaults to now. */
  today?: Date;
}

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

const KNOWN_TOKENS = new Set([
  ...CONTRACT_FIELDS.map((f) => f.key),
  "signed_date",
]);

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
};

/** Every {{token}} used across the pack, lower cased, de-duplicated. */
export function tokensUsedIn(clauses: ContractClause[], annexes: ContractAnnex[], isClinical?: boolean) {
  const found = new Set<string>();
  const scan = (html: string) => {
    PLACEHOLDER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER.exec(html || ""))) found.add(m[1].toLowerCase());
  };
  clauses.forEach((c) => scan(c.body || ""));
  includedAnnexes(annexes, isClinical).forEach((a) => scan(a.body || ""));
  return found;
}

/** Annexes that will actually be sent: included, in scope, with wording. */
export function includedAnnexes(annexes: ContractAnnex[], isClinical?: boolean) {
  return (annexes || []).filter(
    (a) => a.include !== false && (!a.clinical_only || isClinical) && (a.body || "").trim(),
  );
}

export function runContractChecks(input: ContractCheckInput): ContractCheck[] {
  const checks: ContractCheck[] = [];
  const today = isoDay(input.today ?? new Date());
  const f = input.fields;
  const clauses = input.clauses || [];
  const letter = clauses.map((c) => c.body || "").join("\n");
  const startDate = input.startDate || null;
  const endDate = input.endDate || null;

  // ---- Terms ---------------------------------------------------------------
  // Backdating is legitimate (someone already started), and the start date is
  // not editable on this screen, so this flags rather than blocks.
  if (startDate && startDate < today) {
    checks.push({
      id: "start-past",
      severity: "warning",
      label: "Start date",
      message: "The start date is in the past. This contract is backdated.",
      area: "details",
    });
  }
  if (startDate && endDate && endDate <= startDate) {
    checks.push({
      id: "end-before-start",
      severity: "error",
      label: "Dates",
      message: "The end date falls on or before the start date.",
      area: "details",
    });
  }
  if (input.payAmount != null && !(input.payAmount > 0)) {
    checks.push({
      id: "salary-zero",
      severity: "error",
      label: "Pay",
      message: "The salary is zero or negative.",
      area: "details",
    });
  }

  // ---- Placeholders ----------------------------------------------------------
  // A token left in the wording with no value behind it prints as raw braces
  // on the signed copy, so this blocks issuing.
  const used = tokensUsedIn(clauses, input.annexes, input.isClinical);
  const blankTokens = [...used].filter(
    (t) => KNOWN_TOKENS.has(t) && !String((f as Record<string, string>)[t] ?? "").trim(),
  );
  if (blankTokens.length) {
    checks.push({
      id: "blank-tokens",
      severity: "error",
      label: "Unfilled placeholders",
      message: `These placeholders appear in the wording but have no value: ${blankTokens
        .map((t) => `{{${t}}}`)
        .join(", ")}.`,
      area: "details",
    });
  }
  const unknownTokens = [...used].filter((t) => !KNOWN_TOKENS.has(t));
  if (unknownTokens.length) {
    checks.push({
      id: "unknown-tokens",
      severity: "warning",
      label: "Unknown placeholders",
      message: `These placeholders are not recognised fields: ${unknownTokens
        .map((t) => `{{${t}}}`)
        .join(", ")}. They will print as typed.`,
      area: "letter",
    });
  }

  // ---- Letter content ---------------------------------------------------------
  const emptyClauses = clauses.filter((c) => !(c.body || "").replace(/<[^>]+>/g, "").trim());
  if (clauses.length && emptyClauses.length === clauses.length) {
    checks.push({
      id: "letter-empty",
      severity: "error",
      label: "Offer letter",
      message: "The offer letter has no wording in any clause.",
      area: "letter",
    });
  } else if (emptyClauses.length) {
    checks.push({
      id: "clause-empty",
      severity: "warning",
      label: "Offer letter",
      message: `${emptyClauses.length} clause${emptyClauses.length === 1 ? " is" : "s are"} empty and will print as a bare heading.`,
      area: `clause:${emptyClauses[0].key}`,
    });
  }

  // Start date and salary should be visible somewhere in the letter, whether
  // through the commencement clause token or written out directly.
  const commencementTokens = ["clause_commencement", "start_date"];
  const mentionsStart =
    commencementTokens.some((t) => used.has(t)) || (startDate ? letter.includes(startDate) : true);
  if (startDate && !mentionsStart) {
    checks.push({
      id: "letter-no-start",
      severity: "warning",
      label: "Offer letter",
      message: "The letter never mentions the start date or uses the commencement clause.",
      area: "letter",
    });
  }
  const salaryFigure = String(f.salary_figure ?? "").trim();
  const mentionsSalary =
    used.has("salary_figure") || (salaryFigure ? letter.includes(salaryFigure) : false);
  if (!mentionsSalary && (input.payAmount || salaryFigure)) {
    checks.push({
      id: "letter-no-salary",
      severity: "warning",
      label: "Offer letter",
      message: "The letter never mentions the salary.",
      area: "letter",
    });
  }

  // ---- Pack ------------------------------------------------------------------
  const included = includedAnnexes(input.annexes, input.isClinical);
  const emptyIncluded = (input.annexes || []).filter(
    (a) => a.include !== false && (!a.clinical_only || input.isClinical) && !(a.body || "").trim(),
  );
  if (emptyIncluded.length) {
    checks.push({
      id: "annex-empty",
      severity: "warning",
      label: "Pack",
      message: `${emptyIncluded.map((a) => `${a.code} (${a.title})`).join(", ")} ${
        emptyIncluded.length === 1 ? "is" : "are"
      } in the pack but ${emptyIncluded.length === 1 ? "has" : "have"} no wording.`,
      area: `annex:${emptyIncluded[0].code}`,
    });
  }
  const codes = new Set<string>();
  const dupes = included.filter((a) => {
    const c = (a.code || "").trim().toUpperCase();
    if (!c) return false;
    if (codes.has(c)) return true;
    codes.add(c);
    return false;
  });
  if (dupes.length) {
    checks.push({
      id: "annex-dupe-code",
      severity: "error",
      label: "Pack",
      message: `Two annexes share the code ${dupes[0].code}.`,
      area: `annex:${dupes[0].code}`,
    });
  }
  const signCount = included.filter((a) => a.requires_signature).length;
  if (signCount > 2) {
    checks.push({
      id: "too-many-signatures",
      severity: "warning",
      label: "Pack",
      message: `${signCount} documents each ask for a signature. That is a lot of signing; consider switching some to acknowledgement only.`,
      area: "letter",
    });
  }

  // ---- Notice period ----------------------------------------------------------
  if (startDate && f.notice_period) {
    const match = String(f.notice_period).match(/(\d+)\s*(day|week|month)/i) ||
      String(f.notice_period).match(/^(one|two|three|four|six)\s*(day|week|month)/i);
    if (match) {
      const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6 };
      const n = /^\d+$/.test(match[1]) ? parseInt(match[1], 10) : words[match[1].toLowerCase()] ?? 0;
      const unit = match[2];
      const days = /month/i.test(unit) ? n * 30 : /week/i.test(unit) ? n * 7 : n;
      if (days > 0 && addDays(today, days) > startDate) {
        checks.push({
          id: "notice-vs-start",
          severity: "warning",
          label: "Notice period",
          message: `The notice period (${f.notice_period}) is longer than the time between today and the start date.`,
          area: "details",
        });
      }
    }
  }

  return checks;
}

/** Errors block issuing; warnings are advisory. */
export const hasBlockingChecks = (checks: ContractCheck[]) => checks.some((c) => c.severity === "error");
