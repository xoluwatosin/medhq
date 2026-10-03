import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Loader2, ArrowLeft, GitMerge, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { useAuth } from "@/contexts/AuthContext";
import { MergeCandidate, Person, initialsOf, logActivity } from "@/lib/match-universe";

interface Pair {
  candidate: MergeCandidate;
  a: Person;
  b: Person;
}

const Side = ({ p, onKeep, keeping }: { p: Person; onKeep: () => void; keeping: boolean }) => (
  <div className={`rounded-lg border p-4 space-y-2 ${keeping ? "border-primary bg-primary/5" : "border-border"}`}>
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
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
          <dd className="truncate text-right">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
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

  const actor = { id: user?.id ?? null, name: (user as any)?.email ?? null };

  const merge = async (pair: Pair) => {
    const keepId = keep[pair.candidate.id] || pair.a.id;
    const dropId = keepId === pair.a.id ? pair.b.id : pair.a.id;
    const survivor = keepId === pair.a.id ? pair.a : pair.b;
    const merged = keepId === pair.a.id ? pair.b : pair.a;
    setBusy(pair.candidate.id);

    // move every linked record onto the surviving profile
    await Promise.all([
      adminDb().from("matchmaker_applications").update({ person_id: keepId }).eq("person_id", dropId),
      adminDb().from("join_applications").update({ person_id: keepId }).eq("person_id", dropId),
      adminDb().from("mu_documents").update({ person_id: keepId }).eq("person_id", dropId),
      adminDb().from("mu_activity").update({ person_id: keepId }).eq("person_id", dropId),
    ]);

    // fill any gaps on the survivor from the record being merged away
    const patch: Record<string, any> = {};
    (["email", "phone", "current_position", "years_experience", "state", "lga",
      "licensing_body", "license_number", "license_expiry", "admin_notes"] as const).forEach((k) => {
      if (!(survivor as any)[k] && (merged as any)[k]) patch[k] = (merged as any)[k];
    });
    if (Object.keys(patch).length) await adminDb().from("mu_people").update(patch).eq("id", keepId);

    await adminDb().from("mu_people").delete().eq("id", dropId);
    await adminDb()
      .from("mu_merge_candidates")
      .update({ status: "merged", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq("id", pair.candidate.id);
    await logActivity(keepId, "profiles_merged", { merged_name: merged.full_name, merged_email: merged.email }, actor);

    setBusy(null);
    toast({ title: "Profiles merged" });
    load();
  };

  const reject = async (pair: Pair) => {
    setBusy(pair.candidate.id);
    await adminDb()
      .from("mu_merge_candidates")
      .update({ status: "rejected", resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq("id", pair.candidate.id);
    setBusy(null);
    toast({ title: "Marked as different people" });
    load();
  };

  if (loading)
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/admin/match-universe"><ArrowLeft className="mr-2 h-4 w-4" />Match Universe</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-serif font-bold">Duplicates</h1>
        <p className="text-sm text-muted-foreground">
          Exact email and phone matches merge on their own. These are the weaker matches that need your call.
        </p>
      </div>

      {pairs.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No duplicates to review.
          </CardContent>
        </Card>
      )}

      {pairs.map((pair) => {
        const keepId = keep[pair.candidate.id] || pair.a.id;
        return (
          <Card key={pair.candidate.id}>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">{pair.candidate.reason}</Badge>
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
                <Button size="sm" onClick={() => merge(pair)} disabled={busy === pair.candidate.id}>
                  {busy === pair.candidate.id
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <GitMerge className="mr-2 h-4 w-4" />}
                  Merge into selected profile
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default MatchUniverseMerges;
