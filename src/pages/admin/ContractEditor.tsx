// Building a contract.
//
// A three-zone desk: the pack rail on the left lists every document in the
// order the candidate will meet them, the centre canvas is a blog-style
// writing surface for whichever document is open, and the inspector on the
// right holds the facts behind the placeholders, the pre-issue checks and the
// audit trail. Both rails collapse so the wording can take the screen.
//
// Once issued, the wording is frozen and this screen becomes a record rather
// than an editor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowDown, ArrowUp, Ban, CheckCircle2, Copy, Download, Eye, FileSignature, FileStack, Loader2, Mail,
  Plus, Save, Send, Sparkles, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import ContractDocument from "@/components/contracts/ContractDocument";
import ContractRichTextEditor, { ContractRichTextEditorRef } from "@/components/contracts/ContractRichTextEditor";
import ContractPackRail, { PackRailEntry } from "@/components/admin/contracts/ContractPackRail";
import ContractVariableInspector from "@/components/admin/contracts/ContractVariableInspector";
import JSZip from "jszip";
import { blobToBase64, downloadBlob } from "@/lib/contract-pdf";
import { buildContractPack } from "@/lib/contract-pack-pdf";
import { hasBlockingChecks, runContractChecks } from "@/lib/contract-checks";
import { issueAndSendContract } from "@/lib/contract-issue";

import {
  ContractAnnex, ContractClause, ContractEvent, ContractRecord, DEFAULT_ANNEXES,
  countersignContract, effectiveClauses, effectiveFields,
  loadContract, loadContractEvents, personHomeAddress, saveContractDraft, signingLink, uploadAnnexFile, voidContract,
} from "@/lib/contracts";
import { AnnexLibraryItem, ContractTemplate, annexFromLibrary, loadAnnexLibrary, loadTemplates } from "@/lib/contract-templates";
import { openDocumentTab } from "@/lib/documents";

const statusTone = (s: string): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "bad";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued, awaiting signature",
  signed: "Signed",
  active: "Active",
  ended: "Ended",
  withdrawn: "Withdrawn",
};

// Rail collapse choices survive between visits.
const RAIL_LEFT_KEY = "mc-contract-editor-rail-left";
const RAIL_RIGHT_KEY = "mc-contract-editor-rail-right";
const readCollapsed = (key: string) => {
  try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
};
const writeCollapsed = (key: string, collapsed: boolean) => {
  try { window.localStorage.setItem(key, collapsed ? "1" : "0"); } catch { /* private mode */ }
};

const ContractEditor = () => {
  const { id = "" } = useParams();
  const { toast } = useToast();
  const { adminDisplayName } = useAuth();

  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [annexes, setAnnexes] = useState<ContractAnnex[]>(DEFAULT_ANNEXES);
  const [uploadingAnnex, setUploadingAnnex] = useState<string | null>(null);
  const [isClinical, setIsClinical] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countersigning, setCountersigning] = useState(false);
  const [countersignName, setCountersignName] = useState("");
  const [templateDialog, setTemplateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [annexDialog, setAnnexDialog] = useState(false);
  const [annexLibrary, setAnnexLibrary] = useState<AnnexLibraryItem[]>([]);
  const [pickedAnnexIds, setPickedAnnexIds] = useState<string[]>([]);
  // Which document of the pack is on the preview stand: the letter or an annex code.
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);

  // The desk: which document is on the canvas, and how the rails sit.
  const [activeDoc, setActiveDoc] = useState<string>("letter");
  const [railLeftCollapsed, setRailLeftCollapsed] = useState(() => readCollapsed(RAIL_LEFT_KEY));
  const [railRightCollapsed, setRailRightCollapsed] = useState(() => readCollapsed(RAIL_RIGHT_KEY));

  // AI review of the draft wording.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");

  // Placeholder buttons drop their token into whichever editor last had focus.
  const editorRefs = useRef(new Map<string, ContractRichTextEditorRef>());
  const lastEditorKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e, t, lib] = await Promise.all([
        loadContract(id),
        loadContractEvents(id),
        loadTemplates().catch(() => []),
        loadAnnexLibrary().catch(() => []),
      ]);
      setContract(c);
      setEvents(e);
      setTemplates(t);
      setAnnexLibrary(lib);
      const nextFields = effectiveFields(c);
      // If the person has since written their home address into their account,
      // a draft should pick it up on its own rather than wait to be retyped.
      if (c.status === "draft" && !(nextFields.employee_address || "").trim()) {
        const fromProfile = await personHomeAddress(c.person_id).catch(() => "");
        if (fromProfile) nextFields.employee_address = fromProfile;
      }
      setFields(nextFields);
      setClauses(effectiveClauses(c));
      setAnnexes(c.annexes?.length ? c.annexes : DEFAULT_ANNEXES);
      setIsClinical(!!c.is_clinical);
      setCountersignName(c.countersigned_name || adminDisplayName || "");
    } catch (err: any) {
      toast({ title: "Could not open the contract", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }, [id, adminDisplayName, toast]);

  useEffect(() => { load(); }, [load]);

  const editable = contract?.status === "draft";

  // The pre-issue pass: the same rules the tests exercise.
  const checks = useMemo(
    () =>
      runContractChecks({
        fields,
        clauses,
        annexes,
        isClinical,
        startDate: contract?.start_date,
        endDate: contract?.end_date,
        payAmount: contract?.pay_amount,
        payCurrency: contract?.pay_currency,
      }),
    [fields, clauses, annexes, isClinical, contract],
  );
  const blocked = hasBlockingChecks(checks);

  const pullAddress = async () => {
    if (!contract) return;
    setAddressBusy(true);
    try {
      const address = await personHomeAddress(contract.person_id);
      if (!address) {
        toast({
          title: "Nothing on file yet",
          description: "They have not written a home address into their account. Ask them to add it.",
        });
      } else {
        setFields((p) => ({ ...p, employee_address: address }));
        toast({ title: "Address brought across", description: "Save the draft to keep it." });
      }
    } catch (err: any) {
      toast({ title: "Could not read the account", description: err.message, variant: "destructive" });
    }
    setAddressBusy(false);
  };

  const askForAddress = async () => {
    if (!contract) return;
    setAddressBusy(true);
    try {
      const { error } = await supabase.functions.invoke("request-candidate-detail", {
        body: {
          person_id: contract.person_id,
          detail: "home address",
          note: "We need your home address for your contract. Add it under your details and we will pick it up.",
        },
      });
      if (error) throw error;
      toast({ title: "Asked", description: "They have an email with a link to their details." });
    } catch (err: any) {
      toast({ title: "Could not send the request", description: err.message, variant: "destructive" });
    }
    setAddressBusy(false);
  };

  const addAnnexesFromLibrary = () => {
    const picked = annexLibrary.filter((item) => pickedAnnexIds.includes(item.id));
    if (!picked.length) return;
    setAnnexes((p) => [...p, ...picked.map(annexFromLibrary)]);
    setPickedAnnexIds([]);
    setAnnexDialog(false);
    toast({
      title: picked.length === 1 ? "Annex added" : `${picked.length} annexes added`,
      description: "The wording came across from the library and can be edited here.",
    });
  };

  const addBlankAnnex = () => {
    const next = { code: `Annex ${String.fromCharCode(65 + annexes.length)}`, title: "New annex", include: true };
    setAnnexes((p) => [...p, next]);
    setAnnexDialog(false);
    setActiveDoc(`annex-${annexes.length}`);
  };

  const save = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      await saveContractDraft(contract.id, {
        fields,
        clauses,
        annexes,
        is_clinical: isClinical,
        job_title: fields.job_title || contract.job_title,
        notice_period: fields.notice_period || contract.notice_period,
        location: fields.primary_place_of_work || contract.location,
        actor_name: adminDisplayName,
      });
      toast({ title: "Saved" });
      load();
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const issue = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      await saveContractDraft(contract.id, { fields, clauses, annexes, is_clinical: isClinical, actor_name: adminDisplayName });
      const result = await issueAndSendContract(contract.id, adminDisplayName);
      try {
        await navigator.clipboard?.writeText(signingLink(result.token));
      } catch {
        /* a blocked clipboard must never look like a failed issue */
      }
      toast(
        result.emailed
          ? { title: "Issued", description: "The wording is frozen, the signing link has been emailed and copied to your clipboard." }
          : { title: "Issued, but the email did not send", description: `${result.emailError ?? "Unknown error"}. The link is on your clipboard; use Chase to resend.`, variant: "destructive" },
      );
      load();
    } catch (err: any) {
      toast({ title: "Could not issue", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // Countersigning is the moment the contract becomes real: it is approved,
  // signed on behalf of the company, then every document in the pack is turned
  // into its own PDF, emailed and filed on the person's profile.
  const countersign = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      await countersignContract(contract.id, countersignName.trim());
      setCountersigning(false);
      const [fresh, freshEvents] = await Promise.all([
        loadContract(contract.id),
        loadContractEvents(contract.id).catch(() => events),
      ]);
      setContract(fresh);
      setEvents(freshEvents);

      const pack = await buildPack(fresh, freshEvents);
      const documents = await Promise.all(
        pack.map(async (item) => ({
          filename: item.filename,
          label: item.label,
          code: item.code,
          doc_type: "Contract",
          pdf_base64: await blobToBase64(item.blob),
        })),
      );
      const { error } = await supabase.functions.invoke("send-contract-email", {
        body: { contract_id: contract.id, kind: "signed", documents },
      });
      if (error) throw error;

      toast({
        title: "Countersigned",
        description: `${documents.length} signed ${documents.length === 1 ? "document has" : "documents have"} been emailed and filed on the profile.`,
      });
      load();
    } catch (err: any) {
      toast({ title: "Could not countersign", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const withdraw = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      await voidContract(contract.id, "Withdrawn by an administrator", adminDisplayName);
      toast({ title: "Withdrawn" });
      load();
    } catch (err: any) {
      toast({ title: "Could not withdraw", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  /** Build a PDF for every document in the pack, from the saved contract. */
  const buildPack = async (record: ContractRecord, log: ContractEvent[] = events) => {
    const signEvent = log.find((e) => e.event_type === "signed") || null;
    return buildContractPack({
      fields: effectiveFields(record),
      clauses: effectiveClauses(record),
      annexes: record.annexes?.length ? record.annexes : DEFAULT_ANNEXES,
      isClinical: !!record.is_clinical,
      signedName: record.signed_name,
      signedAt: record.signed_at,
      signatureImage: record.signature_image,
      countersignedName: record.countersigned_name,
      countersignedAt: record.countersigned_at,
      countersignatureImage: record.countersignature_image,
      annexSignatures: record.annex_signatures,
      annexAcknowledgements: record.annex_acknowledgements,
      evidence: {
        reference: record.id,
        fingerprint: record.issued_hash,
        ip: signEvent?.ip ?? null,
        userAgent: signEvent?.user_agent ?? null,
      },
    });
  };

  // The same set the person receives, kept together in one zip.
  const download = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      const pack = await buildPack(contract);
      if (pack.length === 1) {
        downloadBlob(pack[0].blob, pack[0].filename);
      } else {
        const zip = new JSZip();
        pack.forEach((item) => zip.file(item.filename, item.blob));
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(
          blob,
          `contract-pack-${(fields.employee_name || "medic-connect").replace(/\s+/g, "-").toLowerCase()}.zip`,
        );
      }
    } catch (err: any) {
      toast({ title: "Could not build the pack", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // A second pair of eyes on the wording before it freezes.
  const runReview = async () => {
    if (!contract) return;
    setReviewLoading(true);
    setReviewOpen(true);
    setReviewText("");
    try {
      // Save first so the review reads exactly what would be issued.
      await saveContractDraft(contract.id, { fields, clauses, annexes, is_clinical: isClinical, actor_name: adminDisplayName });
      const { data, error } = await supabase.functions.invoke("contract-review", {
        body: { contract_id: contract.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReviewText(data?.review || "No comments came back.");
    } catch (err: any) {
      setReviewOpen(false);
      toast({ title: "Could not review the draft", description: err.message, variant: "destructive" });
    }
    setReviewLoading(false);
  };

  const moveClause = (index: number, delta: number) => {
    setClauses((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const patchClause = (index: number, patch: Partial<ContractClause>) =>
    setClauses((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const patchAnnex = (index: number, patch: Partial<ContractAnnex>) =>
    setAnnexes((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const applyTemplate = async () => {
    if (!contract || !selectedTemplateId) return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    const nextFields = { ...(template.fields || {}) };
    Object.entries(fields).forEach(([key, value]) => {
      if ((value || "").trim()) nextFields[key] = value;
    });
    if (!nextFields.job_title && template.job_title) nextFields.job_title = template.job_title;

    const nextClauses = template.clauses || [];
    const nextAnnexes = template.annexes?.length ? template.annexes : DEFAULT_ANNEXES;
    const nextClinical = template.is_clinical;

    setBusy(true);
    try {
      await saveContractDraft(contract.id, {
        fields: nextFields,
        clauses: nextClauses,
        annexes: nextAnnexes,
        is_clinical: nextClinical,
        job_title: nextFields.job_title || template.job_title || contract.job_title,
        notice_period: nextFields.notice_period || contract.notice_period,
        location: nextFields.primary_place_of_work || contract.location,
        actor_name: adminDisplayName,
        change_note: `Template applied: ${template.name}`,
      });
      setFields(nextFields);
      setClauses(nextClauses);
      setAnnexes(nextAnnexes);
      setIsClinical(nextClinical);
      setTemplateDialog(false);
      toast({ title: "Template applied", description: "The clauses and annex wording are now in this draft." });
      load();
    } catch (err: any) {
      toast({ title: "Could not apply the template", description: err.message, variant: "destructive" });
    }
    setBusy(false);
  };

  // ---- The desk -------------------------------------------------------------

  const toggleRailLeft = () => {
    setRailLeftCollapsed((p) => { writeCollapsed(RAIL_LEFT_KEY, !p); return !p; });
  };
  const toggleRailRight = () => {
    setRailRightCollapsed((p) => { writeCollapsed(RAIL_RIGHT_KEY, !p); return !p; });
  };

  // One rail entry per document in the pack, in candidate reading order.
  const railEntries: PackRailEntry[] = useMemo(() => {
    const signedLetter = contract?.signed_at;
    const entries: PackRailEntry[] = [
      {
        key: "letter",
        code: null,
        title: "Offer letter",
        included: true,
        requiresSignature: true,
        done: !!signedLetter,
        status: signedLetter
          ? "Signed"
          : contract?.status === "issued"
            ? "Waiting for their signature"
            : "Being drafted",
      },
    ];
    annexes.forEach((a, i) => {
      const sig = contract?.annex_signatures?.[a.code];
      const ack = contract?.annex_acknowledgements?.[a.code];
      entries.push({
        key: `annex-${i}`,
        code: a.code,
        title: a.title,
        included: a.include !== false && (!a.clinical_only || isClinical),
        requiresSignature: !!a.requires_signature,
        done: !!(sig || ack),
        status: sig
          ? "Signed"
          : ack
            ? "Acknowledged"
            : a.requires_signature
              ? "They sign this one"
              : "Read only",
      });
    });
    return entries;
  }, [annexes, contract, isClinical]);

  const activeAnnexIndex = activeDoc.startsWith("annex-") ? Number(activeDoc.slice(6)) : null;
  const activeAnnex = activeAnnexIndex != null ? annexes[activeAnnexIndex] : null;

  // A check's area jumps the editor to where the fix lives.
  const jumpTo = (area: string) => {
    if (area === "details") {
      setRailRightCollapsed(false);
      return;
    }
    if (area === "letter" || area.startsWith("clause:")) {
      setActiveDoc("letter");
      if (area.startsWith("clause:")) {
        const key = area.slice(7);
        window.setTimeout(() => {
          document.getElementById(`clause-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
      }
      return;
    }
    if (area.startsWith("annex:")) {
      const code = area.slice(6);
      const index = annexes.findIndex((a) => a.code === code);
      if (index >= 0) setActiveDoc(`annex-${index}`);
    }
  };

  const insertToken = (token: string) => {
    const ref = lastEditorKey.current ? editorRefs.current.get(lastEditorKey.current) : null;
    if (!ref) {
      toast({ title: "Click into a document first", description: "Then the placeholder lands where the cursor is." });
      return;
    }
    ref.insertText(token);
    ref.focus();
  };

  const editorRefFor = (key: string) => (ref: ContractRichTextEditorRef | null) => {
    if (ref) editorRefs.current.set(key, ref);
    else editorRefs.current.delete(key);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!contract) {
    return (
      <MuPage>
        <MuPageHeader title="Contract" />
        <MuSection><MuEmpty title="This contract could not be found" /></MuSection>
      </MuPage>
    );
  }

  return (
    <MuPage>
      <MuPageHeader
        title={fields.employee_name ? `Contract, ${fields.employee_name}` : "Contract"}
        description="Pick a document on the left, write in the middle, mind the checks on the right."
        backTo={`/admin/workforce/${contract.person_id}`}
        backLabel="Back to the staff record"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MuStatus label={STATUS_LABELS[contract.status] || contract.status} tone={statusTone(contract.status)} />
            <Button variant="outline" size="sm" onClick={() => setPreviewDoc("letter")}>
              <Eye className="mr-2 h-4 w-4" />Preview
            </Button>
            <Button variant="outline" size="sm" onClick={download}>
              <Download className="mr-2 h-4 w-4" />PDF
            </Button>
            {contract.sign_token && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(signingLink(contract.sign_token!));
                  toast({ title: "Signing link copied" });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />Signing link
              </Button>
            )}
            {editable && (
              <Button variant="outline" size="sm" onClick={runReview} disabled={reviewLoading}>
                {reviewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                AI review
              </Button>
            )}
            {editable && (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save draft
              </Button>
            )}
            {editable && (
              <Button
                size="sm"
                onClick={issue}
                disabled={busy || blocked}
                title={blocked ? "Resolve the errors on the right before issuing" : undefined}
              >
                <Send className="mr-2 h-4 w-4" />Issue for signature
              </Button>
            )}
            {contract.status === "issued" && (
              <Button variant="outline" size="sm" onClick={() =>
                supabase.functions
                  .invoke("send-contract-email", { body: { contract_id: contract.id, kind: "issue" } })
                  .then(() => toast({ title: "Reminder sent" }))
              }>
                <Mail className="mr-2 h-4 w-4" />Chase
              </Button>
            )}
            {contract.status === "signed" && (
              <Button size="sm" onClick={() => setCountersigning(true)}>
                <FileSignature className="mr-2 h-4 w-4" />Countersign
              </Button>
            )}
            {["draft", "issued"].includes(contract.status) && (
              <ConfirmAction
                title="Withdraw this contract?"
                description={<p>The contract is voided and can no longer be signed. To offer terms again, draft a new one.</p>}
                confirmLabel="Withdraw contract"
                destructive
                onConfirm={withdraw}
                trigger={
                  <Button variant="outline" size="sm" disabled={busy}>
                    <Ban className="mr-2 h-4 w-4" />Withdraw
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      <div className="flex items-start gap-4">
        <ContractPackRail
          entries={railEntries}
          activeKey={activeDoc}
          onSelect={setActiveDoc}
          collapsed={railLeftCollapsed}
          onToggleCollapsed={toggleRailLeft}
          editable={editable}
          onAddAnnex={() => { setPickedAnnexIds([]); setAnnexDialog(true); }}
          onUseTemplate={() => setTemplateDialog(true)}
          templateCount={templates.length}
        />

        {/* The canvas: one document at a time, written like a page. */}
        <main className="min-w-0 flex-1">
          {!editable ? (
            // Frozen wording: the record of exactly what was signed.
            <div className="overflow-x-auto rounded-3xl bg-muted p-4">
              <ContractDocument
                fields={fields}
                clauses={clauses}
                annexes={annexes}
                isClinical={isClinical}
                signedName={contract.signed_name}
                signedAt={contract.signed_at}
                signatureImage={contract.signature_image}
                countersignedName={contract.countersigned_name}
                countersignedAt={contract.countersigned_at}
                countersignatureImage={contract.countersignature_image}
                annexSignatures={contract.annex_signatures}
                annexAcknowledgements={contract.annex_acknowledgements}
                only={activeDoc === "letter" ? "letter" : activeAnnex?.code}
                acceptanceBlock={activeDoc === "letter"}
              />
            </div>
          ) : activeDoc === "letter" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">Offer letter</h2>
                  <p className="text-xs text-muted-foreground">
                    The main clauses. Variables in double braces are filled from the details on the right.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setClauses((p) => [
                        ...p,
                        { key: `custom_${Date.now()}`, heading: "New clause", body: "<p></p>", section: "main" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />Add a clause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setClauses((p) => [
                        ...p,
                        { key: `extra_${Date.now()}`, heading: "New additional term", body: "<p></p>", section: "additional" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />Add an additional term
                  </Button>
                </div>
              </div>

              {clauses.map((c, i) => (
                <section
                  key={c.key}
                  id={`clause-${c.key}`}
                  className="scroll-mt-24 rounded-2xl border border-border/60 bg-background p-4"
                  onFocusCapture={() => { lastEditorKey.current = `clause-${c.key}`; }}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-9 text-sm font-semibold"
                      value={c.heading}
                      onChange={(e) => patchClause(i, { heading: e.target.value })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => moveClause(i, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveClause(i, 1)} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setClauses((p) => p.filter((_, xi) => xi !== i))}
                      aria-label="Remove clause"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ContractRichTextEditor
                    ref={editorRefFor(`clause-${c.key}`)}
                    className="mt-3"
                    minHeight={200}
                    large
                    bubbleMenu
                    value={c.body}
                    onChange={(html) => patchClause(i, { body: html })}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {c.section === "additional" ? "Additional terms" : `Clause ${i + 1}`}.
                  </p>
                </section>
              ))}
            </div>
          ) : activeAnnex && activeAnnexIndex != null ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">{activeAnnex.code}: {activeAnnex.title}</h2>
                <p className="text-xs text-muted-foreground">
                  One annex on the stand at a time. Settings above, wording below.
                </p>
              </div>

              <section className="space-y-3 rounded-2xl border border-border/60 bg-background p-4">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 w-28 text-sm font-medium"
                    value={activeAnnex.code}
                    onChange={(e) => patchAnnex(activeAnnexIndex, { code: e.target.value })}
                  />
                  <Input
                    className="h-8 text-sm"
                    value={activeAnnex.title}
                    onChange={(e) => patchAnnex(activeAnnexIndex, { title: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setAnnexes((p) => p.filter((_, xi) => xi !== activeAnnexIndex));
                      setActiveDoc("letter");
                    }}
                    aria-label="Remove annex"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Input
                  className="h-8 text-sm"
                  placeholder="A line of explanation, printed under the title"
                  value={activeAnnex.note || ""}
                  onChange={(e) => patchAnnex(activeAnnexIndex, { note: e.target.value })}
                />

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={activeAnnex.include !== false}
                      onCheckedChange={(v) => patchAnnex(activeAnnexIndex, { include: v })}
                    />
                    Issued with this contract
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={!!activeAnnex.requires_signature}
                      onCheckedChange={(v) => patchAnnex(activeAnnexIndex, { requires_signature: v })}
                    />
                    They sign this one
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={!!activeAnnex.clinical_only}
                      onCheckedChange={(v) => patchAnnex(activeAnnexIndex, { clinical_only: v })}
                    />
                    Clinical roles only
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeAnnex.attachment_path ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openDocumentTab(activeAnnex.attachment_path!)}>
                        <Download className="mr-2 h-4 w-4" />
                        {activeAnnex.attachment_name || "Open the attachment"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          patchAnnex(activeAnnexIndex, { attachment_path: undefined, attachment_name: undefined })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      {uploadingAnnex === activeAnnex.code ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Attach the document
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingAnnex(activeAnnex.code);
                          try {
                            const up = await uploadAnnexFile(contract.id, file);
                            patchAnnex(activeAnnexIndex, { attachment_path: up.path, attachment_name: up.name });
                            toast({ title: "Attached", description: "Save the draft to keep it." });
                          } catch (err: any) {
                            toast({ title: "Could not attach that file", description: err.message, variant: "destructive" });
                          }
                          setUploadingAnnex(null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </section>

              <section
                className="rounded-2xl border border-border/60 bg-background p-4"
                onFocusCapture={() => { lastEditorKey.current = `annex-${activeAnnexIndex}`; }}
              >
                <Label className="text-xs">Wording printed inside the contract pack</Label>
                <ContractRichTextEditor
                  ref={editorRefFor(`annex-${activeAnnexIndex}`)}
                  className="mt-2"
                  minHeight={320}
                  large
                  bubbleMenu
                  stickyToolbar
                  value={activeAnnex.body || ""}
                  placeholder="Write the annex document here, for example a job description or extra policy wording."
                  onChange={(html) => patchAnnex(activeAnnexIndex, { body: html })}
                />
              </section>
            </div>
          ) : null}

          {/* Clinical scope lives on the letter, so the toggle lives with it. */}
          {editable && activeDoc === "letter" && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-background p-4">
              <div>
                <p className="text-sm font-medium">Clinical role</p>
                <p className="text-xs text-muted-foreground">Adds Annex F, scope of practice.</p>
              </div>
              <Switch checked={isClinical} onCheckedChange={setIsClinical} />
            </div>
          )}
        </main>

        <ContractVariableInspector
          collapsed={railRightCollapsed}
          onToggleCollapsed={toggleRailRight}
          editable={editable}
          fields={fields}
          onFieldChange={(key, value) => setFields((p) => ({ ...p, [key]: value }))}
          checks={checks}
          onJumpTo={jumpTo}
          onInsertToken={insertToken}
          onPullAddress={pullAddress}
          onAskForAddress={askForAddress}
          addressBusy={addressBusy}
          events={events}
          issuedHash={contract.issued_hash}
        />
      </div>

      {/* Read-only preview: the same component the candidate reads and the PDF
          is printed from, one document at a time, with gaps still marked. */}
      <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>
              Exactly as the person will read it. Unfilled variables are highlighted.
            </DialogDescription>
          </DialogHeader>
          <Select value={previewDoc ?? "letter"} onValueChange={setPreviewDoc}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a document" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letter">Offer letter</SelectItem>
              {annexes.filter((a) => a.include).map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code}: {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3 sm:p-6">
            {previewDoc && contract && (
              <ContractDocument
                fields={fields as any}
                clauses={clauses}
                annexes={annexes}
                isClinical={isClinical}
                signedName={contract.signed_name}
                signedAt={contract.signed_at}
                signatureImage={contract.signature_image}
                countersignedName={contract.countersigned_name}
                countersignedAt={contract.countersigned_at}
                countersignatureImage={contract.countersignature_image}
                annexSignatures={contract.annex_signatures}
                annexAcknowledgements={contract.annex_acknowledgements}
                only={previewDoc}
                acceptanceBlock={previewDoc === "letter"}
                showPlaceholders
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* A second pair of eyes: the reviewer's comments on the saved draft. */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="flex max-h-[85vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>A second read of the wording</DialogTitle>
            <DialogDescription>
              Comments on the draft as saved: gaps, wording that reads oddly, and terms worth a second look. It advises; you decide.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-4">
            {reviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Reading the draft…
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{reviewText}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={annexDialog} onOpenChange={setAnnexDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an annex</DialogTitle>
            <DialogDescription>
              Take one from the annex library, wording and all, or start a blank one and write it here.
            </DialogDescription>
          </DialogHeader>
          {annexLibrary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The annex library is empty, so there is nothing to pick from yet. Start a blank annex instead.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {annexLibrary.map((item) => {
                const picked = pickedAnnexIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-xl border p-3 text-left transition ${picked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}
                    onClick={() =>
                      setPickedAnnexIds((p) => (picked ? p.filter((x) => x !== item.id) : [...p, item.id]))
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.code} · {item.title}</span>
                      {picked && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        item.kind === "file" ? "Attached file" : "Written document",
                        item.requires_signature ? "Signed by the person" : "Read only",
                        item.clinical_only ? "Clinical roles only" : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={addBlankAnnex}>
              <Plus className="mr-2 h-4 w-4" />Start a blank annex
            </Button>
            <Button onClick={addAnnexesFromLibrary} disabled={pickedAnnexIds.length === 0}>
              <FileStack className="mr-2 h-4 w-4" />
              {pickedAnnexIds.length > 1 ? `Add ${pickedAnnexIds.length} annexes` : "Add from library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use a contract template</DialogTitle>
            <DialogDescription>
              This replaces this draft's clauses and annex pack with the selected template. Existing candidate details stay filled in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button onClick={applyTemplate} disabled={busy || !selectedTemplateId}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileStack className="mr-2 h-4 w-4" />}
              Apply template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={countersigning} onOpenChange={setCountersigning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Countersign for Medic Connect Limited</DialogTitle>
            <DialogDescription>
              Your name and position are printed on the contract and recorded in the trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name and position</Label>
            <Input value={countersignName} onChange={(e) => setCountersignName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountersigning(false)}>Cancel</Button>
            <Button onClick={countersign} disabled={busy || !countersignName.trim()}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Countersign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default ContractEditor;
