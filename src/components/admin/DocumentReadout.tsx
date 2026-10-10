// What the document reader made of a file.
//
// This is a read of the document, not a verification of it. It shows the kind
// the reader settled on, how sure it was, what it pulled out, and anything that
// does not sit right - a name that is not the candidate's, or an expiry in the
// past. An admin still has to accept or reject.
import { useEffect, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { MuStatus } from "@/components/admin/mu/MuShell";
import { adminDb } from "@/lib/admin-utils";

const KIND_LABELS: Record<string, string> = {
  practising_licence: "Practising licence",
  registration_certificate: "Registration certificate",
  qualification_certificate: "Qualification certificate",
  training_certificate: "Training certificate",
  nysc: "NYSC",
  government_id: "Government ID",
  right_to_work: "Right to work",
  reference_letter: "Reference letter",
  service_letter: "Service letter",
  police_clearance: "Police clearance",
  medical_fitness: "Medical fitness",
  proof_of_address: "Proof of address",
  cv: "CV",
  other: "Other",
};

interface Readout {
  doc_type: string;
  classification_confidence: number | null;
  classification_evidence: string | null;
  extraction: Record<string, unknown> | null;
  quality: Record<string, unknown> | null;
  error: string | null;
}

const pretty = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const readable = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") return null;
  return String(value);
};

const DocumentReadout = ({ documentId }: { documentId: string }) => {
  const [row, setRow] = useState<Readout | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await adminDb()
        .from("mu_document_extractions")
        .select("doc_type, classification_confidence, classification_evidence, extraction, quality, error")
        .eq("document_id", documentId)
        .maybeSingle();
      if (live) setRow((data as unknown as Readout) ?? null);
    })();
    return () => { live = false; };
  }, [documentId]);

  if (!row) return null;

  if (row.error) {
    return (
      <p className="bg-muted/60 p-2 text-xs text-muted-foreground">
        The reader could not open this one: {row.error}
      </p>
    );
  }

  const fields = Object.entries(row.extraction ?? {})
    .map(([k, v]) => [k, readable(v)] as const)
    .filter(([, v]) => v !== null)
    .slice(0, 8);

  const quality = row.quality ?? {};
  const warnings: string[] = [];
  if (quality.belongs_to_holder === false) warnings.push("The name on this document does not match the candidate");
  if (quality.expired === true) warnings.push("The date on this document has passed");
  if (quality.legible === false) warnings.push("Hard to read, worth checking by eye");
  const confidence = row.classification_confidence ?? 0;
  if (confidence > 0 && confidence < 0.7) warnings.push("The reader was not sure what kind of document this is");

  return (
    <div className="space-y-2 border border-line-soft bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Read as {KIND_LABELS[row.doc_type] ?? row.doc_type}</span>
        {confidence > 0 && (
          <MuStatus tone="neutral" label={`${Math.round(confidence * 100)}% sure`} />
        )}
        <span className="text-[11px] text-muted-foreground">Read, not verified</span>
      </div>

      {row.classification_evidence && (
        <p className="text-[11px] italic text-muted-foreground">“{row.classification_evidence}”</p>
      )}

      {fields.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="shrink-0 text-muted-foreground">{pretty(k)}:</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}
        </p>
      ))}
    </div>
  );
};

export default DocumentReadout;
