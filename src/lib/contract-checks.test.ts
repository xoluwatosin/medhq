// Tests for the pre-issue validation pass.
import { describe, expect, it } from "vitest";
import { hasBlockingChecks, includedAnnexes, runContractChecks, tokensUsedIn } from "@/lib/contract-checks";
import type { ContractAnnex, ContractClause, ContractFields } from "@/lib/contracts";

const TODAY = new Date("2026-09-01T00:00:00Z");

const fields = (over: Partial<ContractFields> = {}): ContractFields =>
  ({
    employee_name: "Joyce Ayamke",
    job_title: "Operations Nurse",
    salary_figure: "NGN 400,000",
    notice_period: "one month",
    clause_commencement: "Your employment begins on 1 October 2026.",
    ...over,
  }) as ContractFields;

const clause = (body: string, key = "c1"): ContractClause => ({
  key,
  heading: "Terms",
  body,
  section: "main",
});

const annex = (over: Partial<ContractAnnex> = {}): ContractAnnex => ({
  code: "ANNEX-A",
  title: "Confidentiality",
  body: "<p>Wording</p>",
  include: true,
  requires_signature: false,
  ...over,
});

const run = (over: Partial<Parameters<typeof runContractChecks>[0]> = {}) =>
  runContractChecks({
    fields: fields(),
    clauses: [clause("<p>{{clause_commencement}} Pay is {{salary_figure}}.</p>")],
    annexes: [],
    startDate: "2026-10-01",
    payAmount: 400000,
    today: TODAY,
    ...over,
  });

describe("runContractChecks", () => {
  it("passes a clean contract with no checks", () => {
    expect(run()).toEqual([]);
  });

  it("flags a start date in the past without blocking", () => {
    const checks = run({ startDate: "2026-08-01" });
    expect(checks.find((c) => c.id === "start-past")?.severity).toBe("warning");
    expect(hasBlockingChecks(checks)).toBe(false);
  });

  it("blocks an end date before the start date", () => {
    const checks = run({ endDate: "2026-09-15" });
    expect(checks.find((c) => c.id === "end-before-start")?.severity).toBe("error");
  });

  it("blocks a zero salary", () => {
    const checks = run({ payAmount: 0 });
    expect(checks.find((c) => c.id === "salary-zero")?.severity).toBe("error");
  });

  it("blocks placeholders that appear in the wording but have no value", () => {
    const checks = run({
      fields: fields({ employee_address: "" }),
      clauses: [clause("<p>{{clause_commencement}} {{salary_figure}} Send to {{employee_address}}.</p>")],
    });
    const check = checks.find((c) => c.id === "blank-tokens");
    expect(check?.severity).toBe("error");
    expect(check?.message).toContain("{{employee_address}}");
    expect(check?.message).not.toContain("{{salary_figure}}");
  });

  it("warns on unknown placeholders instead of blocking", () => {
    const checks = run({ clauses: [clause("<p>{{clause_commencement}} {{salary_figure}} Ref {{ticket_number}}.</p>")] });
    const check = checks.find((c) => c.id === "unknown-tokens");
    expect(check?.severity).toBe("warning");
    expect(hasBlockingChecks(checks)).toBe(false);
  });

  it("blocks when every clause is empty", () => {
    const checks = run({ clauses: [clause("<p></p>")] });
    expect(checks.find((c) => c.id === "letter-empty")?.severity).toBe("error");
  });

  it("warns when one clause is empty among several", () => {
    const checks = run({
      clauses: [clause("<p>{{clause_commencement}} {{salary_figure}}</p>"), clause("", "c2")],
    });
    const check = checks.find((c) => c.id === "clause-empty");
    expect(check?.severity).toBe("warning");
    expect(check?.area).toBe("clause:c2");
  });

  it("warns when the letter never mentions the start date or salary", () => {
    const checks = run({ clauses: [clause("<p>Welcome aboard.</p>")] });
    expect(checks.find((c) => c.id === "letter-no-start")?.severity).toBe("warning");
    expect(checks.find((c) => c.id === "letter-no-salary")?.severity).toBe("warning");
  });

  it("warns on included annexes with no wording", () => {
    const checks = run({ annexes: [annex({ body: "" })] });
    expect(checks.find((c) => c.id === "annex-empty")?.severity).toBe("warning");
  });

  it("blocks duplicate annex codes in the pack", () => {
    const checks = run({ annexes: [annex(), annex()] });
    expect(checks.find((c) => c.id === "annex-dupe-code")?.severity).toBe("error");
  });

  it("warns when more than two documents each need a signature", () => {
    const checks = run({
      annexes: [
        annex({ code: "ANNEX-A", requires_signature: true }),
        annex({ code: "ANNEX-B", requires_signature: true }),
        annex({ code: "ANNEX-C", requires_signature: true }),
      ],
    });
    expect(checks.find((c) => c.id === "too-many-signatures")?.severity).toBe("warning");
  });

  it("warns when the notice period outruns the time to the start date", () => {
    const checks = run({ startDate: "2026-09-10", fields: fields({ notice_period: "1 month" }) });
    expect(checks.find((c) => c.id === "notice-vs-start")?.severity).toBe("warning");
  });

  it("reads worded notice periods too", () => {
    const checks = run({ startDate: "2026-09-05" });
    expect(checks.find((c) => c.id === "notice-vs-start")?.severity).toBe("warning");
  });

  it("does not warn when the notice period fits before the start date", () => {
    const checks = run({ fields: fields({ notice_period: "2 weeks" }) });
    expect(checks.find((c) => c.id === "notice-vs-start")).toBeUndefined();
  });
});

describe("tokensUsedIn and includedAnnexes", () => {
  it("collects tokens from clauses and included annexes only", () => {
    const tokens = tokensUsedIn(
      [clause("<p>{{employee_name}} {{salary_figure}}</p>")],
      [
        annex({ body: "<p>{{employee_address}}</p>" }),
        annex({ code: "ANNEX-B", body: "<p>{{secret_token}}</p>", include: false }),
      ],
    );
    expect([...tokens].sort()).toEqual(["employee_address", "employee_name", "salary_figure"]);
  });

  it("includedAnnexes skips excluded, empty and out-of-scope clinical annexes", () => {
    const annexes = [
      annex({ code: "A" }),
      annex({ code: "B", include: false }),
      annex({ code: "C", body: "" }),
      annex({ code: "D", clinical_only: true }),
    ];
    expect(includedAnnexes(annexes, false).map((a) => a.code)).toEqual(["A"]);
    expect(includedAnnexes(annexes, true).map((a) => a.code)).toEqual(["A", "D"]);
  });
});
