// Referees, read as a table rather than a stack of cards.
//
// The panel collapses to one line so a record with nothing outstanding does not
// take up the screen. Each row opens to show the note, the full contact details
// and the actions, because the office works one referee at a time.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Copy, Loader2, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { MuStatus, MuTone } from "@/components/admin/mu/MuShell";

interface Referee {
  id: string;
  referee_name: string;
  relationship: string | null;
  job_title: string | null;
  organisation: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  offered: "Given, not taken up",
  taken_up: "Taken up",
  unreachable: "Could not reach them",
  declined: "Declined to comment",
};

const STATUS_TONE: Record<string, MuTone> = {
  offered: "neutral",
  taken_up: "good",
  unreachable: "bad",
  declined: "bad",
};

const day = (v?: string | null) => (v ? format(new Date(v), "d MMM yyyy") : "");

const ReferencesTable = ({ personId }: { personId: string }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await adminDb()
      .from("mu_references")
      .select("*")
      .eq("person_id", personId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as Referee[]);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    if (loading) return "Reading the referees on file.";
    if (rows.length === 0) return "No referees given yet.";
    const takenUp = rows.filter((r) => r.status === "taken_up").length;
    const count = rows.length === 1 ? "One referee given" : `${rows.length} referees given`;
    if (takenUp === 0) return `${count}, none taken up yet.`;
    if (takenUp === rows.length) return `${count}, all taken up.`;
    return `${count}, ${takenUp} taken up so far.`;
  }, [rows, loading]);

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await adminDb().from("mu_references").update({ status }).eq("id", id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not save that", description: error.message, variant: "destructive" });
      return;
    }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const remove = async (id: string) => {
    const { error } = await adminDb().from("mu_references").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not remove that referee", description: error.message, variant: "destructive" });
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const copy = (r: Referee) => {
    const line = [r.referee_name, r.job_title, r.organisation, r.email, r.phone]
      .filter(Boolean)
      .join(" · ");
    navigator.clipboard?.writeText(line);
    toast({ title: "Contact copied" });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border bg-card">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-[13.5px] font-medium">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            {summary}
          </span>
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            : open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {rows.length === 0 ? (
          <p className="border-t border-border px-4 py-4 text-[13px] text-muted-foreground">
            The candidate has not given us anybody yet. Two people who managed them is what we ask for.
          </p>
        ) : (
          <div className="border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[26%]">Referee</TableHead>
                  <TableHead className="hidden md:table-cell">How they know them</TableHead>
                  <TableHead className="hidden lg:table-cell">Where they work</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="hidden sm:table-cell">Given</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <TableCell className="font-medium">{r.referee_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {r.relationship || <span className="text-muted-foreground">Not said</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {[r.job_title, r.organisation].filter(Boolean).join(", ") || (
                          <span className="text-muted-foreground">Not said</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.email || r.phone || <span className="text-muted-foreground">None given</span>}
                      </TableCell>
                      <TableCell>
                        <MuStatus
                          tone={STATUS_TONE[r.status] ?? "neutral"}
                          label={STATUS_LABEL[r.status] ?? r.status}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {day(r.created_at)}
                      </TableCell>
                    </TableRow>

                    {expanded === r.id && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={6} className="space-y-3 py-4">
                          <div className="grid gap-1 text-[13px]">
                            {r.email && <p>Email: {r.email}</p>}
                            {r.phone && <p>Phone: {r.phone}</p>}
                            {r.note && <p className="italic text-muted-foreground">{r.note}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => copy(r)}>
                              <Copy className="mr-2 h-3.5 w-3.5" />Copy contact
                            </Button>
                            {r.status !== "taken_up" && (
                              <Button size="sm" disabled={busy === r.id} onClick={() => setStatus(r.id, "taken_up")}>
                                Mark as taken up
                              </Button>
                            )}
                            {r.status !== "unreachable" && (
                              <Button
                                size="sm" variant="outline" disabled={busy === r.id}
                                onClick={() => setStatus(r.id, "unreachable")}
                              >
                                Could not reach them
                              </Button>
                            )}
                            {r.status !== "declined" && (
                              <Button
                                size="sm" variant="outline" disabled={busy === r.id}
                                onClick={() => setStatus(r.id, "declined")}
                              >
                                Declined to comment
                              </Button>
                            )}
                            {r.status !== "offered" && (
                              <Button
                                size="sm" variant="ghost" disabled={busy === r.id}
                                onClick={() => setStatus(r.id, "offered")}
                              >
                                Put back to not taken up
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ReferencesTable;
