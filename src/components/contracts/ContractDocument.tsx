// The contract itself, on screen, in print and in the PDF.
//
// One component renders all three, so the copy a person signs, the copy we
// email and the copy we file can never disagree. Clause wording arrives as
// rich text from the clause library and is placed here with its variables
// resolved. Unfilled variables are shown as a highlighted token so an admin
// can see at a glance what still needs writing before issue.
import { forwardRef } from "react";
import logo from "@/assets/contract/medicconnect-logo.svg";
import markInfinity from "@/assets/contract/mark-infinity-white.svg";
import markO from "@/assets/contract/mark-o-blue.svg";
import "./contract-theme.css";
import {
  COMPANY_SIGNATORY, ContractAnnex, ContractClause, ContractFields, DEFAULT_ANNEXES,
} from "@/lib/contracts";

export interface ContractDocumentProps {
  fields: ContractFields;
  clauses: ContractClause[];
  annexes?: ContractAnnex[];
  isClinical?: boolean;
  signedName?: string | null;
  signedAt?: string | null;
  signatureImage?: string | null;
  countersignedName?: string | null;
  countersignedAt?: string | null;
  countersignatureImage?: string | null;
  /** Draft view marks the empty variables; the issued view never should. */
  showPlaceholders?: boolean;
  /** Print the full annex wording after the letter. Off for the on-screen pack. */
  annexBodies?: boolean;
  /** The paper acceptance panel. Off on screen, where the signing panel does the work. */
  acceptanceBlock?: boolean;
  /** Per document signatures, shown as their own signature page. */
  annexSignatures?: Record<string, { at: string; name: string | null; method?: string; image?: string | null }>;
  /** Per document acknowledgements, for annexes that are read rather than signed. */
  annexAcknowledgements?: Record<string, { at: string; name: string | null; method?: string; image?: string | null }>;
  /**
   * Render one document on its own: "letter" for the offer letter, or an annex
   * code. Used to build a separate PDF per document in the pack.
   */
  only?: "letter" | string;
  /** Audit evidence printed on the execution page of a single document. */
  evidence?: {
    reference?: string | null;
    fingerprint?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };

  /** Admin-only draft editing: changes are written back to the working contract. */
  onClauseChange?: (index: number, patch: Partial<ContractClause>) => void;
  onAnnexChange?: (index: number, patch: Partial<ContractAnnex>) => void;
}

const COMPANY = "Medic Connect Limited";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Admin-authored rich text. Strip anything executable before it is rendered. */
const clean = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");

/** Put the field values into the clause wording. */
export function resolveBody(body: string, fields: ContractFields, showPlaceholders = true) {
  return clean(body).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = (fields?.[key] ?? "").toString().trim();
    if (value) {
      const html = escapeHtml(value).replace(/\n/g, "<br>");
      return `<span class="mc-value" data-mc-token="${escapeHtml(key)}">${html}</span>`;
    }
    return showPlaceholders ? `<span class="mc-tok" data-mc-token="${escapeHtml(key)}">${escapeHtml(key)}</span>` : "";
  });
}

const editableHtml = (node: HTMLElement) => {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[data-mc-token]").forEach((tokenNode) => {
    const token = tokenNode.getAttribute("data-mc-token") || tokenNode.textContent || "";
    tokenNode.replaceWith(document.createTextNode(`{{${token}}}`));
  });
  copy.querySelectorAll("[contenteditable], [suppresscontenteditablewarning]").forEach((editable) => {
    editable.removeAttribute("contenteditable");
    editable.removeAttribute("suppresscontenteditablewarning");
  });
  return clean(copy.innerHTML).trim();
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};

const Token = ({ value, name, show }: { value?: string | null; name: string; show: boolean }) =>
  value ? <span className="mc-value">{value}</span> : show ? <span className="mc-tok">{name}</span> : null;



/** Date and time in Lagos, written out for a legal record. */
const formatStamp = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
  });
  return `${date} at ${time} West Africa Time`;
};

interface Mark {
  at: string;
  name: string | null;
  method?: string;
  image?: string | null;
}

/**
 * The execution page. Printed at the end of every document in the pack so each
 * file stands on its own: who signed or acknowledged it, when, and the evidence
 * we hold for it.
 */
const Execution = ({
  heading, requiresSignature, employeeName, signature, acknowledgement,
  countersignedName, countersignedAt, countersignatureImage, evidence, documentCode,
}: {
  heading: string;
  requiresSignature: boolean;
  employeeName: string;
  signature: Mark | null;
  acknowledgement: Mark | null;
  countersignedName?: string | null;
  countersignedAt?: string | null;
  countersignatureImage?: string | null;
  evidence?: ContractDocumentProps["evidence"];
  documentCode: string;
}) => {
  const mark = signature || acknowledgement;
  const kind = signature ? "Signed" : acknowledgement ? "Acknowledged" : null;

  return (
    <section className="mc-exec" style={{ marginTop: 26 }}>
      <div className="mc-eyebrow">Execution</div>
      <h3 style={{ margin: "6px 0 12px", fontSize: 15, color: "var(--mc-deep)" }}>{heading}</h3>

      {mark ? (
        <div className="mc-sign-grid">
          <div className="mc-sign-card">
            <div className="mc-eyebrow" style={{ fontSize: 9 }}>{signature ? "Employee" : "Acknowledged by"}</div>
            <div className="mc-sign-box">
              {mark.image ? (
                <img src={mark.image} alt="Signature" />
              ) : (
                <span className="ink">{mark.name || employeeName}</span>
              )}
            </div>
            <div className="mc-sign-meta">
              <div><span className="k">Name</span> <span className="mc-value">{mark.name || employeeName}</span></div>
              <div><span className="k">{kind}</span> <span className="mc-value">{formatStamp(mark.at)}</span></div>
              {signature ? (
                <div>
                  <span className="k">Method</span>{" "}
                  <span className="mc-value">{mark.method === "typed" ? "Typed name" : "Drawn signature"}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mc-sign-card">
            <div className="mc-eyebrow" style={{ fontSize: 9 }}>For {COMPANY}</div>
            <div className="mc-sign-box">
              {countersignatureImage ? (
                <img src={countersignatureImage} alt="Countersignature" />
              ) : countersignedName ? (
                <span className="ink">{countersignedName}</span>
              ) : (
                ""
              )}
            </div>
            <div className="mc-sign-meta">
              <div><span className="k">Name and position</span> <span className="mc-value">{countersignedName || COMPANY_SIGNATORY}</span></div>
              {countersignedAt ? (
                <div><span className="k">Countersigned</span> <span className="mc-value">{formatStamp(countersignedAt)}</span></div>
              ) : (
                <div><span className="k">Countersigned</span> <span className="mc-value">Awaiting countersignature</span></div>
              )}
            </div>

          </div>
        </div>
      ) : (
        <p className="mc-body" style={{ margin: 0 }}>
          {requiresSignature
            ? "This document has not been signed."
            : "This document has not been acknowledged."}
        </p>
      )}

      {mark ? (
        <p style={{ margin: "12px 0 0", fontSize: 11, lineHeight: 1.55, color: "var(--mc-muted)" }}>
          {[
            evidence?.reference ? `Contract reference ${evidence.reference}` : null,
            `Document ${documentCode}`,
            evidence?.fingerprint ? `Wording fingerprint ${evidence.fingerprint}` : null,
            evidence?.ip ? `Signed from ${evidence.ip}` : null,
            evidence?.userAgent ? `Device ${evidence.userAgent}` : null,
          ].filter(Boolean).join(" \u00b7 ")}
          <br />
          By giving their name, drawing their signature and ticking the confirmation box, the person named
          above adopted this as their electronic signature, which has the same effect as a signature in ink.
        </p>
      ) : null}
    </section>
  );
};

const ContractDocument = forwardRef<HTMLDivElement, ContractDocumentProps>((props, ref) => {
  const {
    fields, clauses, annexes, isClinical, signedName, signedAt, signatureImage,
    countersignedName, countersignedAt, countersignatureImage, showPlaceholders = true,
    annexBodies = true, acceptanceBlock = true, annexSignatures, annexAcknowledgements,
    only, evidence,
    onClauseChange, onAnnexChange,
  } = props;

  const canEditClauses = !!onClauseChange;
  const canEditAnnexes = !!onAnnexChange;
  const letterParts = !only || only === "letter";
  const main = clauses.map((clause, index) => ({ clause, index })).filter(({ clause }) => clause.section !== "additional");
  const additional = clauses.map((clause, index) => ({ clause, index })).filter(({ clause }) => clause.section === "additional");
  const annexList = (annexes?.length ? annexes : DEFAULT_ANNEXES).map((annex, index) => ({ annex, index })).filter(
    ({ annex }) => annex.include !== false && (!annex.clinical_only || isClinical),
  );
  const signedAnnexes = annexList.filter(({ annex }) => annex.requires_signature).map(({ annex }) => annex.code);

  const employeeName = fields.employee_name || "";
  const firstName = employeeName.split(" ")[0] || "";
  const runTitle =
    only && only !== "letter"
      ? `${only}, ${annexList.find(({ annex }) => annex.code === only)?.annex.title || "Annex"}`
      : "Offer of Employment";

  return (
    <div className="mc-doc" ref={ref}>
      <div className="mc-sheet">
        <div className="mc-runhead">
          <span>{COMPANY}</span>
          <span>{runTitle}</span>
        </div>



        <header className="mc-letterhead">
          <div>
            <img src={logo} alt="Medic Connect" style={{ height: 26, display: "block" }} />
            <div
              style={{
                marginTop: 12, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--mc-blue)",
              }}
            >
              Health &amp; Human Services
            </div>
          </div>
          <address className="mc-address" style={{ fontStyle: "normal" }}>
            MEDIC CONNECT LIMITED<br />
            145, Igbosere road, Lagos Island, Nigeria<br />
            hello@medicconnect.co
          </address>
        </header>

        {letterParts && (<>
        <div className="mc-meta">

          <div className="k">Date</div>
          <div className="v"><Token value={formatDate(fields.offer_date)} name="offer_date" show={showPlaceholders} /></div>
          <div className="k">Employee's name</div>
          <div className="v"><Token value={employeeName} name="employee_name" show={showPlaceholders} /></div>
          <div className="k">Employee's address</div>
          <div className="v"><Token value={fields.employee_address} name="employee_address" show={showPlaceholders} /></div>
          <div className="k">Email address</div>
          <div className="v"><Token value={fields.employee_email} name="employee_email" show={showPlaceholders} /></div>
        </div>

        <p style={{ margin: "26px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--mc-body)" }}>
          Dear <Token value={firstName} name="employee_first_name" show={showPlaceholders} />,
        </p>
        <h1 className="mc-title">Offer of Employment</h1>
        <p className="mc-body" style={{ marginTop: 14 }}>
          We are pleased to offer you the position of{" "}
          <Token value={fields.job_title} name="job_title" show={showPlaceholders} /> at {COMPANY}. After
          careful consideration, we believe your skills and experience will be a great addition to our
          team. The details of the offer are as follows:
        </p>

        {main.map(({ clause, index }, i) => (
          <section key={clause.key} className={`mc-sec${i === 0 ? " first" : ""}`}>
            <h2
              className={`mc-h2${canEditClauses ? " mc-editable" : ""}`}
              contentEditable={canEditClauses}
              suppressContentEditableWarning
              onBlur={(e) => onClauseChange?.(index, { heading: e.currentTarget.textContent?.replace(/^\s*\d+\.\s*/, "").trim() || clause.heading })}
            >
              {i + 1}.&nbsp;&nbsp;{clause.heading}
            </h2>
            <div
              className={`mc-body${canEditClauses ? " mc-editable" : ""}`}
              contentEditable={canEditClauses}
              suppressContentEditableWarning
              onBlur={(e) => onClauseChange?.(index, { body: editableHtml(e.currentTarget) })}
              dangerouslySetInnerHTML={{ __html: resolveBody(clause.body, fields, showPlaceholders) }}
            />
          </section>
        ))}

        {additional.length > 0 && (
          <>
            <div className="mc-banner">
              <div className="mc-banner-inner">
                <img src={markInfinity} alt="" />
                <h2>Additional Terms and Clauses</h2>
              </div>
            </div>
            <section className="mc-sec" style={{ borderTop: "none", paddingTop: 18 }}>
              {additional.map(({ clause, index }) => (
                <div key={clause.key} style={{ breakInside: "avoid" }}>
                  <h3
                    className={canEditClauses ? "mc-editable" : undefined}
                    contentEditable={canEditClauses}
                    suppressContentEditableWarning
                    onBlur={(e) => onClauseChange?.(index, { heading: e.currentTarget.textContent?.trim() || clause.heading })}
                    style={{
                      margin: "16px 0 7px", fontWeight: 700, fontSize: 14,
                      letterSpacing: "-0.01em", color: "var(--mc-deep)",
                    }}
                  >
                    {clause.heading}
                  </h3>
                  <div
                    className={`mc-body${canEditClauses ? " mc-editable" : ""}`}
                    contentEditable={canEditClauses}
                    suppressContentEditableWarning
                    onBlur={(e) => onClauseChange?.(index, { body: editableHtml(e.currentTarget) })}
                    dangerouslySetInnerHTML={{ __html: resolveBody(clause.body, fields, showPlaceholders) }}
                  />
                </div>
              ))}
            </section>
          </>
        )}

        {annexList.length > 0 && (
          <div className="mc-annexes">
            <div className="mc-eyebrow">Documents referred to in this contract</div>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--mc-muted)" }}>
              Issued with this offer and forming part of it.
              {signedAnnexes.length > 0
                ? ` The Employee is asked to sign ${signedAnnexes.join(" and ")} alongside this letter.`
                : ""}
            </p>
            <div className="mc-annex-grid">
              {annexList.map(({ annex: a, index }) => (
                <div className="mc-annex-row" key={a.code}>
                  <span
                    className={`code${canEditAnnexes ? " mc-editable" : ""}`}
                    contentEditable={canEditAnnexes}
                    suppressContentEditableWarning
                    onBlur={(e) => onAnnexChange?.(index, { code: e.currentTarget.textContent?.trim() || a.code })}
                  >
                    {a.code}
                  </span>
                  <span>
                    <span
                      className={canEditAnnexes ? "mc-editable" : undefined}
                      contentEditable={canEditAnnexes}
                      suppressContentEditableWarning
                      onBlur={(e) => onAnnexChange?.(index, { title: e.currentTarget.textContent?.trim() || a.title })}
                    >
                      {a.title}
                    </span>
                    {a.note ? (
                      <span
                        className={canEditAnnexes ? "mc-editable" : undefined}
                        contentEditable={canEditAnnexes}
                        suppressContentEditableWarning
                        onBlur={(e) => onAnnexChange?.(index, { note: e.currentTarget.textContent?.trim() || undefined })}
                        style={{ display: "block", color: "var(--mc-muted)", fontSize: 12 }}
                      >
                        {a.note}
                      </span>
                    ) : null}
                    {a.attachment_name ? (
                      <span style={{ display: "block", color: "var(--mc-blue)", fontSize: 12 }}>
                        Attached: {a.attachment_name}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}


        {acceptanceBlock && (
        <div className="mc-accept">
          <div className="mc-accept-inner">
            <img src={markO} alt="" />
            <h2>Acceptance</h2>
            <p className="lead">
              I acknowledge that I have read and that I understand the terms and conditions of employment
              contained herein. I understand that by signing this document I agree to be bound by all the
              terms, conditions and obligations set out above.
            </p>

            <div className="mc-sign-grid">
              <div className="mc-sign-card">
                <div className="mc-eyebrow" style={{ fontSize: 9 }}>Company's Representative</div>
                <div className="mc-sign-box">
                  {countersignatureImage ? (
                    <img src={countersignatureImage} alt="Countersignature" />
                  ) : countersignedName ? (
                    <span className="ink">{countersignedName}</span>
                  ) : null}
                </div>
                <div className="mc-sign-meta">
                  <div>
                    <span className="k">Name and position</span>{" "}
                    <span className="mc-value">
                      {countersignedName || fields.signatory_name || COMPANY_SIGNATORY}
                    </span>
                  </div>
                  <div>
                    <span className="k">Date</span>{" "}
                    <span className="mc-value">
                      {formatDate(countersignedAt) || "On countersignature"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mc-sign-card">
                <div className="mc-eyebrow" style={{ fontSize: 9 }}>Applicant</div>
                <div className="mc-sign-box">
                  {signatureImage ? (
                    <img src={signatureImage} alt="Signature" />
                  ) : signedName ? (
                    <span className="ink">{signedName}</span>
                  ) : null}
                </div>
                <div className="mc-sign-meta">
                  <div>
                    <span className="k">Name</span>{" "}
                    <Token value={signedName || employeeName} name="employee_name" show={showPlaceholders} />
                  </div>
                  <div>
                    <span className="k">Date</span>{" "}
                    <span className="mc-value">
                      {formatDate(signedAt) || "On signing"}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            <div className="mc-consent">
              <span className="box">{signedAt ? "\u2713" : ""}</span>
              <span>
                By giving my name, drawing my signature and ticking this box I confirm that this
                constitutes my electronic signature and has the same effect as a signature in ink.
              </span>
            </div>
          </div>
        </div>
        )}


        {annexSignatures && Object.keys(annexSignatures).length > 0 && (
          <section className="mc-annexes" style={{ marginTop: 26 }}>
            <div className="mc-eyebrow">Documents signed separately</div>
            <div className="mc-annex-grid">
              {annexList
                .filter(({ annex }) => annexSignatures[annex.code])
                .map(({ annex: a }) => {
                  const s = annexSignatures[a.code];
                  return (
                    <div className="mc-annex-row" key={`sig-${a.code}`}>
                      <span className="code">{a.code}</span>
                      <span>
                        <span>{a.title}</span>
                        <span style={{ display: "block", color: "var(--mc-muted)", fontSize: 12 }}>
                          Signed by {s.name || employeeName} on {formatDate(s.at)}
                          {s.method === "drawn" ? ", drawn" : ", typed"}
                        </span>
                        {s.image ? (
                          <img src={s.image} alt={`Signature on ${a.code}`} style={{ maxHeight: 44, marginTop: 4 }} />
                        ) : null}
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
        </>)}



        {annexBodies && annexList
          .filter(({ annex }) => (annex.body || "").trim())
          .filter(({ annex }) => (only ? only === annex.code : true))
          .map(({ annex: a, index }) => (
          <section className="mc-annex-doc" key={`doc-${a.code}`} style={{ breakBefore: only ? "auto" : "page", marginTop: only ? 0 : 28 }}>
            <div
              className={`mc-eyebrow${canEditAnnexes ? " mc-editable" : ""}`}
              contentEditable={canEditAnnexes}
              suppressContentEditableWarning
              onBlur={(e) => onAnnexChange?.(index, { code: e.currentTarget.textContent?.trim() || a.code })}
            >
              {a.code}
            </div>
            <h2
              className={canEditAnnexes ? "mc-editable" : undefined}
              contentEditable={canEditAnnexes}
              suppressContentEditableWarning
              onBlur={(e) => onAnnexChange?.(index, { title: e.currentTarget.textContent?.trim() || a.title })}
              style={{ margin: "6px 0 12px", fontSize: 20 }}
            >
              {a.title}
            </h2>
            {a.note ? (
              <p
                className={canEditAnnexes ? "mc-editable" : undefined}
                contentEditable={canEditAnnexes}
                suppressContentEditableWarning
                onBlur={(e) => onAnnexChange?.(index, { note: e.currentTarget.textContent?.trim() || undefined })}
                style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--mc-muted)" }}
              >
                {a.note}
              </p>
            ) : null}
            <div
              className={`mc-body${canEditAnnexes ? " mc-editable" : ""}`}
              contentEditable={canEditAnnexes}
              suppressContentEditableWarning
              onBlur={(e) => onAnnexChange?.(index, { body: editableHtml(e.currentTarget) })}
              dangerouslySetInnerHTML={{ __html: resolveBody(a.body || "", fields, showPlaceholders) }}
            />
            {only === a.code && (
              <Execution
                heading={`${a.code}, ${a.title}`}
                requiresSignature={a.requires_signature !== false}
                employeeName={employeeName}
                signature={annexSignatures?.[a.code] ?? null}
                acknowledgement={annexAcknowledgements?.[a.code] ?? null}
                countersignedName={countersignedName || fields.signatory_name}
                countersignedAt={countersignedAt}
                countersignatureImage={countersignatureImage}
                evidence={evidence}
                documentCode={a.code}
              />
            )}
          </section>
        ))}

        {only === "letter" && (
          <Execution
            heading="Offer of employment"
            requiresSignature
            employeeName={employeeName}
            signature={
              signedAt ? { at: signedAt, name: signedName ?? null, method: "drawn", image: signatureImage ?? null } : null
            }
            acknowledgement={null}
            countersignedName={countersignedName || fields.signatory_name}
            countersignedAt={countersignedAt}
            countersignatureImage={countersignatureImage}
            evidence={evidence}
            documentCode="Contract"
          />
        )}




        <div className="mc-runfoot">
          <span>{COMPANY}&nbsp;&nbsp;|&nbsp;&nbsp;{employeeName || "Employee"}</span>
          <span>Private and confidential</span>
        </div>
      </div>
    </div>
  );
});

ContractDocument.displayName = "ContractDocument";

export default ContractDocument;
