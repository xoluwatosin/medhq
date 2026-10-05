// The review queue.
//
// It is document-centric on purpose. Anything a candidate or an admin uploads
// lands here the moment it arrives, whether or not it is attached to a
// credential. A document that nobody can see is a document nobody reviews.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useClearListParams, useListParam, useRestoreListParams } from "@/hooks/useListParam";
import { FilterChips } from "@/components/admin/FilterChips";

import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, CalendarDays, Check, Clock, ExternalLink, FileText, Flame, Inbox, Loader2,
  Mail, ScanLine, Search, ShieldCheck, StickyNote, Tag, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { openDocumentTab } from "@/lib/documents";
import { CREDENTIAL_LABELS, CredentialType } from "@/lib/credentials";
import { initialsOf } from "@/lib/match-universe";
import {
  MuEmpty, MuField, MuFieldGrid, MuNote, MuPage, MuPageHeader, MuRecord, MuSection, MuStats,
  MuStatus, MuToolbar,
} from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { AcceptForNowDialog, ReturnDocumentDialog, decideDocument } from "@/components/admin/mu/DocumentDecision";

interface QueueRow {
  document_id: string;
  person_id: string;
  full_name: string;
  person_email: string | null;
  label: string;
  url: string;
  doc_type: string | null;
  review_outcome: string;
  source_table: string | null;
  source_note: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  expires_at: string | null;
  credential_type: string | null;
  is_required: boolean;
  on_active_shortlist: boolean;
  shortlist_count: number;
  hold_reason: string | null;
  read_state: string | null;
}

const sourceLabel = (r: QueueRow) => {
  if (r.source_table === "admin_upload") return `Filed by ${r.uploaded_by_name || "an admin"}`;
  if (r.source_table === "portal") return "Uploaded by the candidate";
  if (r.source_table === "join_applications") return "Came with a join application";
  if (r.source_table === "matchmaker_applications") return "Came with an application";
  return "Uploaded";
};







const MatchUniverseVerification = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<QueueRow[]>([]);
  // The whole backlog, which can be larger than the batch we list.
  const [backlog, setBacklog] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters live in the address bar and the queue remembers the last set used.
  useRestoreListParams();
  const clearParams = useClearListParams();
  const [q, setQ] = useListParam<string>("q", "");
  const [typeFilter, setTypeFilter] = useListParam<string>("type", "all");
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const [reject, setReject] = useState<QueueRow | null>(null);

  // Conditional acceptance: the copy we hold is out of date, but it is good
  // enough to work with while the candidate fetches a current one.
  const [cond, setCond] = useState<QueueRow | null>(null);

  // What each kind of document proves, so a pending file says what
  // accepting it will settle.
  const [proves, setProves] = useState<Record<string, string[]>>({});
  useEffect(() => {
    void (adminDb() as any).from("mu_document_types").select("code, evidences").then(({ data }: any) => {
      setProves(Object.fromEntries((data ?? []).map((t: any) => [t.code, t.evidences ?? []])));
    });
  }, []);

  const load = useCallback(async () => {
    const [{ data, error }, { data: total }] = await Promise.all([
      (adminDb() as any).rpc("mu_review_queue", { _limit: 1000 }),
      (adminDb() as any).rpc("mu_review_queue_count"),
    ]);
    if (error) toast({ title: "Could not load the queue", description: error.message, variant: "destructive" });
    setRows((data ?? []) as QueueRow[]);
    setBacklog(typeof total === "number" ? total : (data ?? []).length);
    setLoading(false);
  }, [toast]);



  useEffect(() => { load(); }, [load]);

  // Everything the logic can decide on its own: readable, clearly the person's,
  // confidently classified and in date is accepted; the rest keeps a hold reason
  // and, where only the candidate can settle it, becomes a request in the portal.
  const settleAll = async () => {
    setBusy("settle");
    const { data, error } = await (adminDb() as any).rpc("mu_autosettle_documents", { _limit: 2000 });
    setBusy(null);
    if (error) {
      toast({ title: "Could not settle the queue", description: error.message, variant: "destructive" });
      return;
    }
    const r = (data ?? {}) as { accepted?: number; held?: number; asked?: number };
    toast({
      title: `${r.accepted ?? 0} accepted automatically`,
      description: `${r.held ?? 0} held for a human, ${r.asked ?? 0} sent back to the candidate as a request.`,
    });
    load();
  };



  const docTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.doc_type || "Other"))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && (r.doc_type || "Other") !== typeFilter) return false;
      if (!s) return true;
      return `${r.full_name} ${r.person_email ?? ""} ${r.label} ${r.doc_type ?? ""}`.toLowerCase().includes(s);
    });
  }, [rows, q, typeFilter]);

  const open = async (url: string) => {
    const ok = await openDocumentTab(url);
    if (!ok) toast({ title: "Could not open the file", variant: "destructive" });
  };


  const review = async (
    row: QueueRow,
    outcome: "accepted" | "rejected" | "conditional",
    why = "",
    tellThem = true,
    conditionalUntil: string | null = null,
  ) => {
    setBusy(row.document_id);
    const result = await decideDocument({
      documentId: row.document_id,
      outcome,
      reason: why,
      until: conditionalUntil,
      expiresAt: row.expires_at,
      notify: tellThem,
      canEmail: !!row.person_email,
    });
    if (result.error) {
      setBusy(null);
      toast({ title: "Could not record the review", description: result.error, variant: "destructive" });
      return;
    }
    if (result.mailError) toast({ title: "Reviewed, but the email did not send", description: result.mailError, variant: "destructive" });
    const emailed = result.emailed;
    setBusy(null);
    setReject(null);
    setCond(null);
    toast({
      title: outcome === "accepted"
        ? "Document accepted"
        : outcome === "conditional"
          ? "Document accepted for now"
          : "Document returned",
      description: emailed ? `${row.full_name} has been emailed.` : "No email sent.",
    });

    setRows((prev) => prev.filter((r) => r.document_id !== row.document_id));
    setBacklog((n) => Math.max(0, n - 1));
  };


  // Accepting many at once. Rejection stays one at a time on purpose: a reason
  // written to one person is not a reason that fits five.
  const acceptMany = async () => {
    const chosen = filtered.filter((r) => picked.includes(r.document_id));
    if (!chosen.length) return;
    setBusy("bulk");
    const done: string[] = [];
    const failed: string[] = [];
    for (const row of chosen) {
      const { error } = await (adminDb() as any).rpc("mu_review_document", {
        _document_id: row.document_id,
        _outcome: "accepted",
        _reason: null,
        _expires_at: row.expires_at || null,
      });
      // An acceptance asks nothing of the candidate, so no email is sent.
      (error ? failed : done).push(row.document_id);
    }
    setBusy(null);
    toast(
      failed.length
        ? { title: `${done.length} accepted, ${failed.length} could not be`, description: "Those are still in the queue and still ticked. Try them one at a time.", variant: "destructive" }
        : { title: `${done.length} document${done.length === 1 ? "" : "s"} accepted` },
    );
    setRows((prev) => prev.filter((r) => !done.includes(r.document_id)));
    setPicked(failed);
    setBacklog((n) => Math.max(0, n - done.length));
    setPicked([]);

  };

  const toggle = (docId: string) =>
    setPicked((p) => (p.includes(docId) ? p.filter((x) => x !== docId) : [...p, docId]));

  const pressured = filtered.filter((r) => r.on_active_shortlist).length;
  const today = new Date().toDateString();
  const arrivedToday = rows.filter((r) => new Date(r.created_at).toDateString() === today).length;

  return (
    <MuPage>
      <MuPageHeader
        backTo="/admin/match-universe"
        backLabel="Talent pool"
        title="Document review"
        description="Documents awaiting a decision, most urgent first. Uploads from the portal, applications and admin all arrive here."
      />

      <MuStats
        columns={3}
        stats={[
          { label: "Waiting on review", value: rows.length, icon: Inbox, tone: rows.length ? "attention" : "default" },
          { label: "Arrived today", value: arrivedToday, icon: Clock },
          { label: "On a live shortlist", value: pressured, icon: Flame, hint: "Review these first." },
        ]}
      />

      <MuToolbar>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or document"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full bg-background lg:w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All document types</SelectItem>
            {docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={busy === "settle"} onClick={settleAll} className="shrink-0">
          {busy === "settle"
            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            : <ShieldCheck className="mr-1.5 h-4 w-4" />}
          Settle what we can
        </Button>
      </MuToolbar>
      <FilterChips
        filters={[
          ...(q ? [{ key: "q", label: `Search: ${q}`, onRemove: () => setQ("") }] : []),
          ...(typeFilter !== "all" ? [{ key: "type", label: typeFilter, onRemove: () => setTypeFilter("all") }] : []),
        ]}
        onClearAll={() => clearParams(["q", "type"])}
      />

      <MuSection
        title={
          filtered.length === rows.length
            ? `${backlog} document${backlog === 1 ? "" : "s"} to review`
            : `${filtered.length} of ${backlog} document${backlog === 1 ? "" : "s"} to review`
        }
        description={
          rows.length < backlog
            ? `Open the file, then accept it or return it with a reason. Showing the first ${rows.length}, most urgent first.`
            : "Open the file, then accept it or return it with a reason. Accepting a document settles what it proves."
        }

        padded={false}
        actions={
          filtered.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Checkbox
                checked={picked.length > 0 && picked.length === filtered.length}
                onCheckedChange={(v) => setPicked(v ? filtered.map((r) => r.document_id) : [])}
                aria-label="Select every document"
              />
              <span className="text-xs text-muted-foreground">
                {picked.length ? `${picked.length} selected` : "Select all"}
              </span>
              {picked.length > 0 && (
                <Button size="sm" disabled={busy === "bulk"} onClick={acceptMany}>
                  {busy === "bulk"
                    ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    : <Check className="mr-1.5 h-4 w-4" />}
                  Accept {picked.length}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {loading && (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}

        {!loading && filtered.length === 0 && (
          <MuEmpty
            art={art.objDocumentMagnifier}
            title="Nothing to review"
            description="All documents have been accepted or returned. New uploads appear here immediately."
          />
        )}

        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-line-soft">
            {filtered.map((r) => (
              <li key={r.document_id}>
                <MuRecord
                  lead={
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-3 shrink-0"
                        checked={picked.includes(r.document_id)}
                        onCheckedChange={() => toggle(r.document_id)}
                        aria-label={`Select ${r.label}`}
                      />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-tint text-sm font-bold text-navy">
                        {initialsOf(r.full_name)}
                      </span>
                    </div>
                  }
                  title={
                    <Link
                      to={`/admin/match-universe/${r.person_id}?tab=verification`}
                      className="hover:underline underline-offset-4"
                    >
                      {r.full_name || "Unnamed person"}
                    </Link>
                  }
                  subtitle={
                    r.person_email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{r.person_email}</span>
                      </span>
                    ) : undefined
                  }
                  status={
                    <>
                      {r.is_required && <MuStatus label="Required" tone="info" icon={ShieldCheck} />}
                      {r.review_outcome === "accepted" && (
                        <MuStatus label="Accepted before, now expired" tone="bad" icon={AlertTriangle} />
                      )}
                      {r.on_active_shortlist && (
                        <MuStatus
                          tone="warning"
                          icon={Flame}
                          label={`On ${r.shortlist_count} live shortlist${r.shortlist_count === 1 ? "" : "s"}`}
                        />
                      )}
                    </>
                  }
                  fields={
                    <MuFieldGrid>
                      <MuField label="Document" icon={FileText}>
                        <button
                          type="button"
                          onClick={() => open(r.url)}
                          className="inline-flex max-w-full items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                        >
                          <span className="truncate">{r.label}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      </MuField>
                      <MuField label="Kind" icon={Tag} value={r.doc_type || "Not classified"} />
                      <MuField
                        label="Proves"
                        icon={ShieldCheck}
                        value={
                          (r.credential_type ? [r.credential_type] : proves[r.doc_type ?? ""] ?? []).length
                            ? (r.credential_type ? [r.credential_type] : proves[r.doc_type ?? ""])
                                .map((t) => CREDENTIAL_LABELS[t as CredentialType] ?? t).join(", ")
                            : "Nothing on its own"
                        }
                      />
                      <MuField label="Arrived" icon={Clock}>
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        <span className="block text-xs text-muted-foreground">{sourceLabel(r)}</span>
                      </MuField>
                      {r.expires_at && (
                        <MuField
                          label="Expires"
                          icon={CalendarDays}
                          value={new Date(r.expires_at).toLocaleDateString("en-GB")}
                        />
                      )}
                      {r.read_state === "unread" && (
                        <MuField label="Automatic read" icon={ScanLine} value="Not processed" />
                      )}
                    </MuFieldGrid>
                  }
                  notes={
                    r.hold_reason || r.source_note ? (
                      <>
                        {r.hold_reason && (
                          <MuNote title="Hold reason" tone="warning" icon={AlertTriangle}>
                            {r.hold_reason}
                          </MuNote>
                        )}
                        {r.source_note && (
                          <MuNote title="Note on file" icon={StickyNote}>{r.source_note}</MuNote>
                        )}
                      </>
                    ) : undefined
                  }
                  actions={
                    <>
                      <Button size="sm" variant="ghost" onClick={() => open(r.url)}>
                        <ExternalLink className="mr-1.5 h-4 w-4" />Open the file
                      </Button>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.document_id}
                          onClick={() => setReject(r)}
                        >
                          <X className="mr-1.5 h-4 w-4" />Return with a reason
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.document_id}
                          onClick={() => setCond(r)}
                        >
                          <CalendarDays className="mr-1.5 h-4 w-4" />Accept for now
                        </Button>

                        <Button size="sm" disabled={busy === r.document_id} onClick={() => review(r, "accepted")}>
                          {busy === r.document_id
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Check className="mr-1.5 h-4 w-4" />}
                          Accept
                        </Button>
                      </div>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}

      </MuSection>







      <AcceptForNowDialog
        open={!!cond}
        name={cond?.full_name || "the candidate"}
        expired={!!cond?.expires_at && new Date(cond.expires_at) < new Date()}
        busy={busy === cond?.document_id}
        onCancel={() => setCond(null)}
        onConfirm={(why, until, tell) => cond && review(cond, "conditional", why, tell, until)}
      />

      <ReturnDocumentDialog
        open={!!reject}
        name={reject?.full_name || "The candidate"}
        busy={busy === reject?.document_id}
        onCancel={() => setReject(null)}
        onConfirm={(why, tell) => reject && review(reject, "rejected", why, tell)}
      />
    </MuPage>
  );
};

export default MatchUniverseVerification;
