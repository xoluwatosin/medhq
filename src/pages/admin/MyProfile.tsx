// My profile: what a member of staff sees about themselves.
//
// Staff who hold nothing but profile access land here. It is deliberately
// narrow: their own details, the paperwork we need from them, and the contract
// they are on, read in full and signed here with an audit trail behind it.
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Briefcase, CalendarDays, CheckCircle2, Download, Loader2, Mail, MapPin, Phone, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { art } from "@/components/mc/art";
import { humaniseTerm } from "@/lib/readable";
import {
  DocumentRequirement, STATUS_HELP, STATUS_LABELS, loadRequirements, openDocumentTab,
} from "@/lib/documents";
import {
  MuEmpty, MuField, MuFieldGrid, MuNote, MuPage, MuPageHeader, MuRecord, MuSection, MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import {
  CONTRACT_STATUS_LABELS, Contract, EMPLOYMENT_TYPE_LABELS, PAY_FREQUENCY_LABELS,
  STAFF_STATUS_LABELS, loadContracts,
} from "@/lib/staff";
import ContractDocument from "@/components/contracts/ContractDocument";
import SignaturePad from "@/components/contracts/SignaturePad";
import { blobToBase64, contractToPdfBlob, downloadBlob } from "@/lib/contract-pdf";
import {
  ContractRecord, effectiveClauses, effectiveFields, loadContract, signContractInApp,
} from "@/lib/contracts";

const db = () => supabase as any;

const docTone = (s: string): MuTone =>
  s === "accepted" ? "good" : s === "conditional" ? "warning" : s === "pending" ? "info" : s === "missing" ? "neutral" : "bad";

const contractTone = (s: string): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "bad";

const MyProfile = () => {
  const { user, adminDisplayName } = useAuth();
  const { toast } = useToast();
  const [person, setPerson] = useState<any>(null);
  const [reqs, setReqs] = useState<DocumentRequirement[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [open, setOpen] = useState<ContractRecord | null>(null);
  const [signName, setSignName] = useState("");
  const [signMethod, setSignMethod] = useState<"typed" | "drawn">("typed");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [savingSign, setSavingSign] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: p } = await db().from("mu_people").select("*").eq("auth_user_id", user.id).maybeSingle();
    setPerson(p);
    if (p) {
      const [r, c] = await Promise.all([loadRequirements(p.id), loadContracts(p.id)]);
      setReqs(r);
      setContracts(c);
      setSignName(p.full_name || "");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const upload = async (docType: string, file: File) => {
    if (!person) return;
    setUploading(docType);
    try {
      const path = `${person.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("applications").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await db().from("mu_documents").insert({
        person_id: person.id,
        source_table: "candidate_portal",
        label: file.name,
        url: path,
        doc_type: docType,
        uploaded_by: user?.id,
        uploaded_by_name: adminDisplayName || person.full_name,
      });
      if (error) throw error;
      toast({ title: "Received", description: "Our team will check it." });
      load();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(null);
  };

  const openContract = async (id: string) => {
    try {
      const full = await loadContract(id);
      setOpen(full);
      setSignName(full.signed_name || person?.full_name || "");
      setConsent(false);
      setDrawn(null);
      setSignMethod("typed");
    } catch (err: any) {
      toast({ title: "Could not open the contract", description: err.message, variant: "destructive" });
    }
  };

  // The PDF is made from the very document on screen, then filed on the record
  // and emailed out, so what was signed and what is kept are the same paper.
  const deliver = async (contract: ContractRecord) => {
    if (!docRef.current) return;
    try {
      const blob = await contractToPdfBlob(docRef.current);
      const pdf = await blobToBase64(blob);
      await supabase.functions.invoke("send-contract-email", {
        body: { contract_id: contract.id, token: contract.sign_token, kind: "signed", pdf_base64: pdf },
      });
    } catch (err) {
      console.error("contract delivery", err);
    }
  };

  const submitSignature = async () => {
    if (!open) return;
    setSavingSign(true);
    try {
      await signContractInApp(open.id, signName.trim(), signMethod, signMethod === "drawn" ? drawn : null);
      const refreshed = await loadContract(open.id);
      setOpen(refreshed);
      toast({ title: "Contract signed", description: "We are emailing you a copy and filing it on your record." });
      window.setTimeout(() => deliver(refreshed), 500);
      load();
    } catch (err: any) {
      toast({ title: "Could not sign", description: err.message, variant: "destructive" });
    }
    setSavingSign(false);
  };

  const downloadContract = async () => {
    if (!docRef.current) return;
    const blob = await contractToPdfBlob(docRef.current);
    downloadBlob(blob, "medic-connect-contract.pdf");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!person) {
    return (
      <MuPage>
        <MuPageHeader title="My profile" />
        <MuSection padded={false}>
          <MuEmpty
            art={art.objIdVerification}
            title="No staff record linked to this sign-in"
            description="Ask an administrator to link your account to your staff record."
          />
        </MuSection>
      </MuPage>
    );
  }

  const outstanding = reqs.filter((r) => r.required && r.status !== "accepted").length;

  return (
    <MuPage>
      <MuPageHeader
        title="My profile"
        description="Your employment details, the paperwork we need from you, and your contract."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MuStatus label={STAFF_STATUS_LABELS[person.staff_status] || person.staff_status} tone="info" />
            <MuStatus
              label={outstanding > 0 ? `${outstanding} outstanding` : "Paperwork complete"}
              tone={outstanding > 0 ? "warning" : "good"}
            />
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <MuSection title="Your details" description="If anything here is wrong, tell your manager and we will correct it.">
            <MuFieldGrid columns={3}>
              <MuField label="Name" value={person.full_name} />
              <MuField label="Job title" icon={Briefcase} value={person.job_title} />
              <MuField label="Department" value={person.department} />
              <MuField
                label="Employment type"
                value={EMPLOYMENT_TYPE_LABELS[person.employment_type || ""] || person.employment_type}
              />
              <MuField
                label="Start date"
                icon={CalendarDays}
                value={person.staff_start_date ? format(new Date(person.staff_start_date), "d MMM yyyy") : null}
              />
              <MuField label="Work email" icon={Mail} value={person.work_email} />
              <MuField label="Personal email" icon={Mail} value={person.email} />
              <MuField label="Phone" icon={Phone} value={person.phone} />
              <MuField
                label="Location"
                icon={MapPin}
                value={[person.lga, person.state].filter(Boolean).join(", ")}
              />
            </MuFieldGrid>
          </MuSection>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <MuSection
            title="Your documents"
            description="What we are required to hold on file. Upload a clear copy; a member of the team checks each one."
            padded={false}
          >
            <div className="divide-y divide-line-soft">
              {reqs.map((r) => (
                <MuRecord
                  key={r.doc_type}
                  title={r.label}
                  subtitle={r.helper}
                  status={<MuStatus label={STATUS_LABELS[r.status]} tone={docTone(r.status)} />}
                  notes={
                    <>
                      <MuNote title="Where this stands">{STATUS_HELP[r.status]}</MuNote>
                      {r.review_reason && (
                        <MuNote title="Why it was returned" tone="warning">{r.review_reason}</MuNote>
                      )}
                    </>
                  }
                  actions={
                    <>
                      <label>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && upload(r.doc_type, e.target.files[0])}
                        />
                        <Button size="sm" variant={r.status === "accepted" ? "outline" : "default"} asChild>
                          <span>
                            {uploading === r.doc_type ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {r.status === "missing" ? "Upload" : "Replace"}
                          </span>
                        </Button>
                      </label>
                      {r.document_url && (
                        <Button size="sm" variant="outline" onClick={() => openDocumentTab(r.document_url!)}>
                          View what we hold
                        </Button>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          </MuSection>
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <MuSection title="Your contract" padded={false}>
            {contracts.length === 0 ? (
              <MuEmpty art={art.objSignedContract} title="No contract issued yet" description="Your contract will appear here once it has been issued." />
            ) : (
              <div className="divide-y divide-line-soft">
                {contracts.map((c) => (
                  <MuRecord
                    key={c.id}
                    title={c.job_title || humaniseTerm(c.contract_type)}
                    subtitle={c.issued_at ? `Issued ${format(new Date(c.issued_at), "d MMM yyyy")}` : "Not yet issued"}
                    status={<MuStatus label={CONTRACT_STATUS_LABELS[c.status]} tone={contractTone(c.status)} />}
                    fields={
                      <MuFieldGrid columns={3}>
                        <MuField label="Type" value={EMPLOYMENT_TYPE_LABELS[c.contract_type] || humaniseTerm(c.contract_type)} />
                        <MuField label="Starts" value={c.start_date ? format(new Date(c.start_date), "d MMM yyyy") : null} />
                        <MuField label="Working pattern" value={c.working_pattern} />
                        <MuField
                          label="Pay"
                          value={c.pay_amount ? `${c.pay_currency} ${Number(c.pay_amount).toLocaleString()} ${PAY_FREQUENCY_LABELS[c.pay_frequency]?.toLowerCase() || ""}` : null}
                        />
                        <MuField label="Notice period" value={c.notice_period} />
                        <MuField label="Place of work" icon={MapPin} value={c.location} />
                      </MuFieldGrid>
                    }
                    notes={
                      c.signed_at ? (
                        <MuNote title="Signed">
                          {format(new Date(c.signed_at), "d MMM yyyy 'at' HH:mm")}
                          {c.signed_name ? ` by ${c.signed_name}` : ""}
                        </MuNote>
                      ) : undefined
                    }
                    actions={
                      <Button
                        size="sm"
                        variant={c.status === "issued" ? "default" : "outline"}
                        onClick={() => openContract(c.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {c.status === "issued" ? "Read and sign" : "Read the contract"}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </MuSection>
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,240mm)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your contract</DialogTitle>
            <DialogDescription>
              Read it in full. Sign by typing your name or drawing your signature. We record the name, the time
              and the device used.
            </DialogDescription>
          </DialogHeader>

          {open && (
            <>
              <div className="overflow-x-auto border border-line-soft bg-muted/40 p-3">
                <ContractDocument
                  ref={docRef}
                  fields={effectiveFields(open)}
                  clauses={effectiveClauses(open)}
                  annexes={open.annexes}
                  isClinical={open.is_clinical}
                  signedName={open.signed_name}
                  signedAt={open.signed_at}
                  signatureImage={open.signature_image}
                  countersignedName={open.countersigned_name}
                  countersignedAt={open.countersigned_at}
                  countersignatureImage={open.countersignature_image}
                  showPlaceholders={false}
                />
              </div>

              {open.status === "issued" ? (
                <div className="space-y-4">
                  <Tabs value={signMethod} onValueChange={(v) => setSignMethod(v as "typed" | "drawn")}>
                    <TabsList>
                      <TabsTrigger value="typed">Type my name</TabsTrigger>
                      <TabsTrigger value="drawn">Draw my signature</TabsTrigger>
                    </TabsList>
                    <TabsContent value="typed" className="mt-3 space-y-1.5">
                      <Label>Full name</Label>
                      <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
                    </TabsContent>
                    <TabsContent value="drawn" className="mt-3 space-y-3">
                      <SignaturePad onChange={setDrawn} />
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                    <span>
                      By signing here I confirm that this is my electronic signature and that it has the same
                      effect as a signature in ink.
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This contract is {(CONTRACT_STATUS_LABELS[open.status] || open.status).toLowerCase()}.
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={downloadContract}>
              <Download className="mr-2 h-4 w-4" />Download PDF
            </Button>
            <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
            {open?.status === "issued" && (
              <Button
                onClick={submitSignature}
                disabled={savingSign || !consent || !signName.trim() || (signMethod === "drawn" && !drawn)}
              >
                {savingSign ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default MyProfile;
