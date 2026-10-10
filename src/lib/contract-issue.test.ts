// The one issue path: checks first, then freeze, then the signing email.
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const loadContract = vi.fn();
const issueContractDocument = vi.fn();
vi.mock("@/lib/contracts", () => ({
  DEFAULT_ANNEXES: [],
  effectiveClauses: () => [],
  effectiveFields: () => ({}),
  loadContract: (...a: unknown[]) => loadContract(...a),
  issueContractDocument: (...a: unknown[]) => issueContractDocument(...a),
}));

const runContractChecks = vi.fn();
vi.mock("@/lib/contract-checks", () => ({ runContractChecks: (...a: unknown[]) => runContractChecks(...a) }));

import { ContractNotReadyError, issueAndSendContract, issuedMessage } from "@/lib/contract-issue";

const draft = { id: "k1", status: "draft", annexes: [], is_clinical: false, start_date: null, end_date: null, pay_amount: null, pay_currency: "NGN" };

beforeEach(() => {
  invoke.mockReset();
  loadContract.mockReset().mockResolvedValue(draft);
  issueContractDocument.mockReset().mockResolvedValue("tok123");
  runContractChecks.mockReset().mockReturnValue([]);
});

describe("issueAndSendContract", () => {
  it("issues and emails a contract that passes its checks", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const r = await issueAndSendContract("k1", "Tosin");
    expect(issueContractDocument).toHaveBeenCalledWith("k1", "Tosin");
    expect(invoke).toHaveBeenCalledWith("send-contract-email", { body: { contract_id: "k1", kind: "issue" } });
    expect(r).toEqual({ token: "tok123", emailed: true, emailError: undefined });
    expect(issuedMessage(r)).toMatch(/emailed/);
  });

  it("refuses to issue when a check is blocking, and sends nothing", async () => {
    runContractChecks.mockReturnValue([
      { id: "start", severity: "error", label: "Start date", message: "The start date is missing.", area: "details" },
      { id: "w", severity: "warning", label: "Notice", message: "Short notice.", area: "details" },
    ]);
    await expect(issueAndSendContract("k1")).rejects.toBeInstanceOf(ContractNotReadyError);
    await expect(issueAndSendContract("k1")).rejects.toThrow(/Start date: The start date is missing\./);
    expect(issueContractDocument).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("issues on warnings alone", async () => {
    runContractChecks.mockReturnValue([{ id: "w", severity: "warning", label: "Notice", message: "Short notice.", area: "details" }]);
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(issueAndSendContract("k1")).resolves.toMatchObject({ emailed: true });
  });

  it("keeps the issue but reports a failed email", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Resend is down" } });
    const r = await issueAndSendContract("k1");
    expect(issueContractDocument).toHaveBeenCalled();
    expect(r).toMatchObject({ emailed: false, emailError: "Resend is down" });
    expect(issuedMessage(r)).toMatch(/did not send \(Resend is down\)/);
  });

  it("treats an error in the function's reply as a failed email", async () => {
    invoke.mockResolvedValue({ data: { error: "No email address on file" }, error: null });
    await expect(issueAndSendContract("k1")).resolves.toMatchObject({ emailed: false, emailError: "No email address on file" });
  });

  it("will not reissue a contract that has already gone out", async () => {
    loadContract.mockResolvedValue({ ...draft, status: "issued" });
    await expect(issueAndSendContract("k1")).rejects.toThrow(/already gone out/);
    expect(issueContractDocument).not.toHaveBeenCalled();
  });
});
