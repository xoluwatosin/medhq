// The review queue.
//
// It is document-centric on purpose. Anything a candidate or an admin uploads
// lands here the moment it arrives, whether or not it is attached to a
// credential. A document that nobody can see is a document nobody reviews.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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





// The reasons we send something back, in the words the candidate reads.
const REJECT_REASONS = [
  "We cannot read this copy clearly enough to accept it.",
  "This is not the document we asked for.",
  "This document has already expired.",
  "The name on this document does not match the name on your profile.",
  "Part of the document is missing or cut off.",
];

// Why we would accept an out of date copy for the time being.
const CONDITIONAL_REASONS = [
  "The copy we hold has expired, so we are accepting it while you send a current one.",
  "Renewal is already under way with the licensing body.",
  "Accepted for this placement only, pending an in date copy.",
];

const toISO = (d: Date) => d.toISOString().slice(0, 10);
/** A sensible chase date: about three months out. */
const defaultReviewDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return toISO(d);
};
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISO(d);
};


const MatchUniverseVerification = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<QueueRow[]>([]);
  // The whole backlog, which can be larger than the batch we list.
  const [backlog, setBacklog] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const [reject, setReject] = useState<QueueRow | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);

  // Conditional acceptance: the copy we hold is out of date, but it is good
  // enough to work with while the candidate fetches a current one.
  const [cond, setCond] = useState<QueueRow | null>(null);
  const [condUntil, setCondUntil] = useState("");
  const [condWhy, setCondWhy] = useState("");
  const [condNotify, setCondNotify] = useState(true);

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
    const { error } = await (adminDb() as any).rpc("mu_review_document", {
      _document_id: row.document_id,
      _outcome: outcome,
      _reason: why || null,
      _expires_at: row.expires_at || null,
      _conditional_until: conditionalUntil,
    });
    if (error) {
      setBusy(null);
      toast({ title: "Could not record the review", description: error.message, variant: "destructive" });
      return;
    }
    // We write to a candidate only when something is needed of them. An
    // acceptance asks nothing, so it sends no email. A conditional acceptance
    // does ask for an in date copy, so it can.
    const emailed = outcome !== "accepted" && tellThem && !!row.person_email;
    if (emailed) {
      const { error: mailErr } = await supabase.functions.invoke("notify-candidate-document", {
        body: { document_id: row.document_id },
      });
      if (mailErr) toast({ title: "Reviewed, but the email did not send", description: mailErr.message, variant: "destructive" });
    }
    setBusy(null);
    setReject(null);
    setReason("");
    setCond(null);
    setCondUntil("");
    setCondWhy("");
    toast({
      title: outcome === "accepted"
        ? "Document accepted"
        : outcome === "conditional"
          ? "Document accepted for now"
          : "Document not accepted",
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
    for (const row of chosen) {
      await (adminDb() as any).rpc("mu_review_document", {
        _document_id: row.document_id,
        _outcome: "accepted",
        _reason: null,
        _expires_at: row.expires_at || null,
      });
      // An acceptance asks nothing of the candidate, so no email is sent.

    }
    setBusy(null);
    toast({ title: `${chosen.length} document${chosen.length === 1 ? "" : "s"} accepted` });
    setRows((prev) => prev.filter((r) => !picked.includes(r.document_id)));
    setBacklog((n) => Math.max(0, n - chosen.length));
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
        backLabel="Match Universe"
        title="Document review"
        description="Documents awaiting a decision, most urgent first. Uploads from the portal, applications and admin all arrive here."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/match-universe/intake"><ShieldCheck className="mr-2 h-4 w-4" />Intake</Link>
          </Button>
        }
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

      <MuSection
        title={
          filtered.length === rows.length
            ? `${backlog} document${backlog === 1 ? "" : "s"} to review`
            : `${filtered.length} of ${backlog} document${backlog === 1 ? "" : "s"} to review`
        }
        description={
          rows.length < backlog
            ? `Open the file, then accept it or return it with a reason. Showing the first ${rows.length}, most urgent first.`
            : "Open the file, then accept it or return it with a reason. Accepting verifies the linked credential."
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
            icon={Inbox}
            title="Nothing to review"
            description="All documents have been accepted or returned. New uploads appear here immediately."
          />
        )}

        {!loading && filtered.length > 0 && (
          <ul className="divide-y divide-border/60">
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
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
                          r.credential_type
                            ? CREDENTIAL_LABELS[r.credential_type as CredentialType] ?? r.credential_type
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
                          onClick={() => { setReject(r); setReason(""); setNotify(true); }}
                        >
                          <X className="mr-1.5 h-4 w-4" />Return with a reason
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.document_id}
                          onClick={() => {
                            setCond(r);
                            setCondWhy(
                              r.expires_at && new Date(r.expires_at) < new Date()
                                ? "The copy we hold has expired, so we are accepting it while you send a current one."
                                : "",
                            );
                            setCondUntil(defaultReviewDate());
                            setCondNotify(true);
                          }}
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







      <Dialog open={!!cond} onOpenChange={(o) => !o && setCond(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept for now</DialogTitle>
            <DialogDescription>
              The document counts as in place until the review date. After that it comes back to this
              queue as expired, and {cond?.full_name || "the candidate"} is asked for a current copy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {CONDITIONAL_REASONS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={condWhy === preset ? "default" : "outline"}
                  className="h-auto whitespace-normal py-1.5 text-left text-xs"
                  onClick={() => setCondWhy(preset)}
                >
                  {preset.replace(/\.$/, "")}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cond-until">Review date</Label>
              <Input
                id="cond-until"
                type="date"
                min={tomorrow()}
                value={condUntil}
                onChange={(e) => setCondUntil(e.target.value)}
              />
            </div>
            <Label htmlFor="cond-why">Why we are accepting it for now</Label>
            <Textarea
              id="cond-why"
              rows={3}
              value={condWhy}
              onChange={(e) => setCondWhy(e.target.value)}
              placeholder="Renewal is under way, so we will work with this copy until the new one arrives."
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={condNotify} onCheckedChange={(v) => setCondNotify(!!v)} />
              Email them what is still needed
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCond(null)}>Cancel</Button>
            <Button
              disabled={!condWhy.trim() || !condUntil || busy === cond?.document_id}
              onClick={() => cond && review(cond, "conditional", condWhy.trim(), condNotify, condUntil)}
            >
              {busy === cond?.document_id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept until this date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return document</DialogTitle>
            <DialogDescription>
              {reject?.full_name} will see this reason on their account, so write it as you would say it to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={reason === preset ? "default" : "outline"}
                  className="h-auto whitespace-normal py-1.5 text-left text-xs"
                  onClick={() => setReason(preset)}
                >
                  {preset.replace(/\.$/, "")}
                </Button>
              ))}
            </div>
            <Label htmlFor="reason">Reason for return</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The copy is cut off at the bottom, so the expiry date is not readable."
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
              Email them the reason
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy === reject?.document_id}
              onClick={() => reject && review(reject, "rejected", reason.trim(), notify)}
            >
              {busy === reject?.document_id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MuPage>
  );
};

export default MatchUniverseVerification;
