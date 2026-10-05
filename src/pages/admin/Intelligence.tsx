import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

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
    <MuPage>
      <MuPageHeader
        title="Insights"
        description={`Intake health, campaign funnels and candidate flow. Refreshed ${lastRefreshed ? new Date(lastRefreshed).toLocaleString("en-GB") : "never"}.`}
        actions={
          <Button size="sm" variant="outline" onClick={doRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {alerts.length > 0 && (
        <div className="border border-warn-line/40 bg-warn-bg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warn-ink" />
            <div className="flex-1">
              <p className="text-sm font-bold text-warn-ink">
                {alerts.length} unresolved alert{alerts.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-warn-ink">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>{a.title} {a.detail?.reason ? `(${a.detail.reason})` : ""}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-warn-ink" onClick={() => resolveAlert(a.id)}>
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
          <TabsTrigger value="queue"><Inbox className="h-4 w-4 mr-1" /> Queue <span className="ml-1.5 bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{queuePendingCount}</span></TabsTrigger>
          <TabsTrigger value="report"><Users className="h-4 w-4 mr-1" /> Invited report</TabsTrigger>
          <TabsTrigger value="audit">
            <ShieldCheck className="h-4 w-4 mr-1" /> Audit
            {auditMismatches > 0 && <span className="ml-1.5 bg-warn-bg px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-warn-ink">{auditMismatches}</span>}
          </TabsTrigger>
        </TabsList>


        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {funnel.map((f) => {
              const Icon = icons[f.stage] || Brain;
              return (
                <div key={f.stage} className="border border-line bg-card p-4 text-center">
                  <p className={HEAD}>{f.stage.replace(/_/g, " ")}</p>
                  <div className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.03em] text-navy tabular-nums">{Number(f.people).toLocaleString()}</div>
                  <Icon className="mx-auto mt-2 h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MuSection title="Where candidates are stuck" padded={false}>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-line-soft hover:bg-transparent">
                        <TableHead className={HEAD}>Step</TableHead>
                        <TableHead className={`${HEAD} text-right`}>People</TableHead>
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
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={2} className="p-0"><MuEmpty art={art.objClipboard} title="No data yet" description="Nobody is stuck at a step yet." /></TableCell></TableRow>
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
              </MuSection>

            <MuSection title="Sign-up failures (last 30 days)" padded={false}>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-line-soft hover:bg-transparent">
                        <TableHead className={HEAD}>Reason</TableHead>
                        <TableHead className={`${HEAD} text-right`}>Count</TableHead>
                        <TableHead className={HEAD}>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failures.map((f) => (
                        <TableRow key={f.reason}>
                          <TableCell className="font-mono text-xs">{f.reason}</TableCell>
                          <TableCell className="text-right font-medium">{Number(f.failures).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{f.last_seen ? new Date(f.last_seen).toLocaleString("en-GB") : "Not recorded"}</TableCell>
                        </TableRow>
                      ))}
                      {!failures.length && (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={3} className="p-0"><MuEmpty art={art.objShieldCheck} title="No failures recorded" description="Sign-up failures from the last 30 days will appear here." /></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ConsoleMobileList
                  emptyLabel="No failures recorded"
                  rows={failures.map((f) => ({
                    key: f.reason,
                    title: f.reason,
                    state: `${Number(f.failures).toLocaleString()} failures, last seen ${f.last_seen ? new Date(f.last_seen).toLocaleString("en-GB") : "Not recorded"}`,
                  }))}
                />
              </MuSection>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <MuSection title="Campaign engagement (unique recipients)" padded={false}>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={HEAD}>Campaign</TableHead>
                      <TableHead className={HEAD}>Sent</TableHead>
                      <TableHead className={HEAD}>Delivered</TableHead>
                      <TableHead className={HEAD}><MailOpen className="inline h-3 w-3 mr-1" />Opened</TableHead>
                      <TableHead className={HEAD}><MousePointer className="inline h-3 w-3 mr-1" />Clicked</TableHead>
                      <TableHead className={HEAD}>Bounced</TableHead>
                      <TableHead className={HEAD}>Complained</TableHead>
                      <TableHead className={HEAD}>Claimed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.campaign_id}>
                        <TableCell>
                          <div className="font-medium">{c.title || "Untitled"}</div>
                          {!c.tracking_enabled && <MuStatus label="Not tracked" tone="neutral" className="mt-1" />}
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
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="p-0"><MuEmpty art={art.objEnvelope} title="No campaigns yet" description="Sent campaigns and their engagement will appear here." /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No campaigns yet"
                rows={campaigns.map((c) => ({
                  key: c.campaign_id,
                  title: c.title || "Untitled",
                  state: `${Number(c.delivered).toLocaleString()} delivered, ${Number(c.opened).toLocaleString()} opened, ${Number(c.clicked).toLocaleString()} clicked`,
                  status: !c.tracking_enabled ? <MuStatus label="Not tracked" tone="neutral" /> : undefined,
                }))}
              />
            </MuSection>
        </TabsContent>

        <TabsContent value="acquisition" className="space-y-4">
          <MuSection title="Acquisition by UTM source" padded={false}>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={HEAD}>Source</TableHead>
                      <TableHead className={HEAD}>Medium</TableHead>
                      <TableHead className={HEAD}>Campaign</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Signups</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Enquiries</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acquisition.map((a, i) => (
                      <TableRow key={`${a.source}-${a.medium}-${a.campaign}-${i}`}>
                        <TableCell>{a.source || "direct"}</TableCell>
                        <TableCell>{a.medium || "None"}</TableCell>
                        <TableCell>{a.campaign || "None"}</TableCell>
                        <TableCell className="text-right">{Number(a.signups).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(a.enquiries).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{Number(a.signups + a.enquiries).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!acquisition.length && (
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="p-0"><MuEmpty art={art.objMagnifier} title="No acquisition data" description="Sign-ups and enquiries with UTM tags will appear here." /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No acquisition data"
                rows={acquisition.map((a, i) => ({
                  key: `${a.source}-${a.medium}-${a.campaign}-${i}`,
                  title: a.source || "direct",
                  state: `${a.medium || "None"}, ${a.campaign || "None"}, ${Number(a.signups + a.enquiries).toLocaleString()} total`,
                }))}
              />
            </MuSection>
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
          <MuSection padded={false}>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={HEAD}>Candidate</TableHead>
                      <TableHead className={HEAD}>Reason</TableHead>
                      <TableHead className={HEAD}>Status</TableHead>
                      <TableHead className={HEAD}>Queued</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Actions</TableHead>
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
                        <TableCell><MuStatus label={sentence(q.status)} tone={q.status === "pending" ? "info" : "neutral"} /></TableCell>
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
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="p-0"><MuEmpty art={art.objEnvelope} title="Queue is empty" description="Follow-up nudges waiting to be sent will appear here." /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="Queue is empty"
                rows={queue.map((q) => ({
                  key: q.id,
                  title: q.mu_people?.full_name || q.email,
                  state: `${q.reason === "invited_no_account" ? "No account" : q.reason === "profile_gaps" ? "Profile incomplete" : "No activity"}, queued ${new Date(q.queued_at).toLocaleString("en-GB")}`,
                  status: <MuStatus label={sentence(q.status)} tone={q.status === "pending" ? "info" : "neutral"} />,
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
            </MuSection>
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
          <MuSection padded={false}>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={HEAD}>Email</TableHead>
                      <TableHead className={HEAD}>Invited</TableHead>
                      <TableHead className={HEAD}>Claimed</TableHead>
                      <TableHead className={HEAD}>State</TableHead>
                      <TableHead className={HEAD}>Failure reason</TableHead>
                      <TableHead className={HEAD}>Failure at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitedReport.map((r) => (
                      <TableRow key={r.email}>
                        <TableCell className="font-medium">{r.email}</TableCell>
                        <TableCell className="text-xs">{r.invited_at ? new Date(r.invited_at).toLocaleString("en-GB") : "Not recorded"}</TableCell>
                        <TableCell className="text-xs">{r.claimed_at ? new Date(r.claimed_at).toLocaleString("en-GB") : "No"}</TableCell>
                        <TableCell><MuStatus label={stateLabel[r.state] || r.state} tone={r.state === "active" ? "good" : "bad"} /></TableCell>
                        <TableCell className="font-mono text-xs">{r.failure_reason || "None"}</TableCell>
                        <TableCell className="text-xs">{r.failure_at ? new Date(r.failure_at).toLocaleString("en-GB") : "Not recorded"}</TableCell>
                      </TableRow>
                    ))}
                    {!invitedReport.length && (
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="p-0"><MuEmpty art={art.objClipboard} title="No report data" description="Invited addresses and their state will appear here." /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="No report data"
                rows={invitedReport.map((r) => ({
                  key: r.email,
                  title: r.email,
                  state: `Invited ${r.invited_at ? new Date(r.invited_at).toLocaleString("en-GB") : "Not recorded"}, claimed ${r.claimed_at ? new Date(r.claimed_at).toLocaleString("en-GB") : "no"}`,
                  status: <MuStatus label={stateLabel[r.state] || r.state} tone={r.state === "active" ? "good" : "bad"} />,
                }))}
              />
            </MuSection>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <MuSection
            title="Figure audit"
            description="Every dashboard figure is recounted straight from the underlying records. Anything that disagrees is flagged here and raises an alert. Runs automatically each morning at 08:45."
            padded={false}
            actions={
              <>
                <Button size="sm" variant="outline" onClick={runReconcile} disabled={reconciling || auditing}>
                  <Wrench className={`h-4 w-4 mr-1 ${reconciling ? "animate-pulse" : ""}`} />
                  {reconciling ? "Putting right" : "Put figures right"}
                </Button>
                <Button size="sm" onClick={runAudit} disabled={auditing || reconciling}>
                  <ShieldCheck className={`h-4 w-4 mr-1 ${auditing ? "animate-pulse" : ""}`} />
                  {auditing ? "Checking" : "Run audit now"}
                </Button>
              </>
            }
          >
              {audit.length > 0 && (
                <div className="border-b border-line-soft px-5 py-3 text-xs text-muted-foreground">
                  {`${auditMismatches} figure${auditMismatches === 1 ? "" : "s"} disagree with the records, ${auditWarnings} need a look, ${audit.length - auditMismatches - auditWarnings} agree. Last checked ${audit[0]?.created_at ? new Date(audit[0].created_at).toLocaleString("en-GB") : "Not recorded"}.`}
                </div>
              )}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={HEAD}>Check</TableHead>
                      <TableHead className={HEAD}>Figure</TableHead>
                      <TableHead className={HEAD}>Where</TableHead>
                      <TableHead className={HEAD}>Dashboard</TableHead>
                      <TableHead className={HEAD}>Records</TableHead>
                      <TableHead className={HEAD}>Verdict</TableHead>
                      <TableHead className={HEAD}>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((r) => (
                      <TableRow key={r.id} className={r.severity === "mismatch" ? "bg-destructive/5" : undefined}>
                        <TableCell className="text-xs">{auditCheckLabel[r.check_key] || r.check_key}</TableCell>
                        <TableCell className="text-xs">{auditMetricLabel[r.metric] || r.metric}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate">{r.scope === "global" ? "Whole system" : r.scope}</TableCell>
                        <TableCell className="text-xs">{r.dashboard_value === null ? "Not recorded" : Number(r.dashboard_value).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{r.source_value === null ? "Not recorded" : Number(r.source_value).toLocaleString()}</TableCell>
                        <TableCell>
                          <MuStatus label={r.severity === "mismatch" ? "Disagrees" : r.severity === "warning" ? "Worth a look" : "Agrees"} tone={r.severity === "mismatch" ? "bad" : r.severity === "warning" ? "warning" : "good"} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[320px]">{r.note}</TableCell>
                      </TableRow>
                    ))}
                    {!audit.length && (
                      <TableRow className="hover:bg-transparent"><TableCell colSpan={7} className="p-0"><MuEmpty art={art.objDocumentMagnifier} title="No audit yet" description="Run the audit to recount every dashboard figure." /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ConsoleMobileList
                emptyLabel="Run the audit to see results"
                rows={audit.map((r) => ({
                  key: r.id,
                  title: `${auditCheckLabel[r.check_key] || r.check_key}, ${auditMetricLabel[r.metric] || r.metric}`,
                  state: `${r.scope === "global" ? "Whole system" : r.scope}, dashboard ${r.dashboard_value === null ? "Not recorded" : Number(r.dashboard_value).toLocaleString()} vs records ${r.source_value === null ? "Not recorded" : Number(r.source_value).toLocaleString()}`,
                  status: (
                    <MuStatus label={r.severity === "mismatch" ? "Disagrees" : r.severity === "warning" ? "Worth a look" : "Agrees"} tone={r.severity === "mismatch" ? "bad" : r.severity === "warning" ? "warning" : "good"} />
                  ),
                }))}
              />
            </MuSection>
        </TabsContent>
      </Tabs>


      {tab === "health" && journey.length > 0 && (
        <MuSection title="Candidate journey detail" padded={false}>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-line-soft hover:bg-transparent">
                    <TableHead className={HEAD}>Name</TableHead>
                    <TableHead className={HEAD}>Email</TableHead>
                    <TableHead className={HEAD}>Stuck step</TableHead>
                    <TableHead className={HEAD}>Open questions</TableHead>
                    <TableHead className={HEAD}>Documents</TableHead>
                    <TableHead className={HEAD}>Saves</TableHead>
                    <TableHead className={HEAD}>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journey.slice(0, 50).map((j) => (
                    <TableRow key={j.person_id}>
                      <TableCell className="font-medium">{j.full_name || "Unnamed"}</TableCell>
                      <TableCell className="text-xs">{j.email || "None"}</TableCell>
                      <TableCell>{stepLabel[j.stuck_step] || j.stuck_step}</TableCell>
                      <TableCell>{j.questions_open}</TableCell>
                      <TableCell>{j.documents}</TableCell>
                      <TableCell>{j.profile_saves}</TableCell>
                      <TableCell className="text-xs">{j.last_activity_at ? new Date(j.last_activity_at).toLocaleString("en-GB") : "Not recorded"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ConsoleMobileList
              emptyLabel="No candidates yet"
              rows={journey.slice(0, 50).map((j) => ({
                key: j.person_id,
                title: j.full_name || j.email || "Unnamed",
                state: `${stepLabel[j.stuck_step] || j.stuck_step}, ${j.questions_open} open questions, last active ${j.last_activity_at ? new Date(j.last_activity_at).toLocaleString("en-GB") : "Not recorded"}`,
              }))}
            />
          </MuSection>
      )}
    </MuPage>
  );
}
