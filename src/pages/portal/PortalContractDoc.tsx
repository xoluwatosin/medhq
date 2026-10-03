// One document, on its own screen.
//
// The letter, or a single annex. Nothing else is on the page: the wording, a
// way to move through it, and the one thing this document asks for at the
// foot. A person signs each document in the pack in its own right.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2, Download, Loader2, Maximize2, Minimize2, PenLine, ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { useToast } from "@/hooks/use-toast";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { CxButton, CxCard, CxPill } from "@/components/candidate/primitives";
import ContractDocument from "@/components/contracts/ContractDocument";
import SignaturePad from "@/components/contracts/SignaturePad";
import { contractToPdfBlob, downloadBlob } from "@/lib/contract-pdf";
import {
  PortalContract as PortalContractRow, acknowledgeAnnex, loadMyContract, packItems,
  signAnnex, signMyContract, visibleAnnexes,
} from "@/lib/contracts";
import { usePortal } from "./usePortal";

/** Pull the headings out so a long policy can be moved through. Pasted annexes
 *  often mark a section with a bold line or capitals rather than a heading tag,
 *  so those are lifted to real headings before the list is built. */
const withSections = (html: string) => {
  if (typeof window === "undefined") return { html, sections: [] as { id: string; text: string }[] };
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.body.querySelectorAll("p").forEach((node) => {
    const text = (node.textContent || "").trim();
    if (!text || text.length > 90 || /[.;:]$/.test(text)) return;
    const onlyChild = node.children.length === 1 ? node.children[0] : null;
    const boldWhole =
      onlyChild &&
      ["STRONG", "B"].includes(onlyChild.tagName) &&
      (onlyChild.textContent || "").trim() === text;
    const shouty = text === text.toUpperCase() && /[A-Z]{3}/.test(text);
    const numbered = /^\d+(\.\d+)*[.)]?\s+\S/.test(text) && (boldWhole || shouty);
    if (!boldWhole && !shouty && !numbered) return;
    const heading = doc.createElement(shouty && !/^\d/.test(text) ? "h2" : "h3");
    heading.textContent = text;
    node.replaceWith(heading);
  });

  // Tables need a frame of their own so a wide one scrolls instead of the page.
  doc.body.querySelectorAll("table").forEach((table) => {
    if ((table.parentElement as HTMLElement | null)?.classList.contains("mc-table-scroll")) return;
    const wrap = doc.createElement("div");
    wrap.className = "mc-table-scroll";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });

  const sections: { id: string; text: string }[] = [];
  doc.body.querySelectorAll("h1, h2, h3").forEach((node, index) => {
    const text = (node.textContent || "").trim();
    if (!text || text.length > 90) return;
    const id = `sec-${index}`;
    node.setAttribute("id", id);
    sections.push({ id, text });
  });
  return { html: doc.body.innerHTML, sections: sections.length > 2 ? sections : [] };
};

const PortalContractDoc = () => {
  const { id = "", code = "main" } = useParams();
  const key = decodeURIComponent(code);
  const navigate = useNavigate();
  const { toast } = useToast();
  const p = usePortal();
  const docRef = useRef<HTMLDivElement>(null);

  const [contract, setContract] = useState<PortalContractRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fit, setFit] = useState(true);
  
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const row = await loadMyContract(id);
      setContract(row);
      setName((n) => n || row?.fields?.employee_name || "");
    } catch (err: any) {
      toast({ title: "We could not open this document", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [id, toast]);

  useEffect(() => { if (!p.authLoading) load(); }, [load, p.authLoading]);
  useEffect(() => { window.scrollTo({ top: 0 }); setConsent(false); }, [key]);

  const isMain = key === "main";
  const annex = contract ? visibleAnnexes(contract).find((a) => a.code === key) || null : null;
  const items = contract ? packItems(contract) : [];
  const item = items.find((i) => i.key === key) || null;
  const outstanding = items.filter((i) => i.key !== "main" && !i.done);
  const open = contract?.status === "issued";

  const parsed = useMemo(
    () => withSections(annex?.body || ""),
    [annex?.body],
  );

  const download = async () => {
    if (!docRef.current) return;
    const blob = await contractToPdfBlob(docRef.current);
    downloadBlob(blob, "medic-connect-contract.pdf");
  };

  const doSign = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const row = isMain
        ? await signMyContract(id, name.trim(), "drawn", drawn)
        : await signAnnex(id, key, name.trim(), "drawn", drawn);
      setContract(row);
      toast({
        title: isMain ? "Signed" : `Signed ${key}`,
        description: isMain
          ? "We will approve and countersign it, then email you the finished copy."
          : "That document is done. Next one when you are ready.",
      });
      p.reload();
      navigate(`/portal/offers/contract/${id}`);
    } catch (err: any) {
      toast({ title: "We could not save that", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const doTick = async (value: boolean) => {
    setSaving(true);
    try {
      setContract(await acknowledgeAnnex(id, key, value));
      if (value) navigate(`/portal/offers/contract/${id}`);
    } catch (err: any) {
      toast({ title: "That did not save", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const canSign =
    !!contract && open && consent && !!name.trim() && !!drawn &&
    (!isMain || outstanding.length === 0);

  const title = isMain
    ? "Your contract"
    : annex
      ? `${annex.code}. ${annex.title}`
      : "Document";

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading || loading}
      person={p.person}
      nav={p.nav}
      title={title}
      eyebrow="Your contract pack"
      back={`/portal/offers/contract/${id}`}
      intro={
        isMain
          ? "The letter itself. The documents that come with it are signed on their own screens."
          : annex?.note || undefined
      }
    >
      {!loading && !contract && (
        <CxCard kind="quiet" className="p-5 sm:p-[22px]">
          <p className="text-[15px] leading-relaxed text-body">
            We cannot find this contract on your account. Email hello@medicconnect.co and we will
            send it again.
          </p>
        </CxCard>
      )}

      {contract && (
        <div className="space-y-5">
          {item && (
            <div className="flex flex-wrap items-center gap-3">
              <CxPill tone={item.done ? "settled" : open && item.action !== "read" ? "needs-you" : "quiet"}>
                {item.status}
              </CxPill>
              {isMain && (
                <>
                  <CxButton rank="secondary" onClick={() => setFit((f) => !f)} className="min-h-11 px-4">
                    {fit
                      ? <><Maximize2 className="h-4 w-4" />Full size</>
                      : <><Minimize2 className="h-4 w-4" />Fit to width</>}
                  </CxButton>
                  <CxButton rank="secondary" onClick={download} className="min-h-11 px-4">
                    <Download className="h-4 w-4" />Download
                  </CxButton>
                </>
              )}
            </div>
          )}

          {isMain ? (
            <div
              className={`rounded-[6px] border border-line bg-white ${fit ? "mc-fit p-0" : "overflow-x-auto p-2 sm:p-4"}`}
            >
              <ContractDocument
                ref={docRef}
                fields={contract.fields}
                clauses={contract.clauses}
                annexes={contract.annexes}
                isClinical={contract.is_clinical}
                signedName={contract.signed_name}
                signedAt={contract.signed_at}
                signatureImage={contract.signature_image}
                countersignedName={contract.countersigned_name}
                countersignedAt={contract.countersigned_at}
                countersignatureImage={contract.countersignature_image}
                annexSignatures={contract.annex_signatures}
                annexBodies={false}
                acceptanceBlock={false}
                showPlaceholders={false}
              />
            </div>
          ) : annex ? (
            <div className="lg:flex lg:items-start lg:gap-6">
              {parsed.sections.length > 0 && (
                <nav className="mb-4 hidden w-56 shrink-0 lg:sticky lg:top-6 lg:mb-0 lg:block">
                  <p className="text-[12.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    In this document
                  </p>
                  <ul className="mt-3 space-y-2">
                    {parsed.sections.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="block text-[14px] leading-snug text-body hover:text-navy"
                        >
                          {s.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <CxCard kind="quiet" className="min-w-0 flex-1 p-4 sm:p-6">
                {annex.body
                  ? (
                    <div
                      className="mc-annex-body"
                      dangerouslySetInnerHTML={{ __html: parsed.html }}
                    />
                  )
                  : (
                    <p className="text-[15px] text-body">
                      This document is printed with the contract itself.
                    </p>
                  )}
              </CxCard>
            </div>
          ) : (
            <CxCard kind="quiet" className="p-5">
              <p className="text-[15px] text-body">We cannot find that document in your pack.</p>
            </CxCard>
          )}

          {/* What this document asks for. */}
          {open && item && item.action !== "read" && (
            <CxCard kind="emphasis" className="p-5 sm:p-[22px]">
              <p className="cx-heading flex items-center gap-2 text-[18px] text-ink">
                <PenLine className="h-4 w-4 text-navy" />
                {isMain ? "Sign your contract" : `Sign ${item.code}`}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-body">
                {isMain
                  ? "One signature for the letter. Draw it below and give your full name."
                  : `Signing confirms you have read ${item.code}, ${item.title}, and accept it.`}
              </p>

              {isMain && outstanding.length > 0 && (
                <p className="mt-3 text-[15px] leading-relaxed text-warn-ink">
                  {outstanding.length === 1
                    ? "One document still needs you before the letter can be signed."
                    : `${outstanding.length} documents still need you before the letter can be signed.`}
                </p>
              )}

              <div className="mt-4 space-y-3">
                <Label>Draw your signature</Label>
                <SignaturePad onChange={setDrawn} />
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              </div>

              <label className="mt-5 flex items-start gap-3 text-[15px] leading-relaxed text-body">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <span>
                  By giving my name and ticking this box I confirm that this is my electronic
                  signature and that it has the same effect as a signature in ink.
                </span>
              </label>

              <CxButton full className="mt-5 sm:w-auto" onClick={doSign} disabled={!canSign || saving}>
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4" />}
                {isMain ? "Sign this contract" : `Sign ${item.code}`}
              </CxButton>

              {!isMain && (
                <button
                  type="button"
                  className="mt-3 block text-[14px] font-bold text-brand hover:text-navy"
                  onClick={() => doTick(true)}
                  disabled={saving}
                >
                  Acknowledge without signing
                </button>
              )}
            </CxCard>
          )}

          {(!open || (item && item.done)) && (
            <CxCard kind="quiet" className="p-5 sm:p-[22px]">
              <p className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
                {item?.done
                  ? `${item.status}${item.doneName ? ` by ${item.doneName}` : ""}. A copy is kept on your profile.`
                  : "This document is for reading. Nothing is asked of you here."}
              </p>
            </CxCard>
          )}
        </div>
      )}
    </CxPortalPage>
  );
};

export default PortalContractDoc;
