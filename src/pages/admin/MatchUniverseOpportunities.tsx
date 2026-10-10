import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Plus, Share2, Copy, ExternalLink, Inbox, Files, MoreHorizontal, Archive, ArchiveRestore, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import { MuEmpty, MuPage, MuPageHeader, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { buildShareUrl, ensureUniqueSlug, STATUS_LABELS } from "@/lib/matchmaker";
import { useAuth } from "@/contexts/AuthContext";
import ConsoleMobileList, { ConsoleMobileRow } from "@/components/admin/console/ConsoleMobileList";


interface Row {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  status: string;
  link_target: "detail" | "landing";
  created_at: string;
  deleted_at: string | null;
  application_count?: number;
}

const statusTone: Record<string, MuTone> = {
  draft: "neutral",
  open: "good",
  closed: "neutral",
  archived: "warning",
};

type View = "active" | "archived" | "bin";

const MatchUniverseOpportunities = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("active");
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();


  const fetchData = async () => {
    setLoading(true);
    const { data: ops, error } = await adminDb()
      .from("matchmaker_opportunities")
      .select("*")
      // Client requests live on their own page; this list is public postings only.
      .neq("kind", "request")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const { data: apps } = await adminDb()
      .from("matchmaker_applications")
      .select("opportunity_id");
    const counts: Record<string, number> = {};
    (apps || []).forEach((a: any) => {
      counts[a.opportunity_id] = (counts[a.opportunity_id] || 0) + 1;
    });
    setRows((ops || []).map((o: any) => ({ ...o, application_count: counts[o.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const buckets = useMemo(() => ({
    active: rows.filter((r) => !r.deleted_at && r.status !== "archived"),
    archived: rows.filter((r) => !r.deleted_at && r.status === "archived"),
    bin: rows.filter((r) => !!r.deleted_at),
  }), [rows]);

  const visible = buckets[view];

  const patch = async (id: string, values: Record<string, any>, message: string) => {
    const { error } = await adminDb().from("matchmaker_opportunities").update(values).eq("id", id);
    if (error) { toast({ title: "Could not update", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...values } as Row : r)));
    toast({ title: message });
  };

  const archive = (r: Row) => patch(r.id, { status: "archived" }, "Moved to archive");
  const unarchive = (r: Row) => patch(r.id, { status: "draft" }, "Restored as a draft");
  const bin = (r: Row) => patch(r.id, { deleted_at: new Date().toISOString() }, "Moved to bin");
  const restore = (r: Row) => patch(r.id, { deleted_at: null }, "Restored from bin");

  const purge = async () => {
    if (!purgeTarget) return;
    if (!isSuperAdmin) {
      toast({ title: "Not allowed", description: "Only the super admin can delete for good.", variant: "destructive" });
      setPurgeTarget(null);
      return;
    }
    const { error } = await adminDb().from("matchmaker_opportunities").delete().eq("id", purgeTarget.id);

    if (error) { toast({ title: "Could not delete", description: error.message, variant: "destructive" }); return; }
    setRows((prev) => prev.filter((r) => r.id !== purgeTarget.id));
    setPurgeTarget(null);
    toast({ title: "Deleted for good" });
  };

  const emptyTitle: Record<View, string> = {
    active: "No live opportunities",
    archived: "Nothing archived",
    bin: "The bin is empty",
  };
  const emptyCopy: Record<View, string> = {
    active: "Create your first to get a shareable link.",
    archived: "Archived opportunities keep their applications but drop off the public list.",
    bin: "Binned opportunities stay here until you delete them for good.",
  };

  const createNew = async () => {
    const { data, error } = await adminDb()
      .from("matchmaker_opportunities")
      .insert({
        title: "Untitled opportunity",
        slug: `untitled-${Date.now()}`,
        status: "draft",
        link_target: "detail",
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Could not create", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/admin/match-universe/opportunities/${data.id}`);
  };

  const copyLink = (slug: string, target: "detail" | "landing") => {
    const url = buildShareUrl(slug, target);
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: url });
  };

  const duplicate = async (id: string) => {
    const { data: src, error } = await adminDb()
      .from("matchmaker_opportunities")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !src) { toast({ title: "Could not load opportunity", variant: "destructive" }); return; }
    const newSlug = await ensureUniqueSlug(`${src.slug}-copy`);
    const { id: _oldId, created_at, updated_at, created_by, closed_at, ...rest } = src as any;
    const { data, error: insErr } = await adminDb()
      .from("matchmaker_opportunities")
      .insert({ ...rest, slug: newSlug, title: `${src.title} (copy)`, status: "draft" })
      .select("id")
      .single();
    if (insErr) { toast({ title: "Could not duplicate", description: insErr.message, variant: "destructive" }); return; }
    toast({ title: "Duplicated as draft" });
    navigate(`/admin/match-universe/opportunities/${data.id}`);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <MuPage>
      <MuPageHeader
        title="Opportunities"
        description="Public postings and their share links."
        actions={
          <>
            <Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />New opportunity</Button>
            <Button variant="outline" asChild><Link to="/admin/match-universe/opportunities/templates">Question templates</Link></Button>
          </>
        }
      />

      <ConsoleTabs
        label="Opportunity view"
        active={view}
        onChange={(id) => setView(id as View)}
        tabs={[
          { id: "active", label: "Live", count: buckets.active.length },
          { id: "archived", label: "Archive", count: buckets.archived.length },
          { id: "bin", label: "Bin", count: buckets.bin.length },
        ]}
      />

      {visible.length === 0 ? (
        <div className="border border-line bg-card">
          <MuEmpty
            art={view === "active" ? art.objClipboard : art.objFolderDocuments}
            title={emptyTitle[view]}
            description={emptyCopy[view]}
          />
        </div>
      ) : (
        <div className="hidden md:block border border-line overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Link target</TableHead>
                <TableHead className="text-center">Apps</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/admin/match-universe/opportunities/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5">/hm/{r.slug}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.location || "Not stated"}</TableCell>
                  <TableCell>
                    {r.deleted_at
                      ? <MuStatus tone="warning" label="In bin" />
                      : <MuStatus tone={statusTone[r.status] ?? "neutral"} label={STATUS_LABELS[r.status] ?? r.status} />}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{r.link_target}</TableCell>
                  <TableCell className="text-center">
                    <Link to={`/admin/match-universe/opportunities/${r.id}/applications`} className="inline-flex items-center gap-1 text-sm hover:underline">
                      <Inbox className="h-3.5 w-3.5" />{r.application_count}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copyLink(r.slug, r.link_target)} title="Copy share link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicate(r.id)} title="Duplicate as draft">
                        <Files className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild title={r.status === "draft" ? "Preview draft" : "Open public page"}>
                        <a href={r.status === "draft" || r.status === "archived" ? `/hm/${r.slug}?preview=1` : buildShareUrl(r.slug, r.link_target)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" title="More"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          {r.deleted_at ? (
                            <>
                              <DropdownMenuItem onClick={() => restore(r)}>
                                <RotateCcw className="mr-2 h-4 w-4" />Restore from bin
                              </DropdownMenuItem>
                              {isSuperAdmin ? (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setPurgeTarget(r)}>
                                  <Trash2 className="mr-2 h-4 w-4" />Delete for good
                                </DropdownMenuItem>
                              ) : null}
                            </>
                          ) : (

                            <>
                              {r.status === "archived" ? (
                                <DropdownMenuItem onClick={() => unarchive(r)}>
                                  <ArchiveRestore className="mr-2 h-4 w-4" />Restore as draft
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => archive(r)}>
                                  <Archive className="mr-2 h-4 w-4" />Archive
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => bin(r)}>
                                <Trash2 className="mr-2 h-4 w-4" />Move to bin
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {visible.length > 0 && (
        <ConsoleMobileList
          emptyLabel={emptyCopy[view]}
          emptyIcon={Share2}
          rows={visible.map((r): ConsoleMobileRow => ({
            key: r.id,
            title: r.title,
            state: r.location || "No location",
            status: r.deleted_at
              ? <MuStatus tone="warning" label="In bin" />
              : <MuStatus tone={statusTone[r.status] ?? "neutral"} label={STATUS_LABELS[r.status] ?? r.status} />,
            to: `/admin/match-universe/opportunities/${r.id}`,
          }))}
        />
      )}

      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this opportunity?</AlertDialogTitle>
            <AlertDialogDescription>
              "{purgeTarget?.title}" and its shareable link go for good. Any applications attached to it are removed with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={purge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MuPage>
  );
};

export default MatchUniverseOpportunities;
