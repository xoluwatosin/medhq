// Open document requests, shared by the admin profile and the candidate portal.
//
// A request is a record, not just an email. It closes itself the moment a
// document of that type lands — whoever uploads it — so the two sides of the
// system always show the same outstanding list.
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { candidateOperationalNote } from "@/lib/candidate-field-copy";

export interface DocumentRequest {
  id: string;
  doc_type: string;
  note: string | null;
  due_by: string | null;
  status: string;
  requested_by_name: string | null;
  created_at: string;
  fulfilled_at: string | null;
}

export async function loadDocumentRequests(personId: string): Promise<DocumentRequest[]> {
  const { data } = await supabase
    .from("mu_document_requests" as any)
    .select("id, doc_type, note, due_by, status, requested_by_name, created_at, fulfilled_at")
    .eq("person_id", personId)
    .order("created_at", { ascending: false });
  return ((data as any) ?? []) as DocumentRequest[];
}

interface Props {
  personId: string;
  mode: "admin" | "candidate";
  refreshKey?: number;
  onChanged?: () => void;
  /** Candidate portal: tapping an open request opens the file picker for it. */
  onPick?: (docType: string) => void;
  uploadingType?: string | null;
}

const DocumentRequestList = ({ personId, mode, refreshKey = 0, onChanged, onPick, uploadingType }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await loadDocumentRequests(personId));
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const cancel = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("mu_cancel_document_request" as any, { _id: id });
    setBusy(null);
    if (error) {
      toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request cancelled" });
    load();
    onChanged?.();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;

  const open = rows.filter((r) => r.status === "open");
  const recent = rows.filter((r) => r.status !== "open").slice(0, 4);

  if (open.length === 0 && recent.length === 0) return null;

  return (
    <div className="space-y-2">
      {open.map((r) => {
        const pickable = mode === "candidate" && !!onPick;
        const uploading = uploadingType === r.doc_type;
        const body = (
          <>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{r.doc_type}</p>
                <Badge variant="secondary" className="rounded-full">
                  <Clock className="mr-1 h-3 w-3" />Requested
                </Badge>
                {r.due_by && (
                  <span className="text-xs text-muted-foreground">by {format(new Date(r.due_by), "d MMM yyyy")}</span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {mode === "candidate"
                  ? candidateOperationalNote(r.note, "Please upload this so we can put you forward for work.")
                  : r.note?.trim() || "No note was added."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {mode === "admin"
                  ? `Asked ${format(new Date(r.created_at), "d MMM yyyy")}${r.requested_by_name ? ` by ${r.requested_by_name}` : ""}`
                  : `Asked ${format(new Date(r.created_at), "d MMM yyyy")}`}
              </p>
            </div>
            {mode === "admin" ? (
              <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => cancel(r.id)}>
                <X className="mr-1.5 h-4 w-4" />Cancel
              </Button>
            ) : pickable ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-brand">
                {uploading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading</>
                  : <><Upload className="h-4 w-4" />Tap to upload</>}
              </span>
            ) : null}
          </>
        );
        const shell = "flex w-full flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-left";
        return pickable ? (
          <button
            key={r.id}
            type="button"
            disabled={!!uploadingType}
            onClick={() => onPick!(r.doc_type)}
            className={`${shell} transition-colors hover:bg-amber-500/10 disabled:opacity-60`}
          >
            {body}
          </button>
        ) : (
          <div key={r.id} className={shell}>{body}</div>
        );
      })}

      {recent.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
          <p className="text-sm">{r.doc_type}</p>
          <Badge variant={r.status === "fulfilled" ? "default" : "outline"} className="rounded-full">
            {r.status === "fulfilled" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
            {r.status === "fulfilled"
              ? `Received${r.fulfilled_at ? ` ${format(new Date(r.fulfilled_at), "d MMM")}` : ""}`
              : "Cancelled"}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default DocumentRequestList;
