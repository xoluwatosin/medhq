import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Plus, Share2, Copy, ExternalLink, Inbox, Files, ArrowLeft, MoreHorizontal, Archive, ArchiveRestore, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  open: "default",
  closed: "secondary",
  archived: "destructive",
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

  const emptyCopy: Record<View, string> = {
    active: "No live opportunities yet. Create your first to get a shareable link.",
    archived: "Nothing archived. Archived opportunities keep their applications but drop off the public list.",
    bin: "The bin is empty. Binned opportunities stay here until you delete them for good.",
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
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-3">
            <Link to="/admin/match-universe"><ArrowLeft className="mr-2 h-4 w-4" />Match Universe</Link>
          </Button>
          <h1 className="text-2xl font-serif font-bold">Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">Post internal and partner opportunities. Public pages keep the Healthcare Matchmakers Network branding.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/admin/match-universe/opportunities/templates">Question templates</Link></Button>
          <Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />New opportunity</Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">Live ({buckets.active.length})</TabsTrigger>
          <TabsTrigger value="archived">Archive ({buckets.archived.length})</TabsTrigger>
          <TabsTrigger value="bin">Bin ({buckets.bin.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <Share2 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{emptyCopy[view]}</p>
        </div>
      ) : (
        <div className="hidden md:block border border-border rounded-2xl overflow-hidden bg-background">
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
                  <TableCell className="text-sm text-muted-foreground">{r.location || "—"}</TableCell>
                  <TableCell>
                    {r.deleted_at
                      ? <Badge variant="destructive">In bin</Badge>
                      : <Badge variant={statusVariant[r.status]}>{STATUS_LABELS[r.status]}</Badge>}
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
            state: [r.location || "No location", STATUS_LABELS[r.status] ?? r.status].filter(Boolean).join(" · "),
            status: r.deleted_at
              ? <Badge variant="destructive">In bin</Badge>
              : <Badge variant={statusVariant[r.status]}>{STATUS_LABELS[r.status]}</Badge>,
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
    </div>
  );
};

export default MatchUniverseOpportunities;
