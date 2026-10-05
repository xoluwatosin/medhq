import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { SelectField } from "@/components/field";

interface Group { id: string; name: string }

interface Props {
  groups: Group[];
  onGroupsChanged: () => void | Promise<void>;
  selectedGroupIds?: string[];
  onGroupCreated?: (group: Group) => void;
  disabled?: boolean;
  /** Show only the create-group button (used when no group is selected yet) */
  compact?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRow { email: string; name: string }
function parsePastedList(input: string): { valid: ParsedRow[]; skipped: number } {
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid: ParsedRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const line of lines) {
    // Accept "email, name" or "email,name" or "name <email>" or just "email"
    let email = "";
    let name = "";
    const angle = line.match(/^(.*)<\s*([^>]+)\s*>$/);
    if (angle) {
      name = angle[1].trim().replace(/^["']|["']$/g, "");
      email = angle[2].trim();
    } else if (line.includes(",")) {
      const [a, ...rest] = line.split(",");
      email = a.trim();
      name = rest.join(",").trim();
    } else if (/\s/.test(line) && EMAIL_RE.test(line.split(/\s+/).pop()!)) {
      const parts = line.split(/\s+/);
      email = parts.pop()!;
      name = parts.join(" ");
    } else {
      email = line.trim();
    }
    email = email.toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    valid.push({ email, name });
  }
  return { valid, skipped };
}

const AudienceGroupManager = ({ groups, onGroupsChanged, selectedGroupIds = [], onGroupCreated, disabled, compact }: Props) => {
  const { toast } = useToast();

  // Create group dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Add members dialog
  const [addOpen, setAddOpen] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [pasted, setPasted] = useState("");
  const [single, setSingle] = useState({ email: "", name: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (selectedGroupIds.length && !targetGroupId) setTargetGroupId(selectedGroupIds[0]);
  }, [selectedGroupIds, targetGroupId]);

  const createGroup = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const { data, error } = await adminDb()
      .from("audience_groups")
      .insert({ name: name.trim(), description: desc.trim() || null })
      .select("id, name")
      .single();
    setCreating(false);
    if (error) {
      toast({ title: "Could not create group", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Group created", description: data.name });
    setName(""); setDesc(""); setCreateOpen(false);
    await onGroupsChanged();
    onGroupCreated?.(data as Group);
  };

  const addMembers = async () => {
    const groupId = targetGroupId || selectedGroupIds[0];
    if (!groupId) {
      toast({ title: "Pick a group first", variant: "destructive" });
      return;
    }
    let rows: ParsedRow[] = [];
    let skipped = 0;
    if (pasted.trim()) {
      const parsed = parsePastedList(pasted);
      rows = parsed.valid; skipped = parsed.skipped;
    }
    if (single.email.trim()) {
      const e = single.email.trim().toLowerCase();
      if (EMAIL_RE.test(e) && !rows.some((r) => r.email === e)) {
        rows.push({ email: e, name: single.name.trim() });
      } else if (!EMAIL_RE.test(e)) {
        skipped++;
      }
    }
    if (rows.length === 0) {
      toast({ title: "Nothing to add", description: "Enter a valid email or paste a list.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const batch = rows.map((r) => ({ email: r.email, name: r.name, group_id: groupId, source: "manual" }));
    const { error } = await adminDb().from("audience_members").upsert(batch, { onConflict: "email,group_id", ignoreDuplicates: true });
    setAdding(false);
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `Added ${rows.length} member${rows.length === 1 ? "" : "s"}`,
      description: skipped ? `${skipped} skipped (invalid or duplicate)` : undefined,
    });
    setPasted(""); setSingle({ email: "", name: "" }); setAddOpen(false);
    await onGroupsChanged();
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Plus className="h-3.5 w-3.5 mr-1" />New group
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create audience group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Group name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, ICU nurses in Lagos" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createGroup} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!compact && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={disabled || groups.length === 0}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />Add members
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add members to a group</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <SelectField
                label="Group"
                value={targetGroupId}
                onChange={setTargetGroupId}
                placeholder="Pick a group"
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
              <Tabs defaultValue="paste">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="paste">Paste list</TabsTrigger>
                  <TabsTrigger value="single">Add one</TabsTrigger>
                </TabsList>
                <TabsContent value="paste" className="space-y-2 pt-3">
                  <Label className="text-xs text-muted-foreground">
                    One per line. Accepts <code>email</code>, <code>email, name</code>, or <code>Name &lt;email&gt;</code>.
                  </Label>
                  <Textarea
                    rows={7}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={"sade@example.com\nchidi@example.com, Chidi Okafor\nAdaeze Nwosu <adaeze@example.com>"}
                  />
                  {pasted.trim() && (() => {
                    const p = parsePastedList(pasted);
                    return <p className="text-xs text-muted-foreground">{p.valid.length} valid{p.skipped ? `, ${p.skipped} skipped` : ""}</p>;
                  })()}
                </TabsContent>
                <TabsContent value="single" className="space-y-2 pt-3">
                  <div><Label>Email *</Label><Input value={single.email} onChange={(e) => setSingle({ ...single, email: e.target.value })} /></div>
                  <div><Label>Name</Label><Input value={single.name} onChange={(e) => setSingle({ ...single, name: e.target.value })} /></div>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={addMembers} disabled={adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AudienceGroupManager;
