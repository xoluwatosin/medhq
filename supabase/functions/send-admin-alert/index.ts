// Sends Admin Centre alert email. Three modes:
//   alerts  – alerts that are due now (critical at once and on escalation,
//             warnings at most hourly). Which alerts are due is decided in the
//             database by public.ops_claim_alert_email(), so a replay sends nothing.
//   digest  – the 07:45 daily summary from public.ops_digest().
//   test    – the "Send test alert" button on Alert keys.
// Called by the ops-run-checks and ops-daily-digest jobs, analytics_check_alerts()
// and admin-alert-test, all with the alert run key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kitEmail, kitList, kitNotice, kitParagraph, kitSubhead, kitTable, kitButton } from "../_shared/kit-email.ts";
import { SITE_URL } from "../_shared/site-url.ts";
import { withOpsLog } from "../_shared/ops-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-run-key, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Moves to Settings with configuration (C1). Comma-separated override for now.
const RECIPIENTS = (Deno.env.get("OPS_ALERT_RECIPIENTS") ?? "hello@medicconnect.co")
  .split(",").map((s) => s.trim()).filter(Boolean);
const FROM = "Medic Connect <noreply@medicconnect.co>";
const SCREEN = `${SITE_URL}/admin/system`;

type Severity = "info" | "warning" | "critical";
interface AlertLine {
  id?: string;
  severity: Severity;
  title: string;
  summary?: string | null;
  link?: string | null;
  created_at?: string;
  since?: string;
  email_count?: number;
  acknowledged?: boolean;
}

const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", warning: "Warning", info: "Note" };
const STATUS_LABEL: Record<string, string> = { ok: "All clear", info: "Notes", warning: "Needs a look", critical: "Needs action now" };
const AREA_LABEL: Record<string, string> = {
  care: "Care delivery", talent: "Talent", email: "Email", payments: "Payments",
  jobs: "Scheduled jobs", services: "Outside services", functions: "Back-end functions",
};

const lagos = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const alertRows = (alerts: AlertLine[]) =>
  alerts.map((a) => [
    `**${SEVERITY_LABEL[a.severity] ?? a.severity}**`,
    `**${a.title}**${a.summary ? ` ${a.summary}` : ""}${a.link ? ` ${SITE_URL}${a.link}` : ""}`,
    lagos(a.created_at ?? a.since),
  ]);

async function send(subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY is not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from: FROM, to: RECIPIENTS, subject, html, tags: [{ name: "template", value: "ops_alert" }] }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 500)}` };
}

function alertsEmail(alerts: AlertLine[]) {
  const critical = alerts.filter((a) => a.severity === "critical");
  const repeat = critical.some((a) => (a.email_count ?? 1) > 1);
  const subject = critical.length
    ? `${repeat ? "Still open: " : ""}${critical.length} critical alert${critical.length > 1 ? "s" : ""}: ${critical[0].title}`
    : `${alerts.length} warning${alerts.length > 1 ? "s" : ""}: ${alerts[0].title}`;
  const html = kitEmail({
    eyebrow: "Admin Centre",
    title: critical.length ? "Something needs attention now" : "A few things need a look",
    standfirst: critical.length
      ? "Acknowledge an alert on the System health screen to stop the reminders. It closes by itself once the problem clears."
      : "Warnings are batched at most once an hour. Each closes by itself once the problem clears.",
    preheader: subject,
    bodyHtml: [
      kitTable(["Level", "Alert", "Since"], alertRows(alerts)),
      kitButton("Open System health", SCREEN),
    ].join("\n"),
  });
  return { subject, html };
}

interface Digest {
  date: string;
  overall: string;
  areas: { area: string; status: string }[];
  open: AlertLine[];
  cleared: { title: string; resolved_at: string; note: string | null }[];
  volumes: Record<string, number>;
  awaiting: { approvals: number; new_enquiries: number };
}

const VOLUME_LABEL: Record<string, string> = {
  enquiries: "Enquiries",
  care_requests: "Care requests",
  candidates: "New candidates",
  care_messages_sent: "Care messages sent",
  emails_delivered: "Emails delivered",
  invoices_paid: "Invoices paid",
};

function digestEmail(d: Digest) {
  const day = new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const subject = `Daily summary: ${STATUS_LABEL[d.overall] ?? d.overall}${d.open.length ? `, ${d.open.length} open` : ""}`;
  const parts: string[] = [];

  parts.push(kitNotice(`Overall: ${STATUS_LABEL[d.overall] ?? d.overall}`));
  parts.push(kitTable(
    ["Area", "Status"],
    d.areas.map((a) => [AREA_LABEL[a.area] ?? a.area, STATUS_LABEL[a.status] ?? a.status]),
  ));

  parts.push(kitSubhead(`Open alerts (${d.open.length})`));
  parts.push(d.open.length
    ? kitTable(["Level", "Alert", "Since"], alertRows(d.open.map((a) => ({
        ...a, title: a.acknowledged ? `${a.title} (acknowledged)` : a.title,
      }))))
    : kitParagraph("Nothing open."));

  if (d.cleared.length) {
    parts.push(kitSubhead("Cleared in the last 24 hours"));
    parts.push(kitList(d.cleared.map((c) => `${c.title} (${lagos(c.resolved_at)}${c.note ? `, ${c.note.toLowerCase()}` : ""})`)));
  }

  const volumes = Object.entries(VOLUME_LABEL)
    .filter(([key]) => key in d.volumes)
    .map(([key, label]) => [label, String(d.volumes[key])]);
  if (volumes.length) {
    parts.push(kitSubhead(`Yesterday, ${day}`));
    parts.push(kitTable(["", "Count"], volumes, ["left", "right"]));
  }

  const waiting = [
    d.awaiting.new_enquiries ? `**${d.awaiting.new_enquiries}** new enquir${d.awaiting.new_enquiries === 1 ? "y" : "ies"} not yet picked up` : "",
    d.awaiting.approvals ? `**${d.awaiting.approvals}** item${d.awaiting.approvals === 1 ? "" : "s"} awaiting approval` : "",
  ].filter(Boolean);
  if (waiting.length) {
    parts.push(kitSubhead("Waiting on someone"));
    parts.push(kitList(waiting));
  }

  parts.push(kitButton("Open System health", SCREEN));

  const html = kitEmail({
    eyebrow: "Admin Centre",
    title: "Good morning",
    standfirst: "How Medic Connect ran over the last day.",
    preheader: subject,
    bodyHtml: parts.join("\n"),
  });
  return { subject, html };
}

Deno.serve(withOpsLog("send-admin-alert", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const sentKey = req.headers.get("x-run-key");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = bearer === serviceKey;
  if (!allowed && sentKey) {
    const { data: keyOk } = await admin.rpc("job_key_check", { p_name: "admin_alert_key", p_value: sentKey });
    allowed = keyOk === true;
  }
  if (!allowed) return json({ error: "Not permitted." }, 401);

  const body = await req.json().catch(() => ({}));
  const mode: string = body?.mode ?? (body?.test ? "test" : "alerts");

  if (mode === "test") {
    const { data: alerts } = await admin
      .from("admin_alerts")
      .select("id, severity, title, summary, detail, created_at")
      .eq("kind", "test")
      .is("resolved_at", null);
    const lines: AlertLine[] = (alerts ?? []).map((a) => ({ ...a, summary: a.summary ?? "This is a test. No action needed." }));
    if (!lines.length) return json({ sent: 0 });
    const html = kitEmail({
      eyebrow: "Admin Centre",
      title: "Test alert",
      standfirst: "Alert email is working. This is what a real alert looks like.",
      preheader: "Medic Connect test alert",
      bodyHtml: [kitTable(["Level", "Alert", "Since"], alertRows(lines)), kitButton("Open System health", SCREEN)].join("\n"),
    });
    const result = await send("Test alert from the Admin Centre", html);
    if (!result.ok) return json({ error: result.error }, 502);
    await admin.from("admin_alerts").update({ emailed_at: new Date().toISOString(), email_count: 1 }).in("id", lines.map((l) => l.id));
    return json({ sent: lines.length });
  }

  if (mode === "digest") {
    const { data: digest, error } = await admin.rpc("ops_digest");
    if (error) return json({ error: error.message }, 500);
    const { data: logId } = await admin.rpc("ops_start_digest", { _recipients: RECIPIENTS });
    const { subject, html } = digestEmail(digest as Digest);
    const result = await send(subject, html);
    if (logId) await admin.rpc("ops_finish_email", { _log_id: logId, _ok: result.ok, _error: result.error ?? null });
    if (!result.ok) return json({ error: result.error }, 502);
    return json({ sent: 1 });
  }

  // Alerts that are due. Claiming marks them emailed; a failed send gives them back.
  const { data: claim, error: claimError } = await admin.rpc("ops_claim_alert_email", { _recipients: RECIPIENTS });
  if (claimError) return json({ error: claimError.message }, 500);
  const alerts = (claim?.alerts ?? []) as AlertLine[];
  if (!claim?.log_id || !alerts.length) return json({ sent: 0 });

  const { subject, html } = alertsEmail(alerts);
  const result = await send(subject, html);
  await admin.rpc("ops_finish_email", { _log_id: claim.log_id, _ok: result.ok, _error: result.error ?? null });
  if (!result.ok) return json({ error: result.error }, 502);
  return json({ sent: alerts.length });
}));
