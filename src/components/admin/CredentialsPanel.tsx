// What a person's documents prove, read only.
//
// A credential is settled by the decision on the document that proves it:
// accepting a practising licence passes the licence (see the
// mu_document_settles_credentials trigger). So this is a summary under the
// documents, never a second place to judge the same thing.
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, ShieldCheck } from "lucide-react";
import { adminDb } from "@/lib/admin-utils";
import { PersonDocument } from "@/lib/match-universe";
import { CREDENTIAL_LABELS, CREDENTIAL_TYPES, CredentialRow, CredentialState, STATE_LABELS } from "@/lib/credentials";
import { MuStatus, MuTone } from "@/components/admin/mu/MuShell";

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
  return (
    <MuStatus
      tone={credTone(state)}
      icon={state === "verified" ? ShieldCheck : undefined}
      label={STATE_LABELS[state as CredentialState] ?? state}
    />
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

const CredentialsPanel = ({ personId, documents }: Props) => {
  const [rows, setRows] = useState<(CredentialRow & { state: string })[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;

  // Read-only: a credential is settled by the decision on its document
  // (accept or return it above). Nobody judges the same licence twice.
  return (
    <table className="w-full border-collapse text-[14px]">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left">Credential</th>
          <th className="px-4 py-2 text-left">Standing</th>
          <th className="hidden px-4 py-2 text-left sm:table-cell">Proved by</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const doc = i.row?.evidence_document_id ? documents.find((d) => d.id === i.row!.evidence_document_id) : null;
          return (
            <tr key={i.credential_type} className="border-b border-line-soft last:border-b-0">
              <td className="px-4 py-3 font-bold text-navy">{CREDENTIAL_LABELS[i.credential_type as keyof typeof CREDENTIAL_LABELS]}</td>
              <td className="px-4 py-3"><CredentialBadge state={i.state} /></td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {doc
                  ? `${doc.label}${i.row?.verified_at ? `, accepted ${day(i.row.verified_at)}` : ""}${i.row?.expires_at ? `, expires ${day(i.row.expires_at)}` : ""}`
                  : i.row?.verification_method && i.row.verification_method !== "document_review"
                    ? "Checked another way"
                    : "Settled when its document is accepted"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default CredentialsPanel;
