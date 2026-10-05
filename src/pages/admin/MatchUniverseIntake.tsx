// Intake.
//
// The front of the funnel in one screen: who arrived, what they sent, what the
// parser could not read, and every backlog that quietly builds up behind the
// pool. Nothing here is new data, it is the data that had nowhere to be seen.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle, Clock, FileText, FileWarning, Inbox, Loader2, RefreshCw, Repeat, ShieldCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStats, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

interface Health {
  people_total: number;
  people_today: number;
  people_week: number;
  docs_pending: number;
  docs_today: number;
  docs_by_source: Record<string, number>;
  parse_status: Record<string, number>;
  no_cv: number;
  parsed_pending: number;
  conflicts_open: number;
  merges_open: number;
  uninvited: number;
  invited_unclaimed: number;
}

interface BacklogRow {
  person_id: string;
  full_name: string;
  email: string | null;
  parse_status: string | null;
  has_cv: boolean;
  cv_label: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  join_applications: "Join application",
  matchmaker_applications: "Matchmaker application",
  portal: "Candidate portal",
  admin_upload: "Filed by an admin",
};

const MatchUniverseIntake = () => {
  const { toast } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [backlog, setBacklog] = useState<BacklogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: h, error: he }, { data: b }] = await Promise.all([
      (adminDb() as any).rpc("mu_intake_health"),
      (adminDb() as any).rpc("mu_parse_backlog", { _limit: 60 }),
    ]);
    if (he) toast({ title: "Could not load intake health", description: he.message, variant: "destructive" });
    setHealth((h ?? null) as Health | null);
    setBacklog((b ?? []) as BacklogRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const retry = async (row: BacklogRow) => {
    setBusy(row.person_id);
    await (adminDb() as any).rpc("mu_requeue_parse", { _person_id: row.person_id });
    await supabase.functions.invoke("parse-cv", { body: { person_id: row.person_id } }).catch(() => null);
    setBusy(null);
    toast({ title: "Queued for another read", description: `${row.full_name}'s CV is being read again.` });
    load();
  };

  const sweep = async () => {
    setBusy("sweep");
    const { data, error } = await (adminDb() as any).rpc("mu_expire_documents");
    setBusy(null);
    if (error) { toast({ title: "Sweep failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Expiry sweep done", description: `${(data as any)?.expired ?? 0} document(s) returned to the queue.` });
    load();
  };

  const scanNames = async () => {
    setBusy("scan");
    const { data, error } = await (adminDb() as any).rpc("mu_scan_name_duplicates");
    setBusy(null);
    if (error) { toast({ title: "Scan failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Duplicate scan done", description: `${(data as any)?.raised ?? 0} new suspect pair(s) raised.` });
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <MuPage>
      <MuPageHeader
        title="Intake"
        description="Application sources and any records stalled during intake."
        actions={
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        }
      />

      <MuStats
        columns={4}
        stats={[
          { label: "People in the candidate pool", value: health?.people_total ?? 0, icon: Users, hint: `${health?.people_week ?? 0} joined this week`, to: "/admin/match-universe?view=all" },
          {
            label: "Documents to review",
            value: health?.docs_pending ?? 0,
            icon: Inbox,
            tone: (health?.docs_pending ?? 0) > 0 ? "attention" : "default",
            hint: `${health?.docs_today ?? 0} arrived today`,
            to: "/admin/match-universe/verification",
          },
          {
            label: "Awaiting candidate response",
            value: health?.parsed_pending ?? 0,
            icon: FileWarning,
            tone: (health?.parsed_pending ?? 0) > 0 ? "attention" : "default",
            hint: "Questions sitting in candidate accounts",
          },
          {
            label: "Duplicate suspects",
            value: health?.merges_open ?? 0,
            icon: AlertTriangle,
            tone: (health?.merges_open ?? 0) > 0 ? "attention" : "default",
            hint: `${health?.conflicts_open ?? 0} field conflicts open`,
            to: "/admin/match-universe/merges",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <MuSection title="Document sources">
          <ul className="space-y-2">
            {Object.entries(health?.docs_by_source ?? {}).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span>{SOURCE_LABELS[k] ?? k}</span>
                <MuStatus className="tabular-nums" label={v} />
              </li>
            ))}
            {Object.keys(health?.docs_by_source ?? {}).length === 0 && (
              <MuEmpty art={art.objFolderDocuments} title="Nothing on file yet" description="Files appear here as they arrive from each source." />
            )}
          </ul>
        </MuSection>

        <MuSection title="CV processing status">
          <ul className="space-y-2">
            {Object.entries(health?.parse_status ?? {}).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="capitalize">{k.replace(/_/g, " ")}</span>
                <MuStatus tone={k === "failed" ? "warning" : "neutral"} className="tabular-nums" label={v} />
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-line-soft pt-2 text-sm">
              <span>No CV on file at all</span>
              <MuStatus className="tabular-nums" label={health?.no_cv ?? 0} />
            </li>
          </ul>
        </MuSection>
      </div>

      <MuSection
        title="Portal access"
        description="Candidates need an invite to finish their profile."
        actions={
          <>
            <Button size="sm" variant="outline" disabled={busy === "sweep"} onClick={sweep}>
              {busy === "sweep" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Run expiry sweep
            </Button>
            <Button size="sm" variant="outline" disabled={busy === "scan"} onClick={scanNames}>
              {busy === "scan" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Repeat className="mr-2 h-4 w-4" />}
              Scan for same-name duplicates
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-line p-4">
            <p className="text-2xl font-semibold tabular-nums">{health?.uninvited ?? 0}</p>
            <p className="text-xs text-muted-foreground">have an email but have never been invited</p>
          </div>
          <div className="border border-line p-4">
            <p className="text-2xl font-semibold tabular-nums">{health?.invited_unclaimed ?? 0}</p>
            <p className="text-xs text-muted-foreground">were invited and have not signed in yet</p>
          </div>
        </div>
      </MuSection>

      <MuSection
        title={`${backlog.length} profile${backlog.length === 1 ? "" : "s"} the parser has not finished with`}
        padded={false}
      >
        {backlog.length === 0 && (
          <MuEmpty art={art.objDocumentMagnifier} title="All CVs have been processed" description="Nothing is waiting on the parser." />
        )}
        <ul className="divide-y divide-line-soft">
          {backlog.map((r) => (
            <li key={r.person_id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/match-universe/${r.person_id}?tab=profile`} className="text-sm font-medium hover:underline underline-offset-4">
                    {r.full_name || "Unnamed person"}
                  </Link>
                  <MuStatus tone={r.parse_status === "failed" ? "warning" : "neutral"} label={r.parse_status === "failed" ? "Read failed" : "Never read"} />
                  {!r.has_cv && <MuStatus label="No CV on file" />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {r.cv_label || r.email || "No contact on file"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Joined {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {r.has_cv ? (
                  <Button size="sm" variant="outline" disabled={busy === r.person_id} onClick={() => retry(r)}>
                    {busy === r.person_id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                    Read again
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/admin/match-universe/${r.person_id}?tab=verification`}>Chase a CV</Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </MuSection>
    </MuPage>
  );
};

export default MatchUniverseIntake;
