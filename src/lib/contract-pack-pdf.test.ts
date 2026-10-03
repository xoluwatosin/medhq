// Regression tests for which documents end up in a contract pack PDF set.
//
// The rules that matter: excluded annexes never ship, clinical-only annexes
// only ship for clinical hires, an annex with no wording is skipped, and the
// offer letter always comes first with ordered, safe file names.
import { describe, expect, it } from "vitest";
import { packTargets, type PackSource } from "@/lib/contract-pack-pdf";
import type { ContractAnnex, ContractFields } from "@/lib/contracts";

const fields = { employee_name: "Francisca Abosede", job_title: "Registered Nurse" } as ContractFields;

const annex = (over: Partial<ContractAnnex>): ContractAnnex => ({
  code: "ANNEX-A",
  title: "Confidentiality",
  body: "<p>Wording</p>",
  include: true,
  requires_signature: false,
  ...over,
});

const source = (annexes: ContractAnnex[], isClinical = false): PackSource => ({
  fields,
  clauses: [],
  annexes,
  isClinical,
});

describe("packTargets", () => {
  it("always puts the offer letter first", () => {
    const targets = packTargets(source([annex({})]));
    expect(targets[0].code).toBe("letter");
    expect(targets[0].filename).toBe("01-offer-of-employment-francisca-abosede.pdf");
    expect(targets[0].label).toContain("Registered Nurse");
  });

  it("numbers annex files after the letter", () => {
    const targets = packTargets(
      source([annex({ code: "ANNEX-A" }), annex({ code: "ANNEX-B", title: "Data Protection" })]),
    );
    expect(targets.map((t) => t.filename)).toEqual([
      "01-offer-of-employment-francisca-abosede.pdf",
      "02-annex-a-confidentiality-francisca-abosede.pdf",
      "03-annex-b-data-protection-francisca-abosede.pdf",
    ]);
  });

  it("drops annexes that are excluded or have no wording", () => {
    const targets = packTargets(
      source([
        annex({ code: "ANNEX-A", include: false }),
        annex({ code: "ANNEX-B", body: "   " }),
        annex({ code: "ANNEX-C", body: "" }),
      ]),
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].code).toBe("letter");
  });

  it("keeps clinical-only annexes out of a non-clinical pack", () => {
    const targets = packTargets(
      source([
        annex({ code: "ANNEX-D", title: "Clinical Governance", clinical_only: true }),
        annex({ code: "ANNEX-E", title: "Uniform" }),
      ]),
    );
    expect(targets.map((t) => t.code)).toEqual(["letter", "ANNEX-E"]);
  });

  it("includes clinical-only annexes for a clinical hire", () => {
    const targets = packTargets(
      source([annex({ code: "ANNEX-D", title: "Clinical Governance", clinical_only: true })], true),
    );
    expect(targets.map((t) => t.code)).toEqual(["letter", "ANNEX-D"]);
  });

  it("falls back to a safe file slug when the name is missing or messy", () => {
    const targets = packTargets({
      fields: { employee_name: "  O'Hara / Test!! " } as ContractFields,
      clauses: [],
      annexes: [],
    });
    expect(targets[0].filename).toBe("01-offer-of-employment-o-hara-test.pdf");

    const unnamed = packTargets({ fields: {} as ContractFields, clauses: [], annexes: [] });
    expect(unnamed[0].filename).toBe("01-offer-of-employment-medic-connect.pdf");
  });
});
