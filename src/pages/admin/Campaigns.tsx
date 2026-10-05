import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Copy, Send, ArchiveRestore } from "lucide-react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { adminDb } from "@/lib/admin-utils";
import { selectAll } from "@/lib/select-all";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MuEmpty, MuLoadError, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { Megaphone } from "lucide-react";
import { art } from "@/components/mc/art";

interface Campaign {
  id: string; title: string; subject: string; content: string; status: string; audience_type: string;
  template: string; template_data: any; manual_recipients: string[] | null;
  total_recipients: number; total_delivered: number; total_opened: number; total_clicked: number;
  tracking_enabled?: boolean;
  sent_at: string | null; created_at: string;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "None");

const statusTone: Record<string, "neutral" | "info" | "good"> = { draft: "neutral", scheduled: "info", sent: "good" };

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchCampaigns = async () => {
    const { data, error } = await adminDb().from("campaigns").select("*").eq("archived", false).order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setCampaigns(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  // Campaigns are not archived from this page, but archived ones stay reachable here.
  const [view, setView] = useState<"active" | "archived">("active");
  const showingArchived = view === "archived";
  const [archived, setArchived] = useState<Campaign[] | null>(null);
  const [archivedFailed, setArchivedFailed] = useState(false);

  useEffect(() => {
    if (!showingArchived || archived !== null) return;
    (async () => {
      setArchivedFailed(false);
      try {
        const rows = await selectAll<Campaign>((from, to) =>
          adminDb().from("campaigns").select("*").eq("archived", true)
            .order("created_at", { ascending: false }).order("id").range(from, to),
        );
        setArchived(rows);
      } catch (err) {
        setArchivedFailed(true);
        setArchived([]);
        toast({ title: "Could not load archived campaigns", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [showingArchived, archived]);

  const restoreCampaign = async (id: string) => {
    const { error } = await adminDb().from("campaigns").update({ archived: false }).eq("id", id);
    if (error) {
      toast({ title: "Could not restore", description: error.message, variant: "destructive" });
      return;
    }
    setArchived((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    toast({ title: "Campaign restored" });
    fetchCampaigns();
  };

  const rows = showingArchived ? archived ?? [] : campaigns;

  const createNew = async () => {
    const { data, error } = await adminDb().from("campaigns").insert({ title: "Untitled Campaign" }).select().single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else navigate(`/admin/campaigns/${data.id}`);
  };

  const duplicate = async (c: Campaign) => {
    // A copy keeps the whole email: its blocks, preheader and kind, not just the text.
    const src = c as Campaign & { blocks?: unknown; preheader?: string | null; kind?: string | null; tracking_enabled?: boolean | null };
    const { error } = await adminDb().from("campaigns").insert({
      title: `${c.title} (copy)`, subject: c.subject, audience_type: c.audience_type, content: c.content,
      template: c.template || "plain", template_data: c.template_data || {}, manual_recipients: c.manual_recipients || [],
      blocks: src.blocks ?? null, preheader: src.preheader ?? null, kind: src.kind ?? "marketing",
      ...(src.tracking_enabled !== undefined && src.tracking_enabled !== null ? { tracking_enabled: src.tracking_enabled } : {}),
    }).select().single();
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Campaign duplicated" }); fetchCampaigns(); }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await adminDb().from("campaigns").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Campaign deleted" });
  };

  const resendFailed = async (c: Campaign) => {
    const failed = (c.total_recipients || 0) - (c.total_delivered || 0);
    if (failed <= 0) { toast({ title: "Nothing to retry", description: "All recipients were delivered." }); return; }
    toast({ title: `Retrying ${failed} failed recipients` });
    const { data, error } = await supabase.functions.invoke("send-campaign", { body: { campaignId: c.id, resendFailedOnly: true } });
    if (error) toast({ title: "Retry failed", description: error.message, variant: "destructive" });
    else { toast({ title: `Retry complete`, description: `Sent: ${data?.totalSent ?? 0}. Still failed: ${data?.totalFailed ?? 0}.` }); fetchCampaigns(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <MuPageHeader
        title="Campaigns"
        description="Email campaigns to patients, carers and staff, with delivery and open rates."
        actions={<Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />New campaign</Button>}
      />
      <Tabs value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
        <TabsList>
          <TabsTrigger value="active">Campaigns</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>
      {showingArchived && archived === null ? (
        <div className="flex justify-center border border-line bg-card py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : showingArchived && archivedFailed ? (
        <MuLoadError what="the archived campaigns" />
      ) : showingArchived && rows.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty art={art.objFolderDocuments} title="No archived campaigns" description="Archived campaigns appear here and can be restored." />
        </MuSection>
      ) : rows.length === 0 ? (
        <MuSection padded={false}>
          <MuEmpty
            art={art.objEnvelope}
            title="No campaigns yet"
            description="Start a campaign to write, preview and send an email."
            action={<Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />New campaign</Button>}
          />
        </MuSection>
      ) : (
      <>
      <div className="hidden overflow-x-auto border border-line bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Recipients</TableHead><TableHead>Delivered</TableHead><TableHead>Opened</TableHead><TableHead>Clicked</TableHead><TableHead>Date</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <div>{c.title || "Untitled"}</div>
                  {(c as any).created_by_name && <span className="text-xs text-muted-foreground">by {(c as any).created_by_name}</span>}
                </TableCell>
                <TableCell><MuStatus label={c.status} tone={statusTone[c.status] ?? "neutral"} /></TableCell>
                <TableCell>{c.total_recipients}</TableCell>
                <TableCell>
                  {c.total_delivered}
                  {c.status === "sent" && (c.total_recipients - c.total_delivered) > 0 && (
                    <span className="ml-2 text-xs text-destructive">({c.total_recipients - c.total_delivered} failed)</span>
                  )}
                </TableCell>
                <TableCell>
                  {c.status === "sent" && c.tracking_enabled === false ? (
                    <span className="text-xs text-muted-foreground">Not tracked</span>
                  ) : (
                    <>
                      {c.total_opened}
                      {c.status === "sent" && <span className="ml-2 text-xs text-muted-foreground">{pct(c.total_opened, c.total_delivered)}</span>}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {c.status === "sent" && c.tracking_enabled === false ? (
                    <span className="text-xs text-muted-foreground">Not tracked</span>
                  ) : (
                    <>
                      {c.total_clicked || 0}
                      {c.status === "sent" && <span className="ml-2 text-xs text-muted-foreground">{pct(c.total_clicked || 0, c.total_delivered)}</span>}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.sent_at ? format(new Date(c.sent_at), "dd MMM yyyy") : format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  {showingArchived ? (
                    <Button variant="ghost" size="sm" onClick={() => void restoreCampaign(c.id)}>
                      <ArchiveRestore className="mr-2 h-4 w-4" />Restore
                    </Button>
                  ) : (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild><Link to={`/admin/campaigns/${c.id}`} aria-label="Edit"><Pencil className="h-4 w-4" /></Link></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(c)} title="Duplicate" aria-label="Duplicate"><Copy className="h-4 w-4" /></Button>
                    {c.status === "sent" && (c.total_recipients - c.total_delivered) > 0 && (
                      <ConfirmAction
                        title="Retry the failed recipients?"
                        description={<p>{c.total_recipients - c.total_delivered} people who did not receive "{c.title}" will be sent it again.</p>}
                        confirmLabel="Send again"
                        onConfirm={() => resendFailed(c)}
                        trigger={<Button variant="ghost" size="icon" title="Resend to failed recipients"><Send className="h-4 w-4 text-primary" /></Button>}
                      />
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete campaign?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteCampaign(c.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConsoleMobileList
        emptyLabel="No campaigns yet."
        emptyIcon={Megaphone}
        rows={rows.map((c) => ({
          key: c.id,
          title: c.title || "Untitled",
          state: `${c.total_recipients} recipients, ${c.sent_at ? format(new Date(c.sent_at), "dd MMM yyyy") : format(new Date(c.created_at), "dd MMM yyyy")}`,
          status: <MuStatus label={c.status} tone={statusTone[c.status] ?? "neutral"} />,
          // An archived row carries its Restore button, so it is not a link as well.
          ...(showingArchived
            ? {
                trailing: (
                  <Button variant="outline" size="sm" onClick={() => void restoreCampaign(c.id)}>
                    <ArchiveRestore className="mr-2 h-4 w-4" />Restore
                  </Button>
                ),
              }
            : { to: `/admin/campaigns/${c.id}` }),
        }))}
      />
      </>
      )}
    </div>
  );
};

export default Campaigns;
