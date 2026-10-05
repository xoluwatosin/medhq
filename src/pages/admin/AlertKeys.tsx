import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Send, Loader2 } from "lucide-react";
import { adminDb, exportToCSV } from "@/lib/admin-utils";
import { toast } from "sonner";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";

const HEAD = "text-[11px] font-bold uppercase tracking-[0.14em] text-label";

interface KeyRow {
  name: string;
  present: boolean;
  rotated_at: string | null;
  created_at: string | null;
  fingerprint: string | null;
}

interface AuditRow {
  id: string;
  key_name: string;
  action: string;
  actor_email: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const KEY_LABELS: Record<string, { title: string; blurb: string }> = {
  admin_alert_key: {
    title: "Alert key",
    blurb: "Authorises the scheduled sign-up failure check to send you an intake health digest.",
  },
  followup_run_key: {
    title: "Follow-up key",
    blurb: "Authorises the daily sweep that nudges invited candidates who have gone quiet.",
  },
  mu_link_sweep_key: {
    title: "Link sweep key",
    blurb: "Authorises the sweep that reunites orphaned accounts with their candidate record.",
  },
};

const ACTION_LABELS: Record<string, string> = {
  rotated: "Rotated the key",
  viewed: "Viewed the key register",
  test_passed: "Test alert delivered",
  test_failed: "Test alert failed",
};

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Never";

export default function AlertKeys() {
  const db = adminDb();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<{ ok: boolean; message: string } | null>(null);

  const loadAudit = async () => {
    const { data } = await db
      .from("job_key_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setAudit(data ?? []);
  };

  const load = async (logView = false) => {
    setLoading(true);
    const { data, error } = await db.rpc("admin_job_keys");
    if (error) toast.error("Could not read the key register.");
    setKeys(data ?? []);
    if (logView) {
      await db.rpc("admin_job_key_log", {
        p_name: "admin_alert_key",
        p_action: "viewed",
        p_detail: {},
      });
    }
    await loadAudit();
    setLoading(false);
  };

  useEffect(() => { load(true); }, []);

  const rotate = async (name: string) => {
    setBusy(name);
    const { error } = await db.rpc("admin_job_key_rotate", { p_name: name });
    if (error) toast.error(error.message);
    else toast.success("A fresh key has been minted and stored.");
    setConfirmKey(null);
    await load();
    setBusy(null);
  };

  const runTest = async () => {
    setTesting(true);
    setLastTest(null);
    try {
      const { data, error } = await db.functions.invoke("admin-alert-test", { body: {} });
      if (error) throw error;
      setLastTest({ ok: Boolean(data?.ok), message: data?.message ?? "No response." });
      if (data?.ok) toast.success("Test alert dispatched.");
      else toast.error(data?.message ?? "The test alert did not go through.");
    } catch (e: any) {
      setLastTest({ ok: false, message: e?.message || "The test alert could not be run." });
      toast.error("The test alert could not be run.");
    }
    await loadAudit();
    setTesting(false);
  };

  const exportAudit = () => {
    exportToCSV(
      audit.map((a) => ({
        When: fmt(a.created_at),
        Key: KEY_LABELS[a.key_name]?.title ?? a.key_name,
        Action: ACTION_LABELS[a.action] ?? a.action,
        Admin: a.actor_email ?? "System",
        Detail: a.detail ? JSON.stringify(a.detail) : "",
      })),
      "alert-key-audit",
    );
  };

  const alertKey = keys.find((k) => k.name === "admin_alert_key");

  return (
    <MuPage>
      <MuPageHeader
        title="Alert keys"
        description="The run keys scheduled jobs use to raise alerts. Values are never shown."
        actions={
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        }
      />

      <MuSection
        title="Test the alert path"
        description="Raises, sends and closes a test alert to hello@medicconnect.co."
      >
        <div className="space-y-3">
          <Button onClick={runTest} disabled={testing || !alertKey?.present} title={!alertKey?.present ? "Generate the alert key in the register below first" : undefined}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send a test alert
          </Button>
          {lastTest && (
            <div
              className={`border p-3 text-sm ${
                lastTest.ok ? "border-line bg-tint text-navy" : "border-warn-line/40 bg-warn-bg text-warn-ink"
              }`}
            >
              {lastTest.message}
            </div>
          )}
        </div>
      </MuSection>

      <MuSection title="Key register" padded={false}>
        {!keys.length && !loading ? (
          <MuEmpty art={art.objPadlock} title="No keys yet" description="Run keys appear here once they are registered." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-line-soft hover:bg-transparent">
                <TableHead className={HEAD}>Key</TableHead>
                <TableHead className={HEAD}>State</TableHead>
                <TableHead className={HEAD}>Fingerprint</TableHead>
                <TableHead className={HEAD}>Last rotated</TableHead>
                <TableHead className={`${HEAD} text-right`}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.name} className="border-line-soft">
                  <TableCell>
                    <p className="font-medium">{KEY_LABELS[k.name]?.title ?? k.name}</p>
                    <p className="text-xs text-muted-foreground">{KEY_LABELS[k.name]?.blurb ?? k.name}</p>
                  </TableCell>
                  <TableCell>
                    <MuStatus label={k.present ? "Stored" : "Missing"} tone={k.present ? "good" : "bad"} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{k.fingerprint ?? "Not recorded"}</TableCell>
                  <TableCell className="text-sm">{fmt(k.rotated_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmKey(k.name)}
                      disabled={busy === k.name}
                    >
                      {busy === k.name ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      {k.present ? "Rotate" : "Generate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </MuSection>

      <MuSection
        title="Audit trail"
        padded={false}
        actions={
          <Button size="sm" variant="outline" onClick={exportAudit} disabled={!audit.length}>
            Export
          </Button>
        }
      >
        {!audit.length ? (
          <MuEmpty art={art.objClipboard} title="Nothing recorded yet" description="Key rotations and tests will be listed here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-line-soft hover:bg-transparent">
                <TableHead className={HEAD}>When</TableHead>
                <TableHead className={HEAD}>Key</TableHead>
                <TableHead className={HEAD}>Action</TableHead>
                <TableHead className={HEAD}>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id} className="border-line-soft">
                  <TableCell className="whitespace-nowrap text-sm">{fmt(a.created_at)}</TableCell>
                  <TableCell className="text-sm">{KEY_LABELS[a.key_name]?.title ?? a.key_name}</TableCell>
                  <TableCell className="text-sm">{ACTION_LABELS[a.action] ?? a.action}</TableCell>
                  <TableCell className="text-sm">{a.actor_email ?? "System"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </MuSection>

      <AlertDialog open={Boolean(confirmKey)} onOpenChange={(open) => !open && setConfirmKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate this key?</AlertDialogTitle>
            <AlertDialogDescription>
              A new random value is minted immediately and the old one stops working. Scheduled jobs read the key from
              the database, so nothing else needs updating. The rotation is recorded against your name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmKey && rotate(confirmKey)}>Rotate now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MuPage>
  );
}
