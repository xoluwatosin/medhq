// The one way a contract is issued, wherever the button is pressed: the
// contract editor, the candidate's Offers tab, the staff record, or a bulk
// issue from a template.
//
// Issuing freezes the wording, so the pre-issue checks run first against the
// saved draft. Then the signing email goes out. A failed email does not undo
// the issue (the wording is frozen and the link works); it is reported so the
// office can resend from the contract.
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ANNEXES,
  effectiveClauses,
  effectiveFields,
  issueContractDocument,
  loadContract,
  type ContractRecord,
} from "@/lib/contracts";
import { runContractChecks, type ContractCheck } from "@/lib/contract-checks";

export class ContractNotReadyError extends Error {
  checks: ContractCheck[];
  constructor(checks: ContractCheck[]) {
    const list = checks.map((c) => `${c.label}: ${c.message}`).join(" ");
    super(`Open the contract and fix this before issuing. ${list}`);
    this.name = "ContractNotReadyError";
    this.checks = checks;
  }
}

/** The pre-issue checks for a saved contract, exactly as the editor runs them. */
export function checksForContract(c: ContractRecord): ContractCheck[] {
  return runContractChecks({
    fields: effectiveFields(c),
    clauses: effectiveClauses(c),
    annexes: c.annexes?.length ? c.annexes : DEFAULT_ANNEXES,
    isClinical: !!c.is_clinical,
    startDate: c.start_date,
    endDate: c.end_date,
    payAmount: c.pay_amount,
    payCurrency: c.pay_currency,
  });
}

export interface IssueResult {
  /** The signing token, for copying the link. */
  token: string;
  /** Whether the signing email was sent. */
  emailed: boolean;
  /** Why the email failed, when it did. */
  emailError?: string;
}

export async function issueAndSendContract(contractId: string, actorName?: string | null): Promise<IssueResult> {
  const contract = await loadContract(contractId);
  if (contract.status !== "draft") {
    throw new Error("Only a draft contract can be issued. This one has already gone out.");
  }
  const blocking = checksForContract(contract).filter((c) => c.severity === "error");
  if (blocking.length) throw new ContractNotReadyError(blocking);

  const token = await issueContractDocument(contractId, actorName);
  const { data, error } = await supabase.functions.invoke("send-contract-email", {
    body: { contract_id: contractId, kind: "issue" },
  });
  const failure = error?.message || (data as { error?: string } | null)?.error;
  return { token, emailed: !failure, emailError: failure || undefined };
}

/** The line to show after an issue, honest about the email. */
export const issuedMessage = (r: IssueResult) =>
  r.emailed
    ? "Issued. The signing link has been emailed to them."
    : `Issued, but the email did not send${r.emailError ? ` (${r.emailError})` : ""}. Open the contract and use Chase to resend.`;
