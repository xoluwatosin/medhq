import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Search, Trash2, Users, ArrowRight, Upload, FileDown, MoreHorizontal, ChevronDown } from "lucide-react";
import { PAGE_SIZE, adminDb, downloadTemplate, parseCSV } from "@/lib/admin-utils";
import { ExportMenuItems } from "@/components/admin/ExportDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MuEmpty, MuPageHeader, MuSection, MuToolbar } from "@/components/admin/mu/MuShell";
import { SelectField } from "@/components/field";
import { art } from "@/components/mc/art";
import { format } from "date-fns";
import ConsoleMobileList from "@/components/admin/console/ConsoleMobileList";
import { selectAll } from "@/lib/select-all";
import { createAudienceGroup, deleteAudienceGroup, renameAudienceGroup } from "@/lib/audience-groups";

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

  const [editGroup, setEditGroup] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [dropGroup, setDropGroup] = useState<any | null>(null);
  const saveGroup = async () => {
    try {
      await renameAudienceGroup(editGroup.id, editName, editDesc);
      toast({ title: "Group renamed" });
      setEditGroup(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Could not rename", description: error.message, variant: "destructive" });
    }
  };
  const removeGroup = async () => {
    try {
      await deleteAudienceGroup(dropGroup.id);
      toast({ title: "Group deleted" });
      setDropGroup(null);
      fetchAll();
    } catch (error: any) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    }
  };

  const createGroup = async () => {
    if (!groupName) return;
    try {
      const made = await createAudienceGroup(groupName, groupDesc);
      toast({ title: made.reused ? "That group already exists" : "Group created" });
      setNewGroupOpen(false); setGroupName(""); setGroupDesc(""); fetchAll();
    } catch (error: any) {
      toast({ title: "Could not create group", description: error.message, variant: "destructive" });
    }
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

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));
  const engagementOptions = [
    { value: "all", label: "Any engagement" },
    { value: "opened", label: "Opened an email" },
    { value: "clicked", label: "Clicked a link" },
    { value: "opened_no_click", label: "Opened, never clicked" },
    { value: "no_open", label: "Never opened" },
  ];
  const groupFilterOptions = [{ value: "all", label: "All groups" }, ...groupOptions];
  const onGroupFilter = (v: string) => { setGroupFilter(v || "all"); setPage(0); };
  const onEngagement = (v: string) => { setEngagement(v || "all"); setPage(0); };
  const hasFilters = !!search || groupFilter !== "all" || engagement !== "all";

  return (
    <div className="space-y-6">
      <MuPageHeader
        title="Audience"
        description="Everyone who can receive a campaign, sorted into groups."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import</Button>
            <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add member</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="More actions"><MoreHorizontal className="mr-2 h-4 w-4" />More</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNewGroupOpen(true)}><Users className="mr-2 h-4 w-4" />New group</DropdownMenuItem>
                <DropdownMenuSeparator />
                <ExportMenuItems data={filtered.map((m) => ({ ...m, group: groupMap[m.group_id] }))} filename="audience" />
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {groups.length > 0 && (
        <div className="border-2 border-navy bg-tint/40 p-3">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-label">Groups</p>
          <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const count = members.filter((m) => m.group_id === g.id).length;
            return (
              <DropdownMenu key={g.id}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="border border-line bg-card px-2.5 py-1 text-xs font-semibold text-navy hover:border-brand">
                    {g.name} <span className="font-normal text-muted-foreground">({count})</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => { setEditGroup(g); setEditName(g.name); setEditDesc(g.description ?? ""); }}>Rename</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDropGroup({ ...g, count })}>Delete group</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <MuToolbar>
          <span className="text-sm font-semibold text-navy">{selected.size} selected</span>
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
          <SelectField
            label="Move to group"
            hideLabel
            placeholder="Move to group"
            value={moveGroupId}
            onChange={setMoveGroupId}
            options={groupOptions}
            className="lg:w-56"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={moveSelected} disabled={!moveGroupId}>Move</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </MuToolbar>
      )}

      <div>
        <div className="md:hidden">
        <MuToolbar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search email or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
            Group and engagement
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 pb-1">
            <SelectField label="Group" hideLabel value={groupFilter} onChange={onGroupFilter} options={groupFilterOptions} placeholder="All groups" />
            <SelectField label="Engagement" hideLabel value={engagement} onChange={onEngagement} options={engagementOptions} placeholder="Any engagement" />
          </div>
        </details>
        </MuToolbar>
        </div>
        <div className="hidden md:block">
          <MuToolbar>
            <div className="relative flex-1 lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search email or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <SelectField label="Group" hideLabel value={groupFilter} onChange={onGroupFilter} options={groupFilterOptions} placeholder="All groups" className="lg:w-52" />
            <SelectField label="Engagement" hideLabel value={engagement} onChange={onEngagement} options={engagementOptions} placeholder="Any engagement" className="lg:w-56" />
          </MuToolbar>
        </div>
      </div>
      {paged.length === 0 ? (
        <MuSection padded={false}>
          {hasFilters ? (
            <MuEmpty art={art.objMagnifier} title="No matching members" description="Try a different search or clear the filters." />
          ) : (
            <MuEmpty
              art={art.objEnvelope}
              title="No members yet"
              description="Add people one at a time or import a CSV of email addresses."
              action={<Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Add member</Button>}
            />
          )}
        </MuSection>
      ) : (
      <>
      <div className="hidden overflow-x-auto border border-line bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox aria-label="Select all on this page" checked={paged.length > 0 && selected.size === paged.length} onCheckedChange={toggleSelectAll} /></TableHead>
              <TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Source</TableHead><TableHead>Added</TableHead><TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((m) => (
              <TableRow key={m.id}>
                <TableCell><Checkbox aria-label={`Select ${m.email}`} checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} /></TableCell>
                <TableCell className="font-medium">{m.email}</TableCell>
                <TableCell>{m.name || <span className="text-muted-foreground">Not given</span>}</TableCell>
                <TableCell>{groupMap[m.group_id] || <span className="text-muted-foreground">No group</span>}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.source}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell><ConfirmAction title="Remove this contact?" description={<p>{m.email} comes off the audience list and stops receiving campaigns.</p>} confirmLabel="Remove" destructive onConfirm={() => deleteMember(m.id)} trigger={<Button variant="ghost" size="icon" aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConsoleMobileList
        emptyLabel="No members found"
        emptyIcon={Users}
        rows={paged.map((m) => ({
          key: m.id,
          title: m.name || m.email,
          state: `${groupMap[m.group_id] || "No group"}, added ${format(new Date(m.created_at), "dd MMM yyyy")}`,
          trailing: (
            <ConfirmAction
              title="Remove this contact?"
              description={<p>{m.email} comes off the audience list and stops receiving campaigns.</p>}
              confirmLabel="Remove"
              destructive
              onConfirm={() => deleteMember(m.id)}
              trigger={<Button variant="ghost" size="icon" aria-label="Remove"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            />
          ),
        }))}
      />
      </>
      )}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email *</Label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <SelectField label="Group" value={newGroupId} onChange={setNewGroupId} options={groupOptions} placeholder="Choose a group" />
          </div>
          <DialogFooter><Button onClick={addMember}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={groupName} onChange={(e) => setGroupName(e.target.value)} /></div>
            <div><Label>Description</Label><Input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={createGroup}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportFile(null); setImportPreview(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import audience members</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <SelectField label="Target group" required value={importGroupId} onChange={setImportGroupId} options={groupOptions} placeholder="Choose a group" />
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(["email", "name"], ["example@email.com", "John Doe"], "audience-import")}>
              <FileDown className="mr-2 h-4 w-4" />Download template
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
              <div className="border border-line bg-muted/30 p-3 text-sm">
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
              {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing</> : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editGroup} onOpenChange={(o) => { if (!o) setEditGroup(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Group name" aria-label="Group name" />
            <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" aria-label="Description" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancel</Button>
            <Button onClick={() => void saveGroup()} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmAction
        open={!!dropGroup}
        onOpenChange={(o) => { if (!o) setDropGroup(null); }}
        title={`Delete ${dropGroup?.name ?? "this group"}?`}
        description={`${dropGroup?.count ?? 0} ${dropGroup?.count === 1 ? "person is" : "people are"} in this group. They are removed from it, but stay in any other group. Campaigns that used it keep their history.`}
        confirmLabel="Delete group"
        destructive
        onConfirm={removeGroup}
      />
    </div>
  );
};

export default Audience;
