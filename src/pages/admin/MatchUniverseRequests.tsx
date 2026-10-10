import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, ClipboardList, MapPin, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ConsoleTabs from "@/components/admin/console/ConsoleTabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { MuPage, MuPageHeader, MuRecord, MuFieldGrid, MuField, MuEmpty, MuStatus, type MuTone } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import RequirementChoices, { type RequirementChoiceValue } from "@/components/admin/mu/RequirementChoices";

interface RequestRow {
  id: string;
  title: string;
  brief: string | null;
  location: string | null;
  request_status: string;
  start_date: string | null;
  start_asap: boolean;
  last_matched_at: string | null;
  last_match_count: number | null;
  created_at: string;
  deleted_at: string | null;
}

export const REQUEST_STATUS: { value: string; label: string; help: string }[] = [
  { value: "draft", label: "Draft", help: "Still writing down what the client needs." },
  { value: "ready", label: "Ready to match", help: "The brief is complete enough to run against the pool." },
  { value: "matched", label: "Candidates submitted", help: "Candidates have been put forward to the client." },
  { value: "closed", label: "Closed", help: "The client no longer needs cover." },
];

const statusTone: Record<string, MuTone> = {
  draft: "neutral",
  ready: "info",
  matched: "good",
  closed: "neutral",
};

export default function MatchUniverseRequests() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"open" | "closed">("open");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  // Requirements are picked, not written. The brief is only context.
  const [criteria, setCriteria] = useState<RequirementChoiceValue>({
    match_professions: [],
    match_care_types: [],
    match_shift_patterns: [],
    match_live_in: "any",
    match_min_years: null,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminDb()
      .from("matchmaker_opportunities")
      .select("id, title, brief, location, request_status, start_date, start_asap, last_matched_at, last_match_count, created_at, deleted_at")
      .eq("kind", "request")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Could not load requests", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data as any) || []);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => rows.filter((r) => (view === "open" ? r.request_status !== "closed" : r.request_status === "closed")),
    [rows, view],
  );

  const create = async () => {
    if (!title.trim()) {
      toast({ title: "Give the request a reference", description: "A short name, such as Live-in nurse, Lekki family.", variant: "destructive" });
      return;
    }
    if ((criteria.match_professions?.length ?? 0) === 0 && (criteria.match_care_types?.length ?? 0) === 0) {
      toast({
        title: "Pick at least one requirement",
        description: "Choose a profession or a type of care so the pool can be ranked.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    const { data, error } = await adminDb()
      .from("matchmaker_opportunities")
      .insert({
        kind: "request",
        title: title.trim(),
        slug: `request-${Date.now()}`,
        status: "draft",
        request_status: "draft",
        link_target: "detail",
        brief: brief.trim() || null,
        match_professions: criteria.match_professions ?? [],
        match_care_types: criteria.match_care_types ?? [],
        match_shift_patterns: criteria.match_shift_patterns ?? [],
        match_live_in: criteria.match_live_in ?? "any",
        match_min_years: criteria.match_min_years,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Could not create the request", description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/admin/match-universe/requests/${data.id}`);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <MuPage className="max-w-5xl mx-auto">
      <MuPageHeader
        title="Staffing requests"
        description="Client requests ranked against the candidate pool."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New client request</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>New client request</DialogTitle>
                <DialogDescription>Location and start date are set on the request.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Reference</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live-in nurse, Lekki family" />
                </div>
                <RequirementChoices
                  compact
                  value={criteria}
                  onChange={(next) => setCriteria({ ...criteria, ...next })}
                />
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Anything else the client said (optional)</label>
                  <Textarea
                    rows={4}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Father, 78, recovering from a stroke. The family would like the same person each week."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create} disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <ConsoleTabs
        label="Request view"
        active={view}
        onChange={(id) => setView(id as typeof view)}
        tabs={[
          { id: "open", label: "Open" },
          { id: "closed", label: "Closed" },
        ]}
      />

      {visible.length === 0 ? (
        <div className="border border-line bg-card">
          <MuEmpty
            art={art.objClipboard}
            title={view === "open" ? "No open requests" : "No closed requests"}
            description={view === "open" ? "Create a request and write down what the client told you." : "Closed requests appear here once a request is finished."}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <div
              key={r.id}
              className="cursor-pointer border border-line bg-card transition-colors hover:bg-muted/40"
              onClick={() => navigate(`/admin/match-universe/requests/${r.id}`)}
            >
              <MuRecord
                lead={
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-tint text-navy">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                }
                title={r.title}
                subtitle={r.brief ? `${r.brief.slice(0, 200)}${r.brief.length > 200 ? "\u2026" : ""}` : "No brief given"}
                status={
                  <MuStatus
                    tone={statusTone[r.request_status] ?? "neutral"}
                    label={REQUEST_STATUS.find((s) => s.value === r.request_status)?.label ?? r.request_status}
                  />
                }
                fields={
                  <MuFieldGrid columns={3}>
                    <MuField label="Location" icon={MapPin} value={r.location || ""} />
                    <MuField
                      label="Start"
                      icon={CalendarDays}
                      value={r.start_asap ? "As soon as possible" : r.start_date ? new Date(r.start_date).toLocaleDateString("en-GB") : ""}
                    />
                    <MuField
                      label="Last matched"
                      icon={Users}
                      value={
                        r.last_matched_at
                          ? `${r.last_match_count ?? 0} candidates on ${new Date(r.last_matched_at).toLocaleDateString("en-GB")}`
                          : ""
                      }
                    />
                  </MuFieldGrid>
                }
              />
            </div>
          ))}
        </div>
      )}
    </MuPage>
  );
}
