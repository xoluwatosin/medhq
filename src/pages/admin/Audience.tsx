import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Plus, Search, Trash2, Users, ArrowRight, Upload, FileDown } from "lucide-react";
import { PAGE_SIZE, adminDb, downloadTemplate, parseCSV } from "@/lib/admin-utils";
import ExportDropdown from "@/components/admin/ExportDropdown";
import { format } from "date-fns";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { selectAll } from "@/lib/select-all";

interface Group { id: string; name: string; description: string; created_at: string; }
interface Member { id: string; email: string; name: string; group_id: string; source: string; created_at: string; }

const Audience = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [engagement, setEngagement] = useState("all");
  const [engaged, setEngaged] = useState<{ opened: Set<string>; clicked: Set<string> }>({ opened: new Set(), clicked: new Set() });
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveGroupId, setMoveGroupId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importGroupId, setImportGroupId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ valid: number; skipped: number; rows: { email: string; name: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const fetchAll = async () => {
    const db = adminDb();
    const [g, m] = await Promise.all([
      db.from("audience_groups").select("*").order("created_at"),
      // Every contact: a plain select stops at 1,000 rows.
      selectAll<any>((a, z) =>
        db.from("audience_members").select("*").order("created_at", { ascending: false }).order("id").range(a, z),
      ).catch(() => null),
    ]);
    if (g.error || !m) toast({ title: "Could not load the audience", description: "Reload to try again.", variant: "destructive" });
    setGroups(g.data || []);
    setMembers(m || []);
    if (!newGroupId && g.data?.length) setNewGroupId(g.data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Engagement memory from the email event stream, so the audience can be
  // sliced by who actually reads what we send.
  useEffect(() => {
    selectAll<any>((a, z) =>
      (adminDb() as any)
        .from("campaign_events")
        .select("id, event_type, recipient_email")
        .in("event_type", ["opened", "clicked"])
        .order("id")
        .range(a, z),
    )
      .then((data: any[]) => {
        const opened = new Set<string>();
        const clicked = new Set<string>();
        for (const r of data || []) {
          const em = String(r.recipient_email || "").toLowerCase();
          if (!em) continue;
          if (r.event_type === "opened") opened.add(em);
          if (r.event_type === "clicked") { clicked.add(em); opened.add(em); }
        }
        setEngaged({ opened, clicked });
      })
      .catch(() => { /* engagement slices are a nicety; the list still works without them */ });
  }, []);

  const addMember = async () => {
    if (!newEmail || !newGroupId) return;
    const { error } = await adminDb().from("audience_members").insert({ email: newEmail, name: newName, group_id: newGroupId });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Member added" }); setAddOpen(false); setNewEmail(""); setNewName(""); fetchAll(); }
  };

  const createGroup = async () => {
    if (!groupName) return;
    const { error } = await adminDb().from("audience_groups").insert({ name: groupName, description: groupDesc });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Group created" }); setNewGroupOpen(false); setGroupName(""); setGroupDesc(""); fetchAll(); }
  };

  const deleteMember = async (id: string) => {
    const { error } = await adminDb().from("audience_members").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove them", description: error.message, variant: "destructive" });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((m) => m.id)));
    }
  };

  const moveSelected = async () => {
    if (!moveGroupId || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await adminDb().from("audience_members").update({ group_id: moveGroupId }).in("id", ids);
    if (error) {
      toast({ title: "Error moving members", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Moved ${ids.length} member${ids.length > 1 ? "s" : ""}` });
      setSelected(new Set());
      setMoveGroupId("");
      fetchAll();
    }
  };

  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const filtered = members.filter((m) => {
    const matchesSearch = !search || [m.email, m.name].some((f) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchesGroup = groupFilter === "all" || m.group_id === groupFilter;
    const em = m.email.toLowerCase();
    const matchesEngagement =
      engagement === "all" ||
      (engagement === "opened" && engaged.opened.has(em)) ||
      (engagement === "clicked" && engaged.clicked.has(em)) ||
      (engagement === "opened_no_click" && engaged.opened.has(em) && !engaged.clicked.has(em)) ||
      (engagement === "no_open" && !engaged.opened.has(em));
    return matchesSearch && matchesGroup && matchesEngagement;
  });
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold">Audience</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewGroupOpen(true)}><Users className="mr-2 h-4 w-4" />New Group</Button>
          <ExportDropdown data={filtered.map((m) => ({ ...m, group: groupMap[m.group_id] }))} filename="audience" />
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Member</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {groups.map((g) => (
          <div key={g.id} className="text-xs px-3 py-1 rounded-full border bg-muted/50">
            {g.name} <span className="text-muted-foreground">({members.filter((m) => m.group_id === g.id).length})</span>
          </div>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Select value={moveGroupId} onValueChange={setMoveGroupId}>
            <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Move to group…" /></SelectTrigger>
            <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="default" onClick={moveSelected} disabled={!moveGroupId}>Move</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="mb-4">
        <div className="relative mb-3 max-w-sm md:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search email or name…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <details className="mb-3 rounded-lg border border-line-soft bg-card md:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-navy">Filter</summary>
          <div className="space-y-3 px-4 pb-4">
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={engagement} onValueChange={(v) => { setEngagement(v); setPage(0); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any engagement</SelectItem>
                <SelectItem value="opened">Opened an email</SelectItem>
                <SelectItem value="clicked">Clicked a link</SelectItem>
                <SelectItem value="opened_no_click">Opened, never clicked</SelectItem>
                <SelectItem value="no_open">Never opened</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </details>
        <div className="hidden gap-3 md:flex">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search email or name…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={engagement} onValueChange={(v) => { setEngagement(v); setPage(0); }}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any engagement</SelectItem>
              <SelectItem value="opened">Opened an email</SelectItem>
              <SelectItem value="clicked">Clicked a link</SelectItem>
              <SelectItem value="opened_no_click">Opened, never clicked</SelectItem>
              <SelectItem value="no_open">Never opened</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="hidden md:block overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleSelectAll} /></TableHead>
              <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Source</TableHead><TableHead>Added</TableHead><TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No members found.</TableCell></TableRow>
            ) : paged.map((m) => (
              <TableRow key={m.id}>
                <TableCell><Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} /></TableCell>
                <TableCell className="font-medium">{m.email}</TableCell>
                <TableCell>{m.name || "—"}</TableCell>
                <TableCell>{groupMap[m.group_id] || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.source}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell><ConfirmAction title="Remove this contact?" description={<p>{m.email} comes off the audience list and stops receiving campaigns.</p>} confirmLabel="Remove" destructive onConfirm={() => deleteMember(m.id)} trigger={<Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConsoleMobileList
        emptyLabel="No members found."
        emptyIcon={Users}
        rows={paged.map((m) => ({
          key: m.id,
          title: m.name || m.email,
          state: `${groupMap[m.group_id] || "No group"} · added ${format(new Date(m.created_at), "dd MMM yyyy")}`,
          trailing: (
            <ConfirmAction
              title="Remove this contact?"
              description={<p>{m.email} comes off the audience list and stops receiving campaigns.</p>}
              confirmLabel="Remove"
              destructive
              onConfirm={() => deleteMember(m.id)}
              trigger={<Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            />
          ),
        }))}
      />
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email *</Label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><Label>Group</Label>
              <Select value={newGroupId} onValueChange={setNewGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={addMember}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} /></div>
            <div><Label>Description</Label><Input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={createGroup}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportFile(null); setImportPreview(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import Audience Members</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Group *</Label>
              <Select value={importGroupId} onValueChange={setImportGroupId}>
                <SelectTrigger><SelectValue placeholder="Select group…" /></SelectTrigger>
                <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(["email", "name"], ["example@email.com", "John Doe"], "audience-import")}>
              <FileDown className="mr-2 h-4 w-4" />Download Template
            </Button>
            <div>
              <Label>Upload CSV</Label>
              <Input type="file" accept=".csv" onChange={(e) => {
                const file = e.target.files?.[0];
                setImportFile(file || null);
                setImportPreview(null);
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const { headers, rows } = parseCSV(ev.target?.result as string);
                    const emailIdx = headers.findIndex((h) => h.toLowerCase() === "email");
                    const nameIdx = headers.findIndex((h) => h.toLowerCase() === "name");
                    if (emailIdx === -1) { toast({ title: "CSV must have an 'email' column", variant: "destructive" }); return; }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    const valid: { email: string; name: string }[] = [];
                    let skipped = 0;
                    rows.forEach((r) => {
                      const email = r[emailIdx]?.trim();
                      if (email && emailRegex.test(email)) valid.push({ email, name: nameIdx >= 0 ? r[nameIdx]?.trim() || "" : "" });
                      else skipped++;
                    });
                    setImportPreview({ valid: valid.length, skipped, rows: valid });
                  };
                  reader.readAsText(file);
                }
              }} />
            </div>
            {importPreview && (
              <div className="text-sm p-3 rounded border bg-muted/30">
                <p><strong>{importPreview.valid}</strong> valid rows ready to import</p>
                {importPreview.skipped > 0 && <p className="text-muted-foreground">{importPreview.skipped} rows skipped (invalid email)</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={!importGroupId || !importPreview?.rows.length || importing} onClick={async () => {
              if (!importPreview?.rows.length || !importGroupId) return;
              setImporting(true);
              const batch = importPreview.rows.map((r) => ({ email: r.email, name: r.name, group_id: importGroupId, source: "csv_import" }));
              const { error } = await adminDb().from("audience_members").insert(batch);
              setImporting(false);
              if (error) toast({ title: "Import failed", description: error.message, variant: "destructive" });
              else { toast({ title: `Imported ${batch.length} members` }); setImportOpen(false); setImportFile(null); setImportPreview(null); fetchAll(); }
            }}>
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Audience;
