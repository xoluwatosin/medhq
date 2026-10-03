// The credential worklist for one person.
//
// A credential is a question with three separate answers: what was claimed,
// what evidence is held, and whether anybody checked it. This panel leads with
// the credentials that need the office to act, and folds the settled ones away
// so the queue is the screen. Nothing here is a manual switch: a credential
// only advances when a document is attached and passed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Check, ChevronDown, FileText, Loader2, ShieldCheck, ShieldQuestion, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { PersonDocument } from "@/lib/match-universe";
import {
  CREDENTIAL_LABELS, CREDENTIAL_TYPES, CredentialRow, CredentialState,
  STATE_LABELS, STATE_MEANING, provenanceLabel, stateTone,
} from "@/lib/credentials";
import {
  MuGroupHead, MuLedger, MuLedgerBody, MuLedgerRow, MuStatus, MuTone,
} from "@/components/admin/mu/MuShell";
import { MuDetailFacts, MuDetailSheet } from "@/components/admin/mu/MuDetailSheet";

/** The credential ladder in the shared chip vocabulary. */
const credTone = (state: string): MuTone =>
  state === "verified"
    ? "good"
    : state === "documented"
      ? "info"
      : state === "self_declared"
        ? "warning"
        : state === "unknown"
          ? "neutral"
          : "bad";

/** A credential is never rendered without the tier that earned it. */
export const CredentialBadge = ({ state }: { state: string }) => {
  const tone = stateTone(state);
  return (
    <Badge
      variant={tone === "verified" ? "default" : tone === "bad" ? "destructive" : "outline"}
      className="gap-1"
    >
      {tone === "verified" && <ShieldCheck className="h-3 w-3" />}
      {STATE_LABELS[state as CredentialState] ?? state}
    </Badge>
  );
};

interface Props {
  personId: string;
  documents: PersonDocument[];
  actor?: { id?: string | null; name?: string | null };
  onChanged?: () => void;
}

interface Item {
  credential_type: string;
  row: (CredentialRow & { state: string }) | null;
  state: string;
}

const day = (v?: string | null) => (v ? format(new Date(v), "d MMM yyyy") : null);

const CredentialsPanel = ({ personId, documents, onChanged }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<(CredentialRow & { state: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openType, setOpenType] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback(async () => {
    const db = adminDb() as any;
    const { data } = await db.from("mu_credentials_v").select("*").eq("person_id", personId);
    setRows((data ?? []) as any);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const items: Item[] = useMemo(() => {
    const map = new Map(rows.map((r) => [r.credential_type, r]));
    return CREDENTIAL_TYPES.map((t) => {
      const row = map.get(t) ?? null;
      return { credential_type: t, row, state: row?.state ?? "unknown" };
    });
  }, [rows]);

  // One shared path for admin and candidate uploads alike: the SQL function
  // attaches the document, moves the tier and writes the activity row.
  const attach = async (type: string, documentId: string) => {
    setBusy(type);
    const { error } = await (adminDb() as any).rpc("mu_attach_credential_document", {
      _person_id: personId,
      _credential_type: type,
      _document_id: documentId,
      _claim_source: "admin_entered",
    });
    setBusy(null);
    if (error) {
      toast({ title: "Could not attach the document", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document attached", description: "This credential is now waiting for review." });
    load();
    onChanged?.();
  };

  const review = async (type: string, outcome: "pass" | "fail") => {
    const row = rows.find((r) => r.credential_type === type);
    setBusy(type);
    const { error } = await (adminDb() as any).rpc("mu_verify_credential", {
      _person_id: personId,
      _credential_type: type,
      _outcome: outcome,
      _method: "document_review",
      _document_id: row?.evidence_document_id ?? null,
      _expires_at: row?.expires_at ?? null,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Could not record the review", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: outcome === "pass" ? "Credential verified" : "Credential failed review" });
    setOpenType(null);
    load();
    onChanged?.();
  };

  if (loading)
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // The office acts on anything with evidence waiting, anything that lapsed,
  // and anything failed. Everything else is either settled or waiting on a
  // document, which is the document ledger's business, not this one.
  const needsUs = items.filter((i) => i.state === "documented" || i.state === "expired" || i.state === "rejected");
  const waiting = items.filter((i) => i.state === "self_declared" || i.state === "unknown");
  const settled = items.filter((i) => i.state === "verified" || i.state === "declined");

  const verified = settled.filter((i) => i.state === "verified").length;
  const headline = needsUs.length === 0
    ? verified === items.length
      ? "Every expected credential has been verified against a passed document."
      : "No credential is waiting on the office."
    : needsUs.length === 1
      ? "One credential is waiting on the office."
      : `${needsUs.length} credentials are waiting on the office.`;

  const current = openType ? items.find((i) => i.credential_type === openType) ?? null : null;
  const currentDoc = current?.row?.evidence_document_id
    ? documents.find((d) => d.id === current.row!.evidence_document_id) ?? null
    : null;

  const rowFor = (i: Item, tone: "attention" | "neutral" | "good") => (
    <MuLedgerRow
      key={i.credential_type}
      icon={i.state === "verified" ? ShieldCheck : ShieldQuestion}
      tone={tone}
      title={CREDENTIAL_LABELS[i.credential_type as keyof typeof CREDENTIAL_LABELS]}
      sentence={STATE_MEANING[i.state as CredentialState]}
      meta={
        i.row?.verified_at
          ? `Reviewed ${day(i.row.verified_at)}${i.row.expires_at ? `, expires ${day(i.row.expires_at)}` : ""}`
          : i.row?.evidence_document_id
            ? "A document is attached and has not been reviewed."
            : "No evidence is attached."
      }
      status={<MuStatus label={STATE_LABELS[i.state as CredentialState] ?? i.state} tone={credTone(i.state)} />}
      onOpen={() => setOpenType(i.credential_type)}
    />
  );

  return (
    <div className="space-y-4">
      {needsUs.length > 0 ? (
        <MuLedger className="border-warn-line/40">
          <MuGroupHead tone="attention" label="Waiting on the office" sentence={headline} />
          <MuLedgerBody>{needsUs.map((i) => rowFor(i, "attention"))}</MuLedgerBody>
        </MuLedger>
      ) : (
        <div className="flex items-center gap-3 border border-line bg-card px-5 py-3.5">
          <MuStatus icon={ShieldCheck} tone="good" label={headline} />
        </div>
      )}

      <MuLedger>
        <MuGroupHead
          label="Waiting on evidence"
          sentence={
            waiting.length === 0
              ? "Every expected credential has a document attached."
              : "Claimed on a form or never asked. A claim is not a credential, so these cannot advance until a document arrives."
          }
        />
        {waiting.length > 0 && <MuLedgerBody>{waiting.map((i) => rowFor(i, "neutral"))}</MuLedgerBody>}
      </MuLedger>

      <Collapsible open={showSettled} onOpenChange={setShowSettled}>
        <MuLedger>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-tint/40">
            <span className="min-w-0">
              <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-navy">Settled</span>
              <span className="mt-1 block text-[13.5px] leading-snug text-muted-foreground">
                {settled.length === 0
                  ? "Nothing has been settled yet."
                  : `${verified === 0 ? "None" : verified} of the expected credentials ${verified === 1 ? "has" : "have"} been verified, and ${settled.length - verified === 0 ? "none has" : `${settled.length - verified} ${settled.length - verified === 1 ? "has" : "have"}`} been declined.`}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${showSettled ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {settled.length > 0 && (
              <MuLedgerBody className="border-t border-line-soft">
                {settled.map((i) => rowFor(i, "good"))}
              </MuLedgerBody>
            )}
          </CollapsibleContent>
        </MuLedger>
      </Collapsible>

      <MuDetailSheet
        open={!!current}
        onOpenChange={(o) => { if (!o) setOpenType(null); }}
        eyebrow="Credential"
        title={current ? CREDENTIAL_LABELS[current.credential_type as keyof typeof CREDENTIAL_LABELS] : ""}
        subtitle={current ? STATE_MEANING[current.state as CredentialState] : undefined}
        status={
          current && (
            <MuStatus
              label={STATE_LABELS[current.state as CredentialState] ?? current.state}
              tone={credTone(current.state)}
            />
          )
        }
        decisions={
          current && (
            current.row?.evidence_document_id ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-none"
                  disabled={busy === current.credential_type}
                  onClick={() => review(current.credential_type, "fail")}
                >
                  <X className="mr-1.5 h-4 w-4" />Fail review
                </Button>
                <Button
                  className="rounded-none"
                  disabled={busy === current.credential_type}
                  onClick={() => review(current.credential_type, "pass")}
                >
                  <Check className="mr-1.5 h-4 w-4" />Pass review
                </Button>
              </>
            ) : documents.length ? (
              <Select
                value={undefined}
                onValueChange={(v) => attach(current.credential_type, v)}
                disabled={busy === current.credential_type}
              >
                <SelectTrigger className="h-10 w-[16rem] rounded-none text-sm">
                  <SelectValue placeholder="Attach a document as evidence" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-[13.5px] text-muted-foreground">
                No document is held for this person, so there is nothing to attach.
              </span>
            )
          )
        }
      >
        {current && (
          <MuDetailFacts
            rows={[
              {
                label: "What they told us",
                value: current.row?.claim === "yes"
                  ? `Yes. ${provenanceLabel(current.row.claim_source)}.`
                  : current.row?.claim === "no"
                    ? `No. ${provenanceLabel(current.row.claim_source)}.`
                    : "Nothing has been declared.",
              },
              {
                label: "Evidence on file",
                value: currentDoc
                  ? currentDoc.label
                  : current.row?.evidence_document_id
                    ? "A document is attached."
                    : "No document is attached.",
              },
              { label: "Reviewed", value: day(current.row?.verified_at) ?? "Not reviewed." },
              { label: "Expires", value: day(current.row?.expires_at) ?? "No expiry is held." },
              { label: "What this tier means", value: STATE_MEANING[current.state as CredentialState] },
            ]}
          />
        )}
        <div className="border-t border-line bg-muted/30 px-5 py-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            <FileText className="mr-1.5 inline h-3.5 w-3.5" />
            A credential advances only when a document is attached and passed. A yes on a form is a claim, never
            evidence.
          </p>
        </div>
      </MuDetailSheet>
    </div>
  );
};

export default CredentialsPanel;
