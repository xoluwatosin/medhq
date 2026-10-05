// Documents. What we asked for, what we hold, and one way to add more.
//
// There is no standing button at the bottom of the screen. The thing you are
// looking at is the thing you tap: a request, a requirement, or the drop area.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, Eye, FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/match-universe";
import { STATUS_HELP, STATUS_LABELS, conditionalLine, openDocumentTab } from "@/lib/documents";
import DocumentRequestList from "@/components/DocumentRequestList";
import VerifiedBadge from "@/components/VerifiedBadge";
import ReferencesPanel from "@/components/portal/ReferencesPanel";
import ContractPackList from "@/components/contracts/ContractPackList";
import { PortalContract, loadMyContracts } from "@/lib/contracts";
import CxPortalPage from "@/components/candidate/CxPortalPage";
import { art } from "@/components/mc/art";
import { CxButton, CxCard, CxEmpty, CxFixBlock, CxPill, CxRow, CxRows, CxSection } from "@/components/candidate/primitives";
import { usePortal } from "./usePortal";
import { uploadPortalDocument } from "@/lib/portal-actions";
import { candidateOperationalNote } from "@/lib/candidate-field-copy";

// "report final(2).pdf" tells us nothing. Before anything leaves the phone we
// offer the candidate a plain name, and they can change it.
const splitName = (name: string) => {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, dot), ext: name.slice(dot).toLowerCase() };
};

const suggestStem = (docType: string, person: { full_name?: string | null } | null) => {
  const who = (person?.full_name || "").trim().split(/\s+/).slice(0, 2).join(" ");
  return [who, docType].filter(Boolean).join(" ");
};

const PortalDocuments = () => {
  const { toast } = useToast();
  const p = usePortal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [otherType, setOtherType] = useState("CV");
  const [pending, setPending] = useState<string>("CV");
  const [uploading, setUploading] = useState<string | null>(null);
  const [docKey, setDocKey] = useState(0);
  const [staged, setStaged] = useState<{ file: File; ext: string } | null>(null);
  const [stagedName, setStagedName] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<typeof p.docs[number] | null>(null);
  const { hash } = useLocation();
  const [contracts, setContracts] = useState<PortalContract[]>([]);

  // The pack is fetched here so the documents tab can list it alongside the
  // rest of the paperwork.
  useEffect(() => {
    if (p.authLoading) return;
    loadMyContracts().then(setContracts).catch(() => setContracts([]));
  }, [p.authLoading]);

  // Arriving from the home page with #references lands on the referees, not
  // the top of the page.
  useEffect(() => {
    if (!hash || p.loading) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, p.loading]);



  // Whatever you tapped decides the type. Then the picker opens.
  const pick = (docType: string) => {
    if (uploading) return;
    setPending(docType);
    fileRef.current?.click();
  };

  const stage = (file: File) => {
    const { ext } = splitName(file.name);
    setStaged({ file, ext });
    setStagedName(suggestStem(pending, p.person));
  };

  const upload = async () => {
    if (!staged) return;
    const stem = (stagedName.trim() || splitName(staged.file.name).stem)
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const named = new File([staged.file], `${stem}${staged.ext}`, { type: staged.file.type });
    setStaged(null);
    setUploading(pending);
    const { error } = await uploadPortalDocument(p.user!.id, p.person.id, named, pending);
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
    if (error) {
      toast({ title: "Upload failed", description: "Please check the file and try again.", variant: "destructive" });
      return;
    }
    toast({
      title: `${pending} received`,
      description: "We will check it and come back to you.",
    });
    setDocKey((k) => k + 1);
    p.reload();
  };

  const viewDoc = async (url: string) => {
    const ok = await openDocumentTab(url);
    if (!ok) toast({ title: "Could not open document", variant: "destructive" });
  };

  const replaceDoc = (doc: typeof p.docs[number]) => {
    setPending(doc.label);
    fileRef.current?.click();
    setSelectedDoc(null);
  };


  if (!p.person) {
    return (
      <CxPortalPage loading={p.authLoading || p.loading} person={p.person} nav={p.nav} title="Documents">
        {null}
      </CxPortalPage>
    );
  }

  return (
    <CxPortalPage
      loading={p.authLoading || p.loading}
      person={p.person}
      nav={p.nav}
      title="Documents"
      eyebrow="Candidate portal"
      back="/portal"
      intro="Tap anything on this page that we still need and your phone will offer you the file straight away."
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) stage(f); }}
      />

      <Dialog
        open={!!staged}
        onOpenChange={(open) => {
          if (!open) {
            setStaged(null);
            if (fileRef.current) fileRef.current.value = "";
          }
        }}
      >
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="text-[19px] font-bold tracking-[-0.01em] text-ink">Name this {pending}</DialogTitle>
            <DialogDescription className="text-[14.5px] leading-relaxed text-body">
              We suggested a name so our team can find it quickly. Change it if you would rather.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={stagedName}
                onChange={(e) => setStagedName(e.target.value)}
                placeholder="File name"
                className="h-11 rounded-none border-line text-[15px]"
                autoFocus
              />
              {staged?.ext && <span className="text-[14px] font-bold text-muted-foreground">{staged.ext}</span>}
            </div>
            <p className="text-[13.5px] leading-relaxed text-body">
              You chose {staged?.file.name}. It keeps its {staged?.ext ? staged.ext.replace(".", "").toUpperCase() : "original"} format.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <CxButton type="button" onClick={upload}>Upload it</CxButton>
              <CxButton
                type="button"
                rank="secondary"
                onClick={() => {
                  setStaged(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Choose another file
              </CxButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDoc} onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="text-[19px] font-bold tracking-[-0.01em] text-ink">{selectedDoc?.label}</DialogTitle>
            <DialogDescription className="text-[14.5px] leading-relaxed text-body">
              Uploaded {selectedDoc && new Date(selectedDoc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 pt-1">
            <CxButton type="button" onClick={() => selectedDoc && viewDoc(selectedDoc.url)}>
              <Eye className="h-4 w-4" />View document
            </CxButton>
            <CxButton
              type="button"
              rank="secondary"
              onClick={() => selectedDoc && replaceDoc(selectedDoc)}
              disabled={!!uploading}
            >
              <Upload className="h-4 w-4" />Replace or upload
            </CxButton>
          </div>
        </DialogContent>
      </Dialog>

      {p.person?.verification_state === "verified" && (
        <div className="mb-4">
          <VerifiedBadge state={p.person.verification_state} reqs={p.reqs} size="lg" />
        </div>
      )}

      {/* The contract pack sits with the documents, because that is where a
          person looks for it. Each line opens on its own screen. */}
      {contracts.map((c) => (
        <CxSection
          key={c.id}
          title="Your contract pack"
          intro="Open each document, read it, and sign the ones that ask for a signature."
        >
          <CxCard kind={c.status === "issued" ? "emphasis" : "quiet"} className="p-5 sm:p-[22px]">
            <ContractPackList contract={c} />
          </CxCard>
        </CxSection>
      ))}


      {p.requests.length > 0 && (
        <CxSection
          title="What we have asked you for"
          intro="Tap a request to upload it. It closes itself as soon as the document lands."
        >
          <CxCard kind={p.openRequests > 0 ? "needs-you" : "quiet"} className="p-5 sm:p-[22px]">
            <DocumentRequestList
              personId={p.person.id}
              mode="candidate"
              refreshKey={docKey}
              onPick={pick}
              uploadingType={uploading}
            />
          </CxCard>
        </CxSection>
      )}

      {p.required.length > 0 && (
        <CxSection title="What we need on file" intro="Tap a line to send us that document.">
          <CxCard>
            <CxRows>
              {p.required.map((r) => {
                const busy = uploading === r.label;
                return (
                  <button
                    key={r.doc_type}
                    type="button"
                    disabled={!!uploading}
                    onClick={() => pick(r.label)}
                    className="w-full px-5 py-4 text-left transition-colors hover:bg-desk/60 disabled:opacity-60 sm:px-[22px] sm:py-[17px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <p className="text-[15.5px] font-bold text-ink">{r.label}</p>
                      <span className="flex items-center gap-2">
                        <CxPill>{STATUS_LABELS[r.status]}</CxPill>
                        {busy
                          ? <Loader2 className="h-4 w-4 animate-spin text-brand" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </span>
                    </div>
                    <p className="mt-1 cx-measure text-[14.5px] leading-relaxed text-body">
                      {r.status === "missing" && r.helper ? r.helper : STATUS_HELP[r.status]}
                    </p>
                    {r.status === "conditional" && (
                      <div className="mt-3">
                        <CxFixBlock title="Still needed">
                          {conditionalLine(r) ?? "Accepted for now. Please send an in date copy."}
                        </CxFixBlock>
                      </div>
                    )}
                    {r.status === "rejected" && r.review_reason && (
                      <div className="mt-3">
                        <CxFixBlock title="Why it came back">
                          {candidateOperationalNote(
                            r.review_reason,
                            "We could not accept this copy. Please upload a clear, current version of the correct document.",
                          )}
                        </CxFixBlock>
                      </div>
                    )}
                  </button>
                );
              })}
            </CxRows>
          </CxCard>
        </CxSection>
      )}

      <CxSection
        title="Anything else"
        intro="PDF files only. Choose the type, then tap the box."
      >
        <div className="space-y-3">
          <Select value={otherType} onValueChange={setOtherType}>
            <SelectTrigger className="cx-chip h-11 w-full border-line text-[14.5px] md:w-56">
              <SelectValue placeholder="Document type" />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>

          <button
            type="button"
            disabled={!!uploading}
            onClick={() => pick(otherType)}
            className="cx-card flex w-full flex-col items-center gap-2 border border-dashed border-line bg-white px-5 py-8 text-center transition-colors hover:border-navy hover:bg-desk/50 disabled:opacity-60"
          >
            {uploading === otherType
              ? <Loader2 className="h-6 w-6 animate-spin text-navy" />
              : <Upload className="h-6 w-6 text-navy" />}
            <p className="text-[15px] font-bold text-ink">
              {uploading === otherType ? `Uploading your ${otherType}` : `Tap to add a ${otherType}`}
            </p>
            <p className="cx-measure text-[13.5px] leading-relaxed text-body">
              PDF files only. Your phone will offer your files.
            </p>
          </button>
        </div>

        <CxCard className="mt-4">
          {p.docs.length === 0 ? (
            <CxEmpty art={art.objPaperUpload}>Nothing on file yet. Start with your CV.</CxEmpty>
          ) : (
            <CxRows>
              {p.docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDoc(d)}
                  className="w-full px-5 py-4 text-left transition-colors hover:bg-desk/60 sm:px-[22px] sm:py-[17px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <p className="text-[15.5px] font-bold text-ink">{d.label}</p>
                    <CxPill>{d.verified ? "Accepted" : "Being checked"}</CxPill>
                  </div>
                  <p className="mt-1 cx-measure text-[14.5px] leading-relaxed text-body">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand">
                    <Eye className="h-3.5 w-3.5" />
                    Tap to view or replace
                  </p>
                </button>
              ))}
            </CxRows>
          )}
        </CxCard>
      </CxSection>

      <div id="references" className="scroll-mt-24">
        <CxSection
          title="People who can vouch for you"
          intro="We only contact a referee once you are being put forward, and we tell you first."
        >
          <CxCard className="p-5 sm:p-[22px]">
            <ReferencesPanel personId={p.person.id} />
          </CxCard>
        </CxSection>
      </div>

    </CxPortalPage>
  );
};

export default PortalDocuments;
