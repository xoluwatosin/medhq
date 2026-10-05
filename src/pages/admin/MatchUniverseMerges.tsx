import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, GitMerge, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuEmpty, MuPage, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { useAuth } from "@/contexts/AuthContext";
import { MergeCandidate, Person, initialsOf } from "@/lib/match-universe";
import { ConfirmAction } from "@/components/admin/ConfirmAction";

interface Pair {
  candidate: MergeCandidate;
  a: Person;
  b: Person;
}

const Side = ({ p, onKeep, keeping }: { p: Person; onKeep: () => void; keeping: boolean }) => (
  <div className={`border p-4 space-y-2 ${keeping ? "border-navy bg-tint/50" : "border-line"}`}>
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 bg-tint text-navy text-xs font-bold flex items-center justify-center">
        {initialsOf(p.full_name)}
      </span>
      <div className="min-w-0">
        <p className="font-medium truncate">{p.full_name || "Unnamed"}</p>
        <p className="text-xs text-muted-foreground truncate">
          Created {format(new Date(p.created_at), "d MMM yyyy")}
        </p>
      </div>
    </div>
    <dl className="text-sm space-y-1">
      {[
        ["Email", p.email],
        ["Phone", p.phone],
        ["Role", p.current_position],
        ["Experience", p.years_experience],
        ["State", p.state],
        ["Status", p.status],
      ].map(([k, v]) => (
        <div key={k as string} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate text-right">{v === null || v === undefined || v === "" ? "Not provided" : String(v)}</dd>
        </div>
      ))}
    </dl>
    <div className="flex gap-2 pt-1">
      <Button size="sm" variant={keeping ? "default" : "outline"} onClick={onKeep} className="flex-1">
        Keep this one
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <Link to={`/admin/match-universe/${p.id}`}>Open</Link>
      </Button>
    </div>
  </div>
);

const MatchUniverseMerges = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: cands } = await adminDb()
      .from("mu_merge_candidates")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const list = (cands || []) as MergeCandidate[];
    const ids = Array.from(new Set(list.flatMap((c) => [c.person_a, c.person_b])));
    if (ids.length === 0) {
      setPairs([]);
      setLoading(false);
      return;
    }
    const { data: people } = await adminDb().from("mu_people").select("*").in("id", ids);
    const map = new Map<string, Person>(((people || []) as Person[]).map((p) => [p.id, p]));
    setPairs(
      list
        .map((c) => ({ candidate: c, a: map.get(c.person_a)!, b: map.get(c.person_b)! }))
        .filter((p) => p.a && p.b),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);


  // One call, one transaction: the database moves every record that points
  // at the duplicate (documents, offers, contracts, availability, shortlists,
  // the lot), fills the survivor's blanks, deletes the duplicate and writes the
  // trail. Either all of it happens or none of it does.
  const merge = async (pair: Pair) => {
    const keepId = keep[pair.candidate.id] || pair.a.id;
    const dropId = keepId === pair.a.id ? pair.b.id : pair.a.id;
    const merged = keepId === pair.a.id ? pair.b : pair.a;
    setBusy(pair.candidate.id);
    const { data, error } = await adminDb().rpc("mu_merge_people", {
      _keep: keepId,
      _drop: dropId,
      _candidate: pair.candidate.id,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Nothing was merged", description: error.message, variant: "destructive" });
      return;
    }
    const moved = Number(data?.rows_moved ?? 0);
    toast({
      title: "Profiles merged",
      description: `${merged.full_name} is now part of the kept profile. ${moved} linked ${moved === 1 ? "record" : "records"} moved across.`,
    });
    load();
  };

  const reject = async (pair: Pair) => {
    setBusy(pair.candidate.id);
    const { error } = await adminDb()
      .from("mu_merge_candidates")
      .update({ status: "rejected", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq("id", pair.candidate.id);
    setBusy(null);
    if (error) {
      toast({ title: "Could not save that", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as different people" });
    load();
  };

  if (loading)
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <MuPage className="max-w-5xl">
      <MuPageHeader
        title="Duplicates"
        description="Possible matches that need your call."
        backTo="/admin/match-universe"
        backLabel="Talent pool"
      />

      {pairs.length === 0 && (
        <MuSection>
          <MuEmpty
            art={art.objHandshake}
            title="No duplicates to review"
            description="Possible duplicates appear here when two profiles look like the same person."
          />
        </MuSection>
      )}

      {pairs.map((pair) => {
        const keepId = keep[pair.candidate.id] || pair.a.id;
        const kept = keepId === pair.a.id ? pair.a : pair.b;
        const dropped = keepId === pair.a.id ? pair.b : pair.a;
        return (
          <MuSection key={pair.candidate.id}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MuStatus label={pair.candidate.reason} />
                <span className="text-xs text-muted-foreground">
                  Flagged {format(new Date(pair.candidate.created_at), "d MMM yyyy")}
                </span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Side p={pair.a} keeping={keepId === pair.a.id} onKeep={() => setKeep({ ...keep, [pair.candidate.id]: pair.a.id })} />
                <Side p={pair.b} keeping={keepId === pair.b.id} onKeep={() => setKeep({ ...keep, [pair.candidate.id]: pair.b.id })} />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => reject(pair)} disabled={busy === pair.candidate.id}>
                  <X className="mr-2 h-4 w-4" />Different people
                </Button>
                <ConfirmAction
                  title="Merge these two profiles?"
                  description={
                    <>
                      <p>
                        <strong>{dropped.full_name}</strong> will be merged into <strong>{kept.full_name}</strong>. Every document, offer, contract,
                        shortlist and note moves to the kept profile, and blank details on it are filled from the other.
                      </p>
                      <p>The merged profile is deleted. This cannot be undone.</p>
                    </>
                  }
                  confirmLabel="Merge profiles"
                  destructive
                  onConfirm={() => merge(pair)}
                  trigger={
                    <Button size="sm" disabled={busy === pair.candidate.id}>
                      {busy === pair.candidate.id
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <GitMerge className="mr-2 h-4 w-4" />}
                      Merge into selected profile
                    </Button>
                  }
                />
              </div>
            </div>
          </MuSection>
        );
      })}
    </MuPage>
  );
};

export default MatchUniverseMerges;
