// The document ledger for one person.
//
// One list, read top to bottom in the order the work happens: what needs a
// decision now, what we are still waiting for, and what is settled. The row is
// the control. Tapping a row opens the record in the right hand panel, where
// the whole document is read and accepted or returned in one place.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle, Check, Clock, ExternalLink, FileText, Loader2, Mail, ShieldCheck,
  Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPES, DOC_TYPE_LABELS, docTypeLabel } from "@/lib/match-universe";
import {
  DocumentRequirement, STATUS_HELP, STATUS_LABELS, loadRequirements, openDocumentTab,
} from "@/lib/documents";
import { DocumentRequest, loadDocumentRequests } from "@/components/DocumentRequestList";
import DocumentReadout from "@/components/admin/DocumentReadout";
import {
  MuEmpty, MuGroupHead, MuLedger, MuLedgerBody, MuLedgerRow, MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import { MuDetailFacts, MuDetailSheet } from "@/components/admin/mu/MuDetailSheet";

/** One colour vocabulary for document state, shared with the review queue. */
const docTone = (s: string): MuTone =>
  s === "accepted" ? "good" : s === "conditional" ? "warning" : s === "pending" ? "info" : s === "missing" ? "neutral" : "bad";

/** Where a document came from, said once, in words rather than a table name. */
const sourceLine = (d: { source_table: string; uploaded_by_name: string | null }) =>
  d.source_table === "admin_upload"
    ? `Filed by ${d.uploaded_by_name || "an admin"}`
    : d.source_table === "candidate_portal"
      ? "Uploaded by the candidate"
      : "Came in with their application";

interface HeldDoc {
  id: string;
  label: string;
  url: string;
  doc_type: string | null;
  source_table: string;
  source_note: string | null;
  uploaded_by_name: string | null;
  review_outcome: string;
  review_reason: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  superseded_at: string | null;

  created_at: string;
}

/** What the panel is showing in the right hand sheet. */
type Selection =
  | { kind: "document"; doc: HeldDoc; requirement?: DocumentRequirement }
  | { kind: "requirement"; requirement: DocumentRequirement; request?: DocumentRequest };

interface Props {
  personId: string;
  personName: string;
  onChanged?: () => void;
}

const day = (v?: string | null) => (v ? format(new Date(v), "d MMM yyyy") : null);

const DocumentsPanel = ({ personId, personName, onChanged }: Props) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [reqs, setReqs] = useState<DocumentRequirement[]>([]);
  const [held, setHeld] = useState<HeldDoc[]>([]);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [selected, setSelected] = useState<Selection | null>(null);
  const [returning, setReturning] = useState(false);

  // Correcting a document that was filed under the wrong kind, most often
  // "Other" when it is in fact an identity document or a licence.
  const [reclassing, setReclassing] = useState(false);
  const [newType, setNewType] = useState<string>("Other");
  const [reclassNote, setReclassNote] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);

  // Upload on behalf of the candidate
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("CV");
  const [sourceNote, setSourceNote] = useState("");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Ask the candidate for what is missing
  const [requestOpen, setRequestOpen] = useState(false);
  const [ask, setAsk] = useState<string[]>([]);
  const [requestNote, setRequestNote] = useState("");
  const [dueBy, setDueBy] = useState("");
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    const [rows, { data }, reqRows] = await Promise.all([
      loadRequirements(personId),
      adminDb()
        .from("mu_documents")
        .select("id, label, url, doc_type, source_table, source_note, uploaded_by_name, review_outcome, review_reason, reviewed_at, expires_at, superseded_at, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false }),
      loadDocumentRequests(personId),
    ]);
    setReqs(rows);
    setHeld((data ?? []) as unknown as HeldDoc[]);
    setRequests(reqRows);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const open = async (url: string) => {
    const ok = await openDocumentTab(url);
    if (!ok) toast({ title: "Could not open the file", variant: "destructive" });
  };

  const doUpload = async () => {
    if (!file) { toast({ title: "Choose a file first" }); return; }
    if (!sourceNote.trim()) {
      toast({ title: "Say where this came from", description: "The trail needs to show how we received it." });
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `admin-upload/${personId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("applications").upload(path, file, { upsert: false });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error } = await (adminDb() as any).rpc("mu_admin_upload_document", {
      _person_id: personId,
      _label: `${uploadType} — ${file.name}`,
      _url: path,
      _doc_type: uploadType,
      _source_note: sourceNote.trim(),
      _expires_at: expiry || null,
    });
    setUploading(false);
    if (error) {
      toast({ title: "Could not file the document", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document filed", description: `Uploaded for ${personName} and logged on the trail.` });
    setUploadOpen(false);
    setFile(null);
    setSourceNote("");
    setExpiry("");
    if (fileRef.current) fileRef.current.value = "";
    load();
    onChanged?.();
  };

  const review = async (doc: HeldDoc, outcome: "accepted" | "rejected", why = "", tellThem = true) => {
    setBusy(doc.id);
    const { error } = await (adminDb() as any).rpc("mu_review_document", {
      _document_id: doc.id,
      _outcome: outcome,
      _reason: why || null,
      _expires_at: doc.expires_at || null,
    });
    if (error) {
      setBusy(null);
      toast({ title: "Could not record the review", description: error.message, variant: "destructive" });
      return;
    }
    // A candidate is written to only when something is needed of them. An
    // acceptance asks nothing, so it sends no email.
    const emailed = outcome === "rejected" && tellThem;
    if (emailed) {
      const { error: mailErr } = await supabase.functions.invoke("notify-candidate-document", {
        body: { document_id: doc.id },
      });
      if (mailErr) {
        toast({ title: "Reviewed, but the email did not send", description: mailErr.message, variant: "destructive" });
      }
    }
    setBusy(null);
    toast({
      title: outcome === "accepted" ? "Document accepted" : "Document returned",
      description: emailed ? `${personName} has been emailed.` : "No email was sent.",
    });
    setSelected(null);
    setReturning(false);
    setReason("");
    load();
    onChanged?.();
  };

  /** Retire a document that a newer copy replaces. It stays on file, out of the queue. */
  /** Put a wrongly filed document under the right kind. The trail keeps both. */
  const reclassify = async (doc: HeldDoc) => {
    if (newType === doc.doc_type) { setReclassing(false); return; }
    setBusy(doc.id);
    const { error } = await (adminDb() as any).rpc("mu_reclassify_document", {
      _document_id: doc.id,
      _doc_type: newType,
      _reason: reclassNote.trim() || null,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Could not change the kind", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Kind corrected",
      description: `Filed as ${docTypeLabel(newType)} instead of ${docTypeLabel(doc.doc_type)}. The change is on the trail.`,
    });
    setReclassing(false);
    setReclassNote("");
    setSelected(null);
    load();
    onChanged?.();
  };

  const supersede = async (doc: HeldDoc) => {
    setBusy(doc.id);
    const { error } = await (adminDb() as any)
      .from("mu_documents")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", doc.id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not supersede that document", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document superseded", description: "It stays on file and leaves the review queue." });
    setSelected(null);
    load();
    onChanged?.();
  };


  const cancelRequest = async (id: string) => {
    setBusy(id);
    const { error } = await (adminDb() as any).rpc("mu_cancel_document_request", { _id: id });
    setBusy(null);
    if (error) {
      toast({ title: "Could not cancel the request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request cancelled" });
    setSelected(null);
    load();
    onChanged?.();
  };

  const sendRequest = async () => {
    setRequesting(true);
    // Record the ask first. The email is a courtesy; the request is the record,
    // and it is what the candidate's own portal reads.
    const { error: recordErr } = await (adminDb() as any).rpc("mu_request_documents", {
      _person_id: personId,
      _doc_types: ask,
      _note: requestNote.trim() || null,
      _due_by: dueBy || null,
    });
    if (recordErr) {
      setRequesting(false);
      toast({ title: "Could not record the request", description: recordErr.message, variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("request-candidate-documents", {
      body: { person_id: personId, doc_types: ask, note: requestNote.trim() || undefined, due_by: dueBy || undefined },
    });
    setRequesting(false);
    const failure = error?.message || (data as any)?.error;
    const count = ask.length;
    setRequestOpen(false);
    setRequestNote("");
    setDueBy("");
    setAsk([]);
    setSelected(null);
    load();
    onChanged?.();
    if (failure) {
      toast({
        title: "Logged, but the email did not send",
        description: `${failure}. It still shows on their profile as outstanding.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Request sent",
      description: `${personName} has been asked for ${count} document${count === 1 ? "" : "s"}.`,
    });
  };

  const askFor = (docTypes: string[]) => {
    setAsk(docTypes);
    setRequestNote("");
    setDueBy("");
    setRequestOpen(true);
  };

  const openRequests = useMemo(() => requests.filter((r) => r.status === "open"), [requests]);
  const requestFor = useCallback(
    (docType: string) => openRequests.find((r) => r.doc_type === docType),
    [openRequests],
  );

  const reqFor = useCallback(
    (doc: HeldDoc) => reqs.find((r) => r.document_id === doc.id),
    [reqs],
  );

  // Four groups, in the order the work happens. A superseded document is
  // history: it is read, never decided on again.
  const awaiting = useMemo(
    () => held.filter((d) => !d.superseded_at && d.review_outcome !== "accepted" && d.review_outcome !== "rejected"),
    [held],
  );
  const outstanding = useMemo(
    () => reqs.filter((r) => r.status === "missing" || r.status === "rejected" || r.status === "expired"),
    [reqs],
  );
  const settled = useMemo(
    () => held.filter((d) => !d.superseded_at && (d.review_outcome === "accepted" || d.review_outcome === "rejected")),
    [held],
  );
  const superseded = useMemo(() => held.filter((d) => !!d.superseded_at), [held]);


  const requiredOpen = reqs.filter((r) => r.required && r.status !== "accepted");

  const headline = requiredOpen.length === 0
    ? "Every document required for this profession has been accepted."
    : requiredOpen.length === 1
      ? "One required document is still outstanding."
      : `${requiredOpen.length} required documents are still outstanding.`;

  if (loading)
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const selectedDoc = selected?.kind === "document" ? selected.doc : null;
  const selectedReq = selected?.kind === "requirement" ? selected.requirement : null;

  return (
    <div className="space-y-4">
      {/* One sentence of standing, then the only two things an admin can start. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-card px-5 py-3.5">
        <MuStatus
          icon={requiredOpen.length === 0 ? ShieldCheck : AlertTriangle}
          tone={requiredOpen.length === 0 ? "good" : "warning"}
          label={headline}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-none"
            onClick={() => askFor(requiredOpen.map((r) => r.doc_type))}
          >
            <Mail className="mr-2 h-4 w-4" />Request documents
          </Button>
          <Button size="sm" className="rounded-none" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />Upload on their behalf
          </Button>
        </div>
      </div>

      {/* 1. Anything a person is waiting on us for. */}
      {awaiting.length > 0 && (
        <MuLedger className="border-warn-line/40">
          <MuGroupHead
            tone="attention"
            label="Requires a decision"
            sentence={
              awaiting.length === 1
                ? "One document has been received and is waiting to be accepted or returned."
                : `${awaiting.length} documents have been received and are waiting to be accepted or returned.`
            }
          />
          <MuLedgerBody>
            {awaiting.map((d) => (
              <MuLedgerRow
                key={d.id}
                icon={FileText}
                tone="attention"
                title={d.label}
                sentence={`${docTypeLabel(d.doc_type)}. ${sourceLine(d)}.`}
                meta={`Received ${day(d.created_at)}`}
                status={<MuStatus label="Awaiting review" tone="info" />}
                onOpen={() => { setSelected({ kind: "document", doc: d, requirement: reqFor(d) }); setReturning(false); setReason(""); setNotify(true); }}
              />
            ))}
          </MuLedgerBody>
        </MuLedger>
      )}

      {/* 2. What we are still waiting on them for, with the ask folded in. */}
      <MuLedger>
        <MuGroupHead
          label="Still to come"
          sentence={
            outstanding.length === 0
              ? "Nothing further is expected from this candidate."
              : "Documents this profession requires that we do not hold in an accepted state."
          }
        />
        {outstanding.length === 0 ? (
          <MuEmpty
            icon={ShieldCheck}
            title="Nothing outstanding"
            description="Every document expected for this profession has been received and accepted."
          />
        ) : (
          <MuLedgerBody>
            {outstanding.map((r) => {
              const asked = requestFor(r.doc_type);
              return (
                <MuLedgerRow
                  key={r.doc_type}
                  icon={asked ? Clock : FileText}
                  title={r.label}
                  sentence={STATUS_HELP[r.status]}
                  meta={
                    asked
                      ? `Asked ${day(asked.created_at)}${asked.requested_by_name ? ` by ${asked.requested_by_name}` : ""}${asked.due_by ? `, due ${day(asked.due_by)}` : ""}`
                      : "The candidate has not been asked for this yet."
                  }
                  status={
                    <>
                      {!r.required && <MuStatus label="Optional here" tone="neutral" />}
                      <MuStatus label={STATUS_LABELS[r.status]} tone={docTone(r.status)} />
                    </>
                  }
                  onOpen={() => setSelected({ kind: "requirement", requirement: r, request: asked })}
                />
              );
            })}
          </MuLedgerBody>
        )}
      </MuLedger>

      {/* 3. The settled record. */}
      <MuLedger>
        <MuGroupHead
          label="On file"
          sentence={
            settled.length === 0
              ? "No document has been decided on yet."
              : "Every document that has been accepted or returned, newest first."
          }
        />
        {settled.length === 0 ? (
          <MuEmpty icon={FileText} title="No decisions recorded" />
        ) : (
          <MuLedgerBody>
            {settled.map((d) => (
              <MuLedgerRow
                key={d.id}
                icon={FileText}
                tone={d.review_outcome === "accepted" ? "good" : "neutral"}
                title={d.label}
                sentence={`${docTypeLabel(d.doc_type)}. ${sourceLine(d)}.`}
                meta={
                  d.review_outcome === "accepted"
                    ? `Accepted ${day(d.reviewed_at) ?? "on an unrecorded date"}${d.expires_at ? `, expires ${day(d.expires_at)}` : ""}`
                    : `Returned ${day(d.reviewed_at) ?? "on an unrecorded date"}`
                }
                status={
                  <MuStatus
                    tone={d.review_outcome === "accepted" ? "good" : "bad"}
                    label={d.review_outcome === "accepted" ? "Accepted" : "Returned"}
                  />
                }
                onOpen={() => { setSelected({ kind: "document", doc: d, requirement: reqFor(d) }); setReturning(false); setReason(""); setNotify(true); }}
              />
            ))}
          </MuLedgerBody>
        )}
      </MuLedger>

      {/* 4. Replaced by a newer copy. Kept for the trail, out of the work. */}
      {superseded.length > 0 && (
        <MuLedger>
          <MuGroupHead
            label="Superseded"
            sentence={
              superseded.length === 1
                ? "One document has been replaced by a newer copy and needs no decision."
                : `${superseded.length} documents have been replaced by newer copies and need no decision.`
            }
          />
          <MuLedgerBody>
            {superseded.map((d) => (
              <MuLedgerRow
                key={d.id}
                icon={FileText}
                tone="neutral"
                title={d.label}
                sentence={`${docTypeLabel(d.doc_type)}. ${sourceLine(d)}.`}
                meta={`Superseded ${day(d.superseded_at) ?? "on an unrecorded date"}`}
                status={<MuStatus label="Superseded" tone="neutral" />}
                onOpen={() => { setSelected({ kind: "document", doc: d, requirement: reqFor(d) }); setReturning(false); setReason(""); setNotify(true); }}
              />
            ))}
          </MuLedgerBody>
        </MuLedger>
      )}



      {/* The working panel: one document, read in full, decided in one place. */}
      <MuDetailSheet
        open={!!selectedDoc}
        onOpenChange={(o) => { if (!o) { setSelected(null); setReturning(false); setReason(""); } }}
        eyebrow="Document"
        title={selectedDoc?.label ?? ""}
        subtitle={selectedDoc ? sourceLine(selectedDoc) : undefined}
        status={
          selectedDoc && (
            <MuStatus
              tone={
                selectedDoc.superseded_at ? "neutral"
                : selectedDoc.review_outcome === "accepted" ? "good"
                : selectedDoc.review_outcome === "rejected" ? "bad" : "info"
              }
              label={
                selectedDoc.superseded_at
                  ? "Superseded by a newer copy"
                  : selectedDoc.review_outcome === "accepted"
                    ? "Accepted"
                    : selectedDoc.review_outcome === "rejected"
                      ? "Returned to the candidate"
                      : "Awaiting review"
              }
            />
          )
        }
        decisions={
          selectedDoc && (
            reclassing ? (
              <>
                <Button variant="ghost" className="rounded-none" onClick={() => setReclassing(false)}>Cancel</Button>
                <Button
                  className="rounded-none"
                  disabled={busy === selectedDoc.id}
                  onClick={() => reclassify(selectedDoc)}
                >
                  Save the kind
                </Button>
              </>
            ) : returning ? (
              <>
                <Button variant="ghost" className="rounded-none" onClick={() => setReturning(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  className="rounded-none"
                  disabled={!reason.trim() || busy === selectedDoc.id}
                  onClick={() => review(selectedDoc, "rejected", reason.trim(), notify)}
                >
                  Return and record
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="mr-auto rounded-none" onClick={() => open(selectedDoc.url)}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />Open the file
                </Button>
                {!selectedDoc.superseded_at && (
                  <>
                    <Button
                      variant="ghost"
                      className="rounded-none"
                      disabled={busy === selectedDoc.id}
                      onClick={() => {
                        setNewType(selectedDoc.doc_type || "Other");
                        setReclassNote("");
                        setReclassing(true);
                      }}
                    >
                      Change the kind
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-none"
                      disabled={busy === selectedDoc.id}
                      onClick={() => supersede(selectedDoc)}
                    >
                      Supersede
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-none"
                      disabled={busy === selectedDoc.id}
                      onClick={() => { setReturning(true); setReason(""); setNotify(true); }}
                    >
                      <X className="mr-1.5 h-4 w-4" />Return with a reason
                    </Button>
                    <Button
                      className="rounded-none"
                      disabled={busy === selectedDoc.id || selectedDoc.review_outcome === "accepted"}
                      onClick={() => review(selectedDoc, "accepted", "", true)}
                    >
                      <Check className="mr-1.5 h-4 w-4" />Accept
                    </Button>
                  </>
                )}
              </>
            )
          )

        }
      >
        {selectedDoc && (
          <>
            {reclassing && (
              <div className="border-b border-line bg-muted/40 px-5 py-4">
                <Label className="text-[13px] font-semibold">What kind of document is this really?</Label>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                  Changing the kind moves the file onto the requirement it actually proves. The old kind, the new kind
                  and your name stay on the trail.
                </p>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="mt-2 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea
                  className="mt-2 rounded-none"
                  value={reclassNote}
                  onChange={(e) => setReclassNote(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Filed under Other on intake, but it is her national identity card."
                />
              </div>
            )}

            {returning && (
              <div className="border-b border-line bg-warn-wash px-5 py-4">
                <Label className="text-[13px] font-semibold">Why is this being returned?</Label>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                  The reason appears in the candidate's account so they know what to send instead.
                </p>
                <Textarea
                  className="mt-2 rounded-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="The photograph cuts off the expiry date. Please send the full page."
                />
                <label className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  <Mail className="h-4 w-4" />Email the reason to {personName}
                </label>
              </div>
            )}

            <MuDetailFacts
              rows={[
                { label: "Kind", value: docTypeLabel(selectedDoc.doc_type) },
                {
                  label: "Proves",
                  value: selected?.kind === "document" && selected.requirement
                    ? selected.requirement.label
                    : "No requirement is claiming this document.",
                },
                { label: "Received", value: day(selectedDoc.created_at) },
                { label: "Source", value: sourceLine(selectedDoc) },
                { label: "Reviewed", value: day(selectedDoc.reviewed_at) ?? "Not reviewed yet" },
                { label: "Expires", value: day(selectedDoc.expires_at) ?? "No expiry is held" },
              ]}
            />

            {selectedDoc.source_note && (
              <div className="border-t border-line px-5 py-4">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Note on file</p>
                <p className="mt-1.5 text-[14px] leading-relaxed">{selectedDoc.source_note}</p>
              </div>
            )}

            {selectedDoc.review_reason && (
              <div className="border-t border-line bg-warn-wash px-5 py-4">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-warn-ink">Reason it was returned</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-warn-ink">{selectedDoc.review_reason}</p>
              </div>
            )}

            <div className="border-t border-line px-5 py-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">What we read from it</p>
              <div className="mt-2">
                <DocumentReadout documentId={selectedDoc.id} />
              </div>
            </div>
          </>
        )}
      </MuDetailSheet>

      {/* The same panel for a requirement we do not hold a document against. */}
      <MuDetailSheet
        open={selected?.kind === "requirement"}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        eyebrow="Required document"
        title={selectedReq?.label ?? ""}
        subtitle={selectedReq ? STATUS_HELP[selectedReq.status] : undefined}
        status={
          selectedReq && (
            <>
              {!selectedReq.required && <MuStatus label="Optional for this profession" tone="neutral" />}
              <MuStatus label={STATUS_LABELS[selectedReq.status]} tone={docTone(selectedReq.status)} />
            </>
          )
        }
        decisions={
          selected?.kind === "requirement" && (
            <>
              {selected.request && (
                <Button
                  variant="ghost"
                  className="mr-auto rounded-none"
                  disabled={busy === selected.request.id}
                  onClick={() => cancelRequest(selected.request!.id)}
                >
                  <X className="mr-1.5 h-4 w-4" />Cancel the request
                </Button>
              )}
              <Button
                variant="outline"
                className="rounded-none"
                onClick={() => { setUploadType(selected.requirement.doc_type); setUploadOpen(true); }}
              >
                <Upload className="mr-1.5 h-4 w-4" />Upload on their behalf
              </Button>
              <Button className="rounded-none" onClick={() => askFor([selected.requirement.doc_type])}>
                <Mail className="mr-1.5 h-4 w-4" />
                {selected.request ? "Ask again" : "Ask for it"}
              </Button>
            </>
          )
        }
      >
        {selected?.kind === "requirement" && (
          <MuDetailFacts
            rows={[
              { label: "Why we need it", value: selected.requirement.helper || "It is on the required list for this profession." },
              {
                label: "Requested",
                value: selected.request
                  ? `${day(selected.request.created_at)}${selected.request.requested_by_name ? ` by ${selected.request.requested_by_name}` : ""}`
                  : "The candidate has not been asked for this yet.",
              },
              { label: "Due by", value: selected.request?.due_by ? day(selected.request.due_by) : "No date was set." },
              { label: "Note sent", value: selected.request?.note || "No note was added." },
              {
                label: "Last decision",
                value: selected.requirement.review_reason
                  ? `Returned: ${selected.requirement.review_reason}`
                  : selected.requirement.reviewed_at
                    ? `Reviewed ${day(selected.requirement.reviewed_at)}`
                    : "No decision has been recorded.",
              },
            ]}
          />
        )}
      </MuDetailSheet>

      {/* Ask the candidate for documents */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle>Request documents from {personName}</DialogTitle>
            <DialogDescription>
              One branded email naming each item, linking to their account. The request is written to their trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {reqs.filter((r) => r.status !== "accepted").map((r) => (
                <label key={r.doc_type} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ask.includes(r.doc_type)}
                    onChange={() =>
                      setAsk((prev) =>
                        prev.includes(r.doc_type) ? prev.filter((t) => t !== r.doc_type) : [...prev, r.doc_type],
                      )
                    }
                  />
                  <span>
                    {r.label}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {STATUS_LABELS[r.status]}
                      {!r.required ? ", optional for this profession" : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <Label className="text-xs">Add a line of context (optional)</Label>
              <Textarea
                className="rounded-none"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="A client has asked for cover next month, so we need these before we can put you forward."
              />
            </div>
            <div>
              <Label className="text-xs">Ask for them by (optional)</Label>
              <Input className="rounded-none" type="date" value={dueBy} onChange={(e) => setDueBy(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button className="rounded-none" onClick={sendRequest} disabled={ask.length === 0 || requesting}>
              {requesting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending</> : "Send the request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload on behalf */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle>Upload for {personName}</DialogTitle>
            <DialogDescription>
              For documents that reach us by email or WhatsApp. The source note is kept on the record so we can always
              say how the file arrived.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Document type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Where did it come from?</Label>
              <Input
                className="rounded-none"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="Emailed by the candidate on 12 Aug"
                maxLength={200}
              />
            </div>
            <div>
              <Label className="text-xs">Expiry date (optional)</Label>
              <Input className="rounded-none" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">File</Label>
              <Input
                ref={fileRef}
                className="rounded-none"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-none" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button className="rounded-none" onClick={doUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading</> : "Upload and file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsPanel;
