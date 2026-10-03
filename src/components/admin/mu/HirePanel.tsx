// Offers and contracts, on the candidate's own record.
//
// Everything about hiring this person happens here: the offer is written from
// what we already hold about them, and the contract that follows is built from
// the offer they accepted. Nothing is retyped, and the whole history stays on
// the person rather than in a separate authoring screen.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Ban, Briefcase, CalendarDays, FileSignature, FileStack, Loader2, MapPin, Plus, RotateCcw, Send,
  ShieldCheck, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { useAuth } from "@/contexts/AuthContext";
import { humaniseTerm } from "@/lib/readable";
import { contractPayloadFromOffer, createContractFromLibrary } from "@/lib/contracts";
import { ContractTemplate, createContractFromTemplate, loadTemplates } from "@/lib/contract-templates";
import { isEngagementOffer } from "@/lib/engagements";
import {
  CONTRACT_STATUS_LABELS, Contract, EMPLOYMENT_TYPE_LABELS, PAY_FREQUENCY_LABELS,
  binContract, issueContract, loadContracts, setContractStatus,
} from "@/lib/staff";
import {
  MuEmpty, MuField, MuFieldGrid, MuNote, MuRecord, MuSection, MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import WorkPanel from "@/components/admin/mu/WorkPanel";
import { OFFER_STATUS_ADMIN_LABEL, type Offer } from "@/lib/offers";

const contractTone = (s: string): MuTone =>
  s === "active" || s === "signed" ? "good" : s === "issued" ? "info" : s === "draft" ? "warning" : "bad";

interface Props {
  personId: string;
  person: any;
  onChanged?: () => void;
}

const HirePanel = ({ personId, person, onChanged }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { adminDisplayName } = useAuth();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [acceptedOffers, setAcceptedOffers] = useState<Offer[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [showBin, setShowBin] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("library");

  // Abandoned drafts are kept, not destroyed, but they stay out of the way
  // until they are asked for.
  const binnedContracts = contracts.filter((c) => !!c.deleted_at);
  const visibleContracts = showBin ? binnedContracts : contracts.filter((c) => !c.deleted_at);


  const load = useCallback(async () => {
    setLoading(true);
    const [cs, { data: offers }, ts] = await Promise.all([
      loadContracts(personId),
      adminDb()
        .from("mu_offers")
        .select("*")
        .eq("person_id", personId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false }),
      loadTemplates().catch(() => []),
    ]);
    setContracts(cs);
    setTemplates(ts);
    // Only engagements are papered. Shifts sit under one and need no contract.
    setAcceptedOffers((((offers as any) || []) as Offer[]).filter(isEngagementOffer));

    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  // A contract starts from the clause library, prefilled with the person's own
  // record and, where there is one, the offer they already accepted.
  const buildContract = async (offer?: Offer) => {
    setBuilding(true);
    try {
      const payload = contractPayloadFromOffer(person || {}, offer, adminDisplayName);
      const newId = selectedTemplateId === "library"
        ? await createContractFromLibrary(personId, payload)
        : await createContractFromTemplate(personId, selectedTemplateId, payload);
      navigate(`/admin/contracts/${newId}`);
    } catch (err: any) {
      toast({ title: "Could not start the contract", description: err.message, variant: "destructive" });
    }
    setBuilding(false);
  };

  const openNewContract = () => {
    if (templates.length === 0) {
      buildContract(acceptedOffers[0]);
      return;
    }
    setSelectedTemplateId(templates[0]?.id || "library");
    setTemplateDialog(true);
  };

  const runContractAction = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast({ title: done });
      load();
      onChanged?.();
    } catch (err: any) {
      toast({ title: "That did not go through", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <WorkPanel
        personId={personId}
        personName={person?.full_name || "this candidate"}
        include={["offers"]}
        onChanged={() => { load(); onChanged?.(); }}
      />

      <MuSection
        title={showBin ? "Contracts in the bin" : "Contracts"}
        description={
          showBin
            ? "Drafts moved out of the way. Nothing here was destroyed, and any of it can be restored."
            : "Draft it, issue it for signature, then it becomes active. Renewals and amendments stack here rather than replacing the last one."
        }
        padded={false}
        actions={
          <>
            {binnedContracts.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setShowBin((v) => !v)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {showBin ? "Back to contracts" : `Bin (${binnedContracts.length})`}
              </Button>
            )}
            {!showBin && (
              <Button size="sm" disabled={building} onClick={openNewContract}>
                {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileStack className="mr-2 h-4 w-4" />}
                {acceptedOffers.length > 0 ? "Contract from the accepted offer" : "New contract"}
              </Button>
            )}
          </>
        }
      >
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Reading their contracts.</div>
        ) : visibleContracts.length === 0 ? (
          <MuEmpty
            icon={FileSignature}
            title={showBin ? "The bin is empty" : "No contract on file"}
            description={
              showBin
                ? "Nothing has been binned for this candidate."
                : acceptedOffers.length > 0
                ? "They have accepted an offer, so a contract can be built straight from its terms."
                : "Send an offer first, then build the contract from the terms they accept."

            }
          />
        ) : (
          <div className="divide-y divide-border/60">
            {visibleContracts.map((c) => (
              <MuRecord
                key={c.id}
                title={c.job_title || EMPLOYMENT_TYPE_LABELS[c.contract_type] || humaniseTerm(c.contract_type)}
                subtitle={`Drafted ${format(new Date(c.created_at), "d MMM yyyy")}${c.created_by_name ? ` by ${c.created_by_name}` : ""}`}
                status={<MuStatus label={CONTRACT_STATUS_LABELS[c.status] || c.status} tone={contractTone(c.status)} />}
                fields={
                  <MuFieldGrid columns={4}>
                    <MuField label="Type" icon={Briefcase} value={EMPLOYMENT_TYPE_LABELS[c.contract_type] || humaniseTerm(c.contract_type)} />
                    <MuField label="Starts" icon={CalendarDays} value={c.start_date ? format(new Date(c.start_date), "d MMM yyyy") : null} />
                    <MuField label="Ends" icon={CalendarDays} value={c.end_date ? format(new Date(c.end_date), "d MMM yyyy") : "Open ended"} />
                    <MuField label="Probation ends" icon={CalendarDays} value={c.probation_end ? format(new Date(c.probation_end), "d MMM yyyy") : null} />
                    <MuField
                      label="Pay"
                      value={c.pay_amount ? `${c.pay_currency} ${Number(c.pay_amount).toLocaleString()} ${PAY_FREQUENCY_LABELS[c.pay_frequency]?.toLowerCase() || c.pay_frequency}` : null}
                    />
                    <MuField label="Notice period" value={c.notice_period} />
                    <MuField label="Working pattern" value={c.working_pattern} />
                    <MuField label="Location" icon={MapPin} value={c.location} />
                    <MuField
                      label="Issued"
                      value={c.issued_at ? format(new Date(c.issued_at), "d MMM yyyy") : "Not issued yet"}
                    />
                    <MuField
                      label="Signed"
                      value={
                        c.signed_at
                          ? `${format(new Date(c.signed_at), "d MMM yyyy")}${c.signed_name ? ` by ${c.signed_name}` : ""}`
                          : c.status === "issued"
                            ? "Waiting for their signature"
                            : "Not signed"
                      }
                    />

                  </MuFieldGrid>
                }
                notes={
                  <>
                    {c.notes && <MuNote title="Note">{c.notes}</MuNote>}
                    {c.document_url && (
                      <MuNote title="Contract document">
                        <a href={c.document_url} target="_blank" rel="noreferrer" className="text-primary underline">
                          Open the stored contract
                        </a>
                      </MuNote>
                    )}
                  </>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/contracts/${c.id}`)}>
                      <FileSignature className="mr-2 h-4 w-4" />Open the document
                    </Button>
                    {c.status === "draft" && (
                      <Button size="sm" onClick={() => runContractAction(() => issueContract(c.id, adminDisplayName), "Contract issued for candidate signature")}>
                        <Send className="mr-2 h-4 w-4" />Issue for signature
                      </Button>
                    )}
                    {c.status === "signed" && (
                      <Button size="sm" onClick={() => runContractAction(() => setContractStatus(c.id, "active"), "Contract active")}>
                        <ShieldCheck className="mr-2 h-4 w-4" />Mark active
                      </Button>
                    )}
                    {["draft", "issued"].includes(c.status) && (
                      <Button variant="outline" size="sm" onClick={() => runContractAction(() => setContractStatus(c.id, "withdrawn"), "Contract withdrawn")}>
                        <Ban className="mr-2 h-4 w-4" />Withdraw
                      </Button>
                    )}
                    {c.status === "active" && (
                      <Button variant="outline" size="sm" onClick={() => runContractAction(() => setContractStatus(c.id, "ended"), "Contract ended")}>
                        End contract
                      </Button>
                    )}
                    {c.deleted_at ? (
                      <Button variant="outline" size="sm" onClick={() => runContractAction(() => binContract(c.id, false), "Restored")}>
                        <RotateCcw className="mr-2 h-4 w-4" />Restore
                      </Button>
                    ) : ["draft", "withdrawn"].includes(c.status) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => runContractAction(() => binContract(c.id, true), "Moved to the bin")}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />Move to bin
                      </Button>
                    ) : null}
                  </>
                }
              />
            ))}
          </div>
        )}
      </MuSection>

      {acceptedOffers.length > 0 && (
        <MuNote title="Offers they have accepted">
          {acceptedOffers
            .map((o) => `${o.title || "Untitled offer"} (${OFFER_STATUS_ADMIN_LABEL[o.status] || o.status})`)
            .join(", ")}
        </MuNote>
      )}

      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start the contract</DialogTitle>
            <DialogDescription>
              Pick the role template. The candidate and accepted offer details are still carried into the draft.
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
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
                <SelectItem value="library">No template, use the clause library</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button
              disabled={building}
              onClick={() => {
                setTemplateDialog(false);
                buildContract(acceptedOffers[0]);
              }}
            >
              {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HirePanel;
