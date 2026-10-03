import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Star, AlertTriangle, RefreshCw, MessageSquareText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { FACET_TYPE_LABELS, facetLabel } from "@/lib/match-taxonomy";

interface OppMatch {
  opportunity_id: string;
  title: string;
  location: string | null;
  score: number;
  breakdown: Record<string, any>;
  blockers: string[];
  matched_required: string[];
  matched_desirable: string[];
  missing_required: string[];
}

export default function PersonOpportunitiesTab({ personId }: { personId: string }) {
  const { toast } = useToast();
  const [matches, setMatches] = useState<OppMatch[]>([]);
  const [running, setRunning] = useState(false);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [rationaleBusy, setRationaleBusy] = useState<string | null>(null);

  const load = async () => {
    const { data: sl } = await adminDb().from("mu_shortlists").select("opportunity_id").eq("person_id", personId);
    setShortlisted(new Set((sl || []).map((r: any) => r.opportunity_id)));
  };

  const run = async (blocked = includeBlocked) => {
    setRunning(true);
    const { data, error } = await adminDb().rpc("mu_match_opportunities_for_person", {
      _person_id: personId,
      _limit: 50,
      _include_blocked: blocked,
    });
    setRunning(false);
    if (error) {
      toast({ title: "Could not find matches", description: error.message, variant: "destructive" });
      return;
    }
    setMatches((data || []) as OppMatch[]);
  };

  useEffect(() => {
    load();
    run(false);
  }, [personId]);

  const toggleShortlist = async (row: OppMatch) => {
    if (shortlisted.has(row.opportunity_id)) {
      await adminDb().from("mu_shortlists").delete().eq("opportunity_id", row.opportunity_id).eq("person_id", personId);
      setShortlisted((prev) => {
        const next = new Set(prev);
        next.delete(row.opportunity_id);
        return next;
      });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await adminDb().from("mu_shortlists").insert({
      opportunity_id: row.opportunity_id,
      person_id: personId,
      actor_id: userData?.user?.id ?? null,
      actor_name: userData?.user?.email ?? null,
      score: row.score,
      breakdown: row.breakdown,
    });
    if (error) {
      toast({ title: "Could not shortlist", description: error.message, variant: "destructive" });
      return;
    }
    setShortlisted((prev) => new Set(prev).add(row.opportunity_id));
    await adminDb().from("mu_activity").insert({
      person_id: personId,
      action: "shortlisted_to_opportunity",
      actor_id: userData?.user?.id ?? null,
      actor_name: userData?.user?.email ?? null,
      detail: { opportunity_id: row.opportunity_id, score: row.score },
    });
  };

  const explain = async (row: OppMatch, refresh = false) => {
    setRationaleBusy(row.opportunity_id);
    const { data, error } = await supabase.functions.invoke("match-rationale", {
      body: { opportunity_id: row.opportunity_id, person_id: personId, breakdown: row.breakdown, refresh },
    });
    setRationaleBusy(null);
    if (error || data?.error) {
      toast({ title: "Could not write the fit note", description: data?.error || error?.message || "Unknown error", variant: "destructive" });
      return;
    }
    setRationales((prev) => ({ ...prev, [row.opportunity_id]: data.rationale }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {matches.length === 0
            ? "Ranking runs against every open opportunity."
            : matches.length === 1
              ? "One opportunity is ranked by fit for this person."
              : `${matches.length} opportunities are ranked by fit for this person.`}
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="blocked-person" checked={includeBlocked} onCheckedChange={setIncludeBlocked} />
            <Label htmlFor="blocked-person" className="text-sm">Show blocked</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => run()} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Re-run
          </Button>
        </div>
      </div>

      {matches.length === 0 && !running && (
        <p className="text-sm text-muted-foreground">No open opportunities match this person yet.</p>
      )}

      <div className="space-y-3">
        {matches.map((m) => (
          <div key={m.opportunity_id} className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <Link to={`/admin/match-universe/opportunities/${m.opportunity_id}`} className="font-medium hover:underline">
                  {m.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[m.location, m.breakdown?.person_state, m.breakdown?.person_lga].filter(Boolean).join(" | ") || "No location set"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="tabular-nums">{Number(m.score).toFixed(0)}</Badge>
                <Button
                  variant={shortlisted.has(m.opportunity_id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleShortlist(m)}
                >
                  <Star className="mr-2 h-4 w-4" />
                  {shortlisted.has(m.opportunity_id) ? "Shortlisted" : "Shortlist"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => explain(m, Boolean(rationales[m.opportunity_id]))} disabled={rationaleBusy === m.opportunity_id}>
                  {rationaleBusy === m.opportunity_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                  Why
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {m.matched_required.map((c) => (
                <Badge key={`r-${c}`} className="text-xs">{facetLabel(c)}</Badge>
              ))}
              {m.matched_desirable.map((c) => (
                <Badge key={`d-${c}`} variant="secondary" className="text-xs">{facetLabel(c)}</Badge>
              ))}
              {m.missing_required.map((c) => (
                <Badge key={`m-${c}`} variant="outline" className="text-xs text-muted-foreground">
                  Missing: {facetLabel(c)}
                </Badge>
              ))}
            </div>

            {m.blockers.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{m.blockers.join(". ")}</span>
              </div>
            )}

            {rationales[m.opportunity_id] && (
              <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-line">{rationales[m.opportunity_id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
