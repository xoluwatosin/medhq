// Turning a signed contract pack into one PDF per document.
//
// The old approach photographed whatever contract happened to be on the page,
// which broke the moment the screen reloaded after countersigning: the node was
// gone and the attachment came out blank. Here each document is rendered fresh,
// off screen, from the saved contract data, then captured on its own. What the
// person receives is a file per document, each ending with its own execution
// page showing signatures, names and times.
import React from "react";
import { createRoot } from "react-dom/client";
import ContractDocument from "@/components/contracts/ContractDocument";
import { contractToPdfBlob } from "@/lib/contract-pdf";
import type { ContractAnnex, ContractClause, ContractFields } from "@/lib/contracts";

export interface PackPdf {
  /** Ordered file name, safe for email and storage. */
  filename: string;
  /** How the document is named on the profile and in the email. */
  label: string;
  /** "letter", or the annex code. */
  code: string;
  blob: Blob;
}

export interface PackSource {
  fields: ContractFields;
  clauses: ContractClause[];
  annexes: ContractAnnex[];
  isClinical?: boolean;
  signedName?: string | null;
  signedAt?: string | null;
  signatureImage?: string | null;
  countersignedName?: string | null;
  countersignedAt?: string | null;
  countersignatureImage?: string | null;
  annexSignatures?: Record<string, any> | null;
  annexAcknowledgements?: Record<string, any> | null;
  evidence?: {
    reference?: string | null;
    fingerprint?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "document";

/** Give the browser a paint, then wait for every image in the sheet to load. */
async function settle(node: HTMLElement) {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", () => resolve(null), { once: true });
            img.addEventListener("error", () => resolve(null), { once: true });
            setTimeout(() => resolve(null), 4000);
          }),
    ),
  );
  // Fonts matter to the layout, so wait for them too.
  await (document as any).fonts?.ready?.catch?.(() => undefined);
  await new Promise((r) => setTimeout(r, 120));
}

/**
 * The list of documents a pack will produce: the offer letter first, then
 * every included annex that carries wording, in order. Kept pure so the
 * inclusion rules (excluded, clinical-only, empty wording) are testable.
 */
export function packTargets(source: PackSource): { code: string; label: string; filename: string }[] {
  const person = slug(source.fields.employee_name || "medic-connect");
  const annexes = (source.annexes || []).filter(
    (a) => a.include !== false && (!a.clinical_only || source.isClinical) && (a.body || "").trim(),
  );
  return [
    {
      code: "letter",
      label: `Offer of employment, ${source.fields.job_title || "Medic Connect"}`,
      filename: `01-offer-of-employment-${person}.pdf`,
    },
    ...annexes.map((a, i) => ({
      code: a.code,
      label: `${a.code}, ${a.title}`,
      filename: `${String(i + 2).padStart(2, "0")}-${slug(`${a.code}-${a.title}`)}-${person}.pdf`,
    })),
  ];
}

/**
 * Build one PDF per document in the pack: the offer letter first, then every
 * included annex that carries wording, in order.
 */
export async function buildContractPack(source: PackSource): Promise<PackPdf[]> {
  const holder = document.createElement("div");
  holder.setAttribute("data-contract-pack", "true");
  holder.style.cssText =
    "position:fixed;left:-20000px;top:0;width:210mm;background:#ffffff;z-index:-1;pointer-events:none;";
  document.body.appendChild(holder);
  const root = createRoot(holder);

  const targets = packTargets(source);

  const out: PackPdf[] = [];
  try {
    for (const target of targets) {
      await new Promise<void>((resolve) => {
        root.render(
          React.createElement(ContractDocument, {
            fields: source.fields,
            clauses: source.clauses,
            annexes: source.annexes,
            isClinical: source.isClinical,
            signedName: source.signedName,
            signedAt: source.signedAt,
            signatureImage: source.signatureImage,
            countersignedName: source.countersignedName,
            countersignedAt: source.countersignedAt,
            countersignatureImage: source.countersignatureImage,
            annexSignatures: source.annexSignatures || undefined,
            annexAcknowledgements: source.annexAcknowledgements || undefined,
            showPlaceholders: false,
            acceptanceBlock: false,
            annexBodies: true,
            only: target.code,
            evidence: source.evidence,
          }),
        );
        setTimeout(resolve, 0);
      });

      const sheet = holder.querySelector(".mc-doc") as HTMLElement | null;
      if (!sheet) continue;
      await settle(sheet);
      const blob = await contractToPdfBlob(sheet);
      out.push({ ...target, blob });
    }
  } finally {
    root.unmount();
    holder.remove();
  }

  return out;
}
