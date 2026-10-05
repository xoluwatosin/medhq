import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw, Brain, Megaphone, Globe, Send, AlertTriangle,
  CheckCircle2, Users, MailOpen, MousePointer, Fingerprint, FileCheck,
  ShieldCheck, Inbox, Download, Ban, Wrench,
} from "lucide-react";
import { adminDb, exportToCSV } from "@/lib/admin-utils";
import { toast } from "sonner";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";

const icons: Record<string, any> = {
  invited: MailOpen,
  claimed: Fingerprint,
  first_save: CheckCircle2,
  preferences: Users,
  documents: FileCheck,
  questions_clear: Brain,
  verified: ShieldCheck,
};

interface FunnelStage { stage: string; people: number }
interface Stuck { stuck_step: string; people: number }
interface CampaignStat {
  campaign_id: string; title: string; status: string; sent_at: string; tracking_enabled: boolean;
  sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number; claimed: number;
}
interface AcquisitionRow { source: string; medium: string; campaign: string; signups: number; enquiries: number }
interface FailureSummary { reason: string; failures: number; last_seen: string; distinct_people: number }
interface Alert {
  id: string; kind: string; title: string; detail: { reason?: string; failures_last_hour?: number };
  created_at: string; emailed_at: string | null; resolved_at: string | null;
}
interface QueueRow {
  id: string; person_id: string; email: string; reason: string; status: string;
  queued_at: string; sent_at: string | null;
  mu_people?: { id: string; full_name: string };
}
interface InvitedReportRow {
  email: string; invited_at: string; claimed_at: string | null; state: string;
  failure_reason: string | null; failure_at: string | null;
}
interface JourneyRow {
  person_id: string; full_name: string | null; email: string | null; stuck_step: string;
  invited_at: string | null; claimed_at: string | null; last_activity_at: string | null;
  questions_open: number; documents: number; profile_saves: number;
}

const stepLabel: Record<string, string> = {
  not_invited: "Not invited",
  awaiting_claim: "Awaiting claim",
  awaiting_first_save: "Awaiting first save",
  awaiting_preferences: "Awaiting preferences",
  awaiting_documents: "Awaiting documents",
  questions_outstanding: "Questions outstanding",
  awaiting_verification: "Awaiting verification",
  active: "Active",
};

interface AuditRow {
  id: string; run_id: string; check_key: string; metric: string; scope: string;
  dashboard_value: number | null; source_value: number | null; delta: number | null;
  severity: string; note: string; created_at: string;
}

const auditCheckLabel: Record<string, string> = {

  campaign_counter: "Campaign counter",
  tracking_label: "Tracking label",
  invited_at: "Invite dates",
  rollup: "Intelligence rollup",
};

const auditMetricLabel: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  not_tracked_label: '"Not tracked" label',
  people_invited: "People marked invited",
  linked_invites_without_date: "Invites with no date on the person",
  invited_without_invite_row: "Invite dates with no invite record",
  invited_people: "Invited people counted in the funnel",
  minutes_since_refresh: "Minutes since last refresh",
};


const stateLabel: Record<string, string> = {
  no_profile: "No profile",
  no_account: "No account",
  account_no_activity: "Account, no activity",
  active: "Active",
};

export default function Intelligence() {
  const [tab, setTab] = useState("health");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [stuck, setStuck] = useState<Stuck[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([]);
  const [acquisition, setAcquisition] = useState<AcquisitionRow[]>([]);
  const [failures, setFailures] = useState<FailureSummary[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [invitedReport, setInvitedReport] = useState<InvitedReportRow[]>([]);
  const [journey, setJourney] = useState<JourneyRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditing, setAuditing] = useState(false);
  const [reconciling, setReconciling] = useState(false);



  const db = adminDb();

  const load = async () => {
    setLoading(true);
    try {
      const [
        funnelRes, stuckRes, campaignsRes, acquisitionRes,
        failuresRes, alertsRes, queueRes, reportRes, journeyRes, refreshedRes,
      ] = await Promise.all([
        db.rpc("analytics_funnel"),
        db.rpc("analytics_stuck_breakdown"),
        db.rpc("analytics_campaigns"),
        db.rpc("analytics_acquisition"),
        db.rpc("analytics_signup_failure_summary"),
        db.from("admin_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
        db.from("followup_queue")
          .select("*, mu_people(id, full_name)")
          .in("status", ["pending", "held"])
          .order("queued_at", { ascending: true }),
        db.rpc("analytics_invited_report"),
        db.rpc("analytics_candidates"),
        db.rpc("analytics_last_refreshed"),
      ]);
      setFunnel(funnelRes.data ?? []);
      setStuck(stuckRes.data ?? []);
      setCampaigns(campaignsRes.data ?? []);
      setAcquisition(acquisitionRes.data ?? []);
      setFailures(failuresRes.data ?? []);
      setAlerts(alertsRes.data ?? []);
      setQueue(queueRes.data ?? []);
      setInvitedReport(reportRes.data ?? []);
      setJourney(journeyRes.data ?? []);
      setLastRefreshed(refreshedRes.data);
      const auditRes = await db.rpc("admin_metrics_audit_latest");
      setAudit((auditRes.data as AuditRow[]) ?? []);
    } catch (e) {
      toast.error("Could not load insights.");
      console.error(e);
    }
    setLoading(false);
  };

  const runReconcile = async () => {
    setReconciling(true);
    const { data, error } = await db.rpc("admin_metrics_audit_reconcile");
    if (error) toast.error(error.message);
    else {
      const rows = (data as { action: string; detail: string; affected: number }[]) ?? [];
      const total = rows.reduce((a, r) => a + (r.affected || 0), 0);
      toast.success(
        total
          ? `${total} record${total === 1 ? " was" : "s were"} put right. The figures have been rechecked.`
          : "Nothing needed putting right. The figures have been rechecked.",
      );
      const latest = await db.rpc("admin_metrics_audit_latest");
      setAudit((latest.data as AuditRow[]) ?? []);
    }
    setReconciling(false);
  };

  const runAudit = async () => {

    setAuditing(true);
    const { data, error } = await db.rpc("admin_metrics_audit_run");
    if (error) toast.error(error.message);
    else {
      const rows = (data as AuditRow[]) ?? [];
      setAudit(rows);
      const bad = rows.filter((r) => r.severity === "mismatch").length;
      toast[bad ? "warning" : "success"](
        bad ? `${bad} figure${bad === 1 ? "" : "s"} disagree with the records.` : "Every figure agrees with the records.",
      );
    }
    setAuditing(false);
  };

  useEffect(() => { load(); }, []);


  const doRefresh = async () => {
    setRefreshing(true);
    await db.rpc("analytics_refresh");
    await load();
    toast.success("Insights refreshed.");
    setRefreshing(false);
  };

  const resolveAlert = async (id: string) => {
    const { error } = await db.from("admin_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Alert resolved"); setAlerts((a) => a.filter((x) => x.id !== id)); }
  };

  const setQueueStatus = async (id: string, status: string) => {
    const { error } = await db.from("followup_queue").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "held" ? "Held back" : "Released");
      setQueue((q) => q.map((x) => x.id === id ? { ...x, status } : x));
    }
  };

  const sendNudges = async (ids?: string[]) => {
    const target = ids ?? queue.filter((q) => q.status === "pending").map((q) => q.id);
    if (!target.length) { toast.info("No pending nudges selected."); return; }
    try {
      const { data, error } = await db.functions.invoke("send-followup-nudge", {
        body: Array.isArray(ids) && ids.length ? { ids: target } : { all: true },
      });
      if (error) throw error;
      toast.success(`Sent ${data.sent} nudge${data.sent === 1 ? "" : "s"}.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Nudge send failed.");
    }
  };

  const downloadReport = () => {
    exportToCSV(
      invitedReport.map((r) => ({
        Email: r.email,
        Invited: r.invited_at ? new Date(r.invited_at).toLocaleString("en-GB") : "",
        Claimed: r.claimed_at ? new Date(r.claimed_at).toLocaleString("en-GB") : "No",
        State: stateLabel[r.state] || r.state,
        Failure_reason: r.failure_reason || "",
        Failure_at: r.failure_at ? new Date(r.failure_at).toLocaleString("en-GB") : "",
      })),
      "invited-report",
    );
  };

  const queuePendingCount = useMemo(() => queue.filter((q) => q.status === "pending").length, [queue]);
  const auditMismatches = useMemo(() => audit.filter((r) => r.severity === "mismatch").length, [audit]);
  const auditWarnings = useMemo(() => audit.filter((r) => r.severity === "warning").length, [audit]);


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold">Insights</h1>
          <p className="text-sm text-muted-foreground">
            Behavioural intake health, campaign funnels, and candidate flow diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Refreshed {lastRefreshed ? new Date(lastRefreshed).toLocaleString("en-GB") : "never"}
          </span>
          <Button size="sm" variant="outline" onClick={doRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {alerts.length} unresolved alert{alerts.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-amber-800">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>{a.title} {a.detail?.reason ? `(${a.detail.reason})` : ""}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-amber-700" onClick={() => resolveAlert(a.id)}>
                      Mark resolved
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="health"><Brain className="h-4 w-4 mr-1" /> Health</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="h-4 w-4 mr-1" /> Campaigns</TabsTrigger>
          <TabsTrigger value="acquisition"><Globe className="h-4 w-4 mr-1" /> Acquisition</TabsTrigger>
          <TabsTrigger value="queue"><Inbox className="h-4 w-4 mr-1" /> Queue <Badge variant="secondary" className="ml-1">{queuePendingCount}</Badge></TabsTrigger>
          <TabsTrigger value="report"><Users className="h-4 w-4 mr-1" /> Invited report</TabsTrigger>
          <TabsTrigger value="audit">
            <ShieldCheck className="h-4 w-4 mr-1" /> Audit
            {auditMismatches > 0 && <Badge variant="destructive" className="ml-1">{auditMismatches}</Badge>}
          </TabsTrigger>
        </TabsList>


        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {funnel.map((f) => {
              const Icon = icons[f.stage] || Brain;
              return (
                <Card key={f.stage} className="text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{f.stage.replace(/_/g, " ")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{Number(f.people).toLocaleString()}</div>
                    <Icon className="h-4 w-4 mx-auto mt-2 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Where candidates are stuck</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead className="text-right">People</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stuck.map((s) => (
                        <TableRow key={s.stuck_step}>
                          <TableCell>{stepLabel[s.stuck_step] || s.stuck_step}</TableCell>
                          <TableCell className="text-right font-medium">{Number(s.people).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {!stuck.length && (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ConsoleMobileList
                  emptyLabel="No data yet"
                  rows={stuck.map((s) => ({
                    key: s.stuck_step,
                    title: stepLabel[s.stuck_step] || s.stuck_step,
                    state: `${Number(s.people).toLocaleString()} people`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Sign-up failures (last 30 days)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failures.map((f) => (
                        <TableRow key={f.reason}>
                          <TableCell className="font-mono text-xs">{f.reason}</TableCell>
                          <TableCell className="text-right font-medium">{Number(f.failures).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{f.last_seen ? new Date(f.last_seen).toLocaleString("en-GB") : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {!failures.length && (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No failures recorded</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ConsoleMobileList
                  emptyLabel="No failures recorded"
                  rows={failures.map((f) => ({
                    key: f.reason,
                    title: f.reason,
                    state: `${Number(f.failures).toLocaleString()} failures · last seen ${f.last_seen ? new Date(f.last_seen).toLocaleString("en-GB") : "—"}`,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Campaign engagement (unique recipients)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead><MailOpen className="inline h-3 w-3 mr-1" />Opened</TableHead>
                      <TableHead><MousePointer className="inline h-3 w-3 mr-1" />Clicked</TableHead>
                      <TableHead>Bounced</TableHead>
                      <TableHead>Complained</TableHead>
                      <TableHead>Claimed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.campaign_id}>
                        <TableCell>
                          <div className="font-medium">{c.title || "Untitled"}</div>
                          {!c.tracking_enabled && <Badge variant="outline" className="mt-1 text-xs">Not tracked</Badge>}
                        </TableCell>
                        <TableCell>{Number(c.sent).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.delivered).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.opened).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.clicked).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.bounced).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.complained).toLocaleString()}</TableCell>
                        <TableCell>{Number(c.claimed).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!campaigns.length && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No campaigns yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No campaigns yet"
                rows={campaigns.map((c) => ({
                  key: c.campaign_id,
                  title: c.title || "Untitled",
                  state: `${Number(c.delivered).toLocaleString()} delivered · ${Number(c.opened).toLocaleString()} opened · ${Number(c.clicked).toLocaleString()} clicked`,
                  status: !c.tracking_enabled ? <Badge variant="outline" className="text-xs">Not tracked</Badge> : undefined,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Acquisition by UTM source</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Medium</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">Enquiries</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acquisition.map((a, i) => (
                      <TableRow key={`${a.source}-${a.medium}-${a.campaign}-${i}`}>
                        <TableCell>{a.source || "direct"}</TableCell>
                        <TableCell>{a.medium || "—"}</TableCell>
                        <TableCell>{a.campaign || "—"}</TableCell>
                        <TableCell className="text-right">{Number(a.signups).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(a.enquiries).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{Number(a.signups + a.enquiries).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!acquisition.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No acquisition data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No acquisition data"
                rows={acquisition.map((a, i) => ({
                  key: `${a.source}-${a.medium}-${a.campaign}-${i}`,
                  title: a.source || "direct",
                  state: `${a.medium || "—"} · ${a.campaign || "—"} · ${Number(a.signups + a.enquiries).toLocaleString()} total`,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {queuePendingCount} pending nudge{queuePendingCount === 1 ? "" : "s"} queued.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => sendNudges()} disabled={!queuePendingCount}>
                <Send className="h-4 w-4 mr-1" /> Send all pending
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Queued</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>
                          <div className="font-medium">{q.mu_people?.full_name || q.email}</div>
                          <div className="text-xs text-muted-foreground">{q.email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{q.reason === "invited_no_account" ? "No account" : q.reason === "profile_gaps" ? "Profile incomplete" : "No activity"}</TableCell>
                        <TableCell><Badge variant={q.status === "pending" ? "default" : "secondary"}>{q.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(q.queued_at).toLocaleString("en-GB")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {q.status === "pending" ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => sendNudges([q.id])}>
                                  <Send className="h-3 w-3 mr-1" /> Send
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setQueueStatus(q.id, "held")}>
                                  <Ban className="h-3 w-3 mr-1" /> Hold
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setQueueStatus(q.id, "pending")}>
                                Release
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!queue.length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Queue is empty</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="Queue is empty"
                rows={queue.map((q) => ({
                  key: q.id,
                  title: q.mu_people?.full_name || q.email,
                  state: `${q.reason === "invited_no_account" ? "No account" : q.reason === "profile_gaps" ? "Profile incomplete" : "No activity"} · queued ${new Date(q.queued_at).toLocaleString("en-GB")}`,
                  status: <Badge variant={q.status === "pending" ? "default" : "secondary"}>{q.status}</Badge>,
                  trailing: q.status === "pending" ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => sendNudges([q.id])}>
                        <Send className="h-3 w-3 mr-1" /> Send
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setQueueStatus(q.id, "held")}>
                        <Ban className="h-3 w-3 mr-1" /> Hold
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setQueueStatus(q.id, "pending")}>
                      Release
                    </Button>
                  ),
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {invitedReport.length} invited addresses and their current state.
            </p>
            <Button size="sm" variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-1" /> Download CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Claimed</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Failure reason</TableHead>
                      <TableHead>Failure at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitedReport.map((r) => (
                      <TableRow key={r.email}>
                        <TableCell className="font-medium">{r.email}</TableCell>
                        <TableCell className="text-xs">{r.invited_at ? new Date(r.invited_at).toLocaleString("en-GB") : "—"}</TableCell>
                        <TableCell className="text-xs">{r.claimed_at ? new Date(r.claimed_at).toLocaleString("en-GB") : "No"}</TableCell>
                        <TableCell><Badge variant={r.state === "active" ? "secondary" : "destructive"}>{stateLabel[r.state] || r.state}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{r.failure_reason || "—"}</TableCell>
                        <TableCell className="text-xs">{r.failure_at ? new Date(r.failure_at).toLocaleString("en-GB") : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!invitedReport.length && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No report data</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No report data"
                rows={invitedReport.map((r) => ({
                  key: r.email,
                  title: r.email,
                  state: `Invited ${r.invited_at ? new Date(r.invited_at).toLocaleString("en-GB") : "—"} · claimed ${r.claimed_at ? new Date(r.claimed_at).toLocaleString("en-GB") : "no"}`,
                  status: <Badge variant={r.state === "active" ? "secondary" : "destructive"}>{stateLabel[r.state] || r.state}</Badge>,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-semibold">Figure audit</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Every dashboard figure is recounted straight from the underlying records. Anything that disagrees is flagged here and raises an alert. Runs automatically each morning at 08:45.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={runReconcile} disabled={reconciling || auditing}>
                  <Wrench className={`h-4 w-4 mr-1 ${reconciling ? "animate-pulse" : ""}`} />
                  {reconciling ? "Putting right" : "Put figures right"}
                </Button>
                <Button size="sm" onClick={runAudit} disabled={auditing || reconciling}>
                  <ShieldCheck className={`h-4 w-4 mr-1 ${auditing ? "animate-pulse" : ""}`} />
                  {auditing ? "Checking" : "Run audit now"}
                </Button>
              </div>

            </CardHeader>
            <CardContent className="p-0">
              <div className="px-6 pb-3 text-xs text-muted-foreground">
                {audit.length
                  ? `${auditMismatches} figure${auditMismatches === 1 ? "" : "s"} disagree with the records, ${auditWarnings} need a look, ${audit.length - auditMismatches - auditWarnings} agree. Last checked ${audit[0]?.created_at ? new Date(audit[0].created_at).toLocaleString("en-GB") : "—"}.`
                  : "No audit has been recorded yet."}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Check</TableHead>
                      <TableHead>Figure</TableHead>
                      <TableHead>Where</TableHead>
                      <TableHead>Dashboard</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((r) => (
                      <TableRow key={r.id} className={r.severity === "mismatch" ? "bg-destructive/5" : undefined}>
                        <TableCell className="text-xs">{auditCheckLabel[r.check_key] || r.check_key}</TableCell>
                        <TableCell className="text-xs">{auditMetricLabel[r.metric] || r.metric}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{r.scope === "global" ? "Whole system" : r.scope}</TableCell>
                        <TableCell className="text-xs">{r.dashboard_value === null ? "—" : Number(r.dashboard_value).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{r.source_value === null ? "—" : Number(r.source_value).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={r.severity === "mismatch" ? "destructive" : r.severity === "warning" ? "outline" : "secondary"}>
                            {r.severity === "mismatch" ? "Disagrees" : r.severity === "warning" ? "Worth a look" : "Agrees"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px]">{r.note}</TableCell>
                      </TableRow>
                    ))}
                    {!audit.length && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Run the audit to see results</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="Run the audit to see results"
                rows={audit.map((r) => ({
                  key: r.id,
                  title: `${auditCheckLabel[r.check_key] || r.check_key} · ${auditMetricLabel[r.metric] || r.metric}`,
                  state: `${r.scope === "global" ? "Whole system" : r.scope} · dashboard ${r.dashboard_value === null ? "—" : Number(r.dashboard_value).toLocaleString()} vs records ${r.source_value === null ? "—" : Number(r.source_value).toLocaleString()}`,
                  status: (
                    <Badge variant={r.severity === "mismatch" ? "destructive" : r.severity === "warning" ? "outline" : "secondary"}>
                      {r.severity === "mismatch" ? "Disagrees" : r.severity === "warning" ? "Worth a look" : "Agrees"}
                    </Badge>
                  ),
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {tab === "health" && journey.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Candidate journey detail</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Stuck step</TableHead>
                    <TableHead>Open questions</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Saves</TableHead>
                    <TableHead>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journey.slice(0, 50).map((j) => (
                    <TableRow key={j.person_id}>
                      <TableCell className="font-medium">{j.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{j.email || "—"}</TableCell>
                      <TableCell>{stepLabel[j.stuck_step] || j.stuck_step}</TableCell>
                      <TableCell>{j.questions_open}</TableCell>
                      <TableCell>{j.documents}</TableCell>
                      <TableCell>{j.profile_saves}</TableCell>
                      <TableCell className="text-xs">{j.last_activity_at ? new Date(j.last_activity_at).toLocaleString("en-GB") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ConsoleMobileList
              emptyLabel="No candidates yet"
              rows={journey.slice(0, 50).map((j) => ({
                key: j.person_id,
                title: j.full_name || j.email || "—",
                state: `${stepLabel[j.stuck_step] || j.stuck_step} · ${j.questions_open} open questions · last active ${j.last_activity_at ? new Date(j.last_activity_at).toLocaleString("en-GB") : "—"}`,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
