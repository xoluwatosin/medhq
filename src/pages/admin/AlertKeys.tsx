import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, RefreshCw, Send, ShieldCheck, Loader2, Eye } from "lucide-react";
import { adminDb, exportToCSV } from "@/lib/admin-utils";
import { toast } from "sonner";

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold">Alert keys</h1>
          <p className="text-sm text-muted-foreground">
            Generate, rotate and verify the internal run keys that let scheduled jobs raise alerts. Key values are
            never shown, here or anywhere else.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Test the alert path
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This checks that the alert key is valid and that a sign-up failure digest reaches hello@medicconnect.co.
            A test alert is raised, sent, and closed straight away.
          </p>
          <Button onClick={runTest} disabled={testing || !alertKey?.present}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send a test alert
          </Button>
          {!alertKey?.present && (
            <p className="text-sm text-amber-700">No alert key is stored yet. Rotate the alert key first.</p>
          )}
          {lastTest && (
            <div
              className={`rounded-md border p-3 text-sm ${
                lastTest.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {lastTest.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Key register
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Fingerprint</TableHead>
                <TableHead>Last rotated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.name}>
                  <TableCell>
                    <p className="font-medium">{KEY_LABELS[k.name]?.title ?? k.name}</p>
                    <p className="text-xs text-muted-foreground">{KEY_LABELS[k.name]?.blurb ?? k.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={k.present ? "default" : "destructive"}>{k.present ? "Stored" : "Missing"}</Badge>
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
                      {busy === k.name ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      {k.present ? "Rotate" : "Generate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!keys.length && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No keys are registered yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Audit trail
          </CardTitle>
          <Button size="sm" variant="outline" onClick={exportAudit} disabled={!audit.length}>
            Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm whitespace-nowrap">{fmt(a.created_at)}</TableCell>
                  <TableCell className="text-sm">{KEY_LABELS[a.key_name]?.title ?? a.key_name}</TableCell>
                  <TableCell className="text-sm">{ACTION_LABELS[a.action] ?? a.action}</TableCell>
                  <TableCell className="text-sm">{a.actor_email ?? "System"}</TableCell>
                </TableRow>
              ))}
              {!audit.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                    Nothing has been recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
