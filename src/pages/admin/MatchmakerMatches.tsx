import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarCheck,
  Loader2,
  Sparkles,
  Star,
  RefreshCw,
  AlertTriangle,
  Plus,
  X,
  MessageSquareText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MuEmpty, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { PROFESSIONS } from "@/lib/professions";
import {
  FACET_TYPES,
  FACET_TYPE_LABELS,
  FACET_VOCABULARY,
  facetLabel,
  type FacetType,
  type MatchRow,
  type OpportunityFacet,
} from "@/lib/match-taxonomy";
import { EVIDENCE_TIERS, TIER_LABELS } from "@/lib/credentials";
import { StateMultiSelect, LgaMultiSelect } from "@/components/LocationSelect";
import { getLGAsForState } from "@/lib/nigeria-locations";
import { CARE_TYPES, CARE_TYPE_LABEL, SHIFT_PATTERNS } from "@/lib/work-preferences";
import { ShortlistControl, shortlistStageLabel } from "@/components/admin/mu/ShortlistControl";

interface Opportunity {
  id: string;
  title: string;
  location: string | null;
  match_professions: string[];
  match_min_years: number | null;
  match_states: string[];
  match_lgas: string[];
  match_requires_licence: boolean;
  match_requires_right_to_work: boolean;
  min_licence_evidence: string | null;
  min_right_to_work_evidence: string | null;
  match_care_types: string[];
  match_live_in: string;
  match_shift_patterns: string[];
  requirements_parsed_at: string | null;
  requirements_model: string | null;
}

const emptyOpp: Partial<Opportunity> = {
  match_professions: [],
  match_states: [],
  match_lgas: [],
  match_requires_licence: false,
  match_requires_right_to_work: false,
  min_licence_evidence: "none",
  min_right_to_work_evidence: "none",
  match_care_types: [],
  match_live_in: "any",
  match_shift_patterns: [],
};

// What the role asks of a person's own preferences. "Either suits us" means we
// do not filter on it at all.
const LIVE_IN_REQUIREMENT = [
  { value: "any", label: "Either suits us" },
  { value: "live_in", label: "Live-in only" },
  { value: "live_out", label: "Live-out only" },
];



// Times of day for the coverage strip, matching the availability board.
const COVERAGE_BLOCKS = [
  { value: "any", label: "Any time of day", blocks: null as string[] | null },
  { value: "morning", label: "Mornings", blocks: ["morning"] },
  { value: "afternoon", label: "Afternoons", blocks: ["afternoon"] },
  { value: "evening", label: "Evenings", blocks: ["evening"] },
  { value: "night", label: "Nights", blocks: ["night"] },
  { value: "day", label: "Daytime", blocks: ["morning", "afternoon"] },
];

const COVERAGE_LABEL: Record<string, string> = {
  available: "Free",
  unavailable: "Busy",
  unknown: "Not said",
};


export default function MatchmakerMatches({ embedded, onSaved }: { embedded?: boolean; onSaved?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [op, setOp] = useState<Opportunity | null>(null);
  const [facets, setFacets] = useState<OpportunityFacet[]>([]);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [running, setRunning] = useState(false);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [excluded, setExcluded] = useState<{ people: number; reasons: { reason: string; count: number }[] }>({ people: 0, reasons: [] });

  const [shortlisted, setShortlisted] = useState<Record<string, { id: string; status: string }>>({});
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [rationaleBusy, setRationaleBusy] = useState<string | null>(null);

  // Coverage: who among the ranked matches is actually free in a given window.
  // Three states stay honest, and silence never counts as a no.
  const [covFrom, setCovFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [covTo, setCovTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 13);
    return d.toISOString().slice(0, 10);
  });
  const [covBlock, setCovBlock] = useState("any");
  const [coverage, setCoverage] = useState<Record<string, "available" | "unavailable" | "unknown">>({});
  const [covLoading, setCovLoading] = useState(false);
  const [covOn, setCovOn] = useState(false);


  const [newType, setNewType] = useState<FacetType>("specialty");
  const [newCode, setNewCode] = useState("");
  const [newRequirement, setNewRequirement] = useState<"required" | "desirable">("required");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: opp }, { data: fs }, { data: sl }] = await Promise.all([
      adminDb().from("matchmaker_opportunities").select("*").eq("id", id).maybeSingle(),
      adminDb().from("matchmaker_opportunity_facets").select("*").eq("opportunity_id", id),
      adminDb().from("mu_shortlists").select("id, person_id, status").eq("opportunity_id", id),
    ]);
    if (opp) setOp({ ...(emptyOpp as Opportunity), ...opp });
    setFacets((fs || []) as OpportunityFacet[]);
    setShortlisted(
      Object.fromEntries(
        ((sl || []) as { id: string; person_id: string; status: string }[]).map((r) => [
          r.person_id,
          { id: r.id, status: r.status },
        ]),
      ),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runMatch = useCallback(
    async (blocked = includeBlocked) => {
      if (!id) return;
      setRunning(true);
      const [{ data, error }, { data: all }] = await Promise.all([
        adminDb().rpc("mu_match_candidates", {
          _opportunity_id: id,
          _limit: 50,
          _include_blocked: blocked,
        }),
        // Second pass with everything in, purely to say who was left out and why.
        adminDb().rpc("mu_match_candidates", {
          _opportunity_id: id,
          _limit: 500,
          _include_blocked: true,
        }),
      ]);
      setRunning(false);
      if (error) {
        toast({ title: "Could not run the match", description: error.message, variant: "destructive" });
        return;
      }
      setMatches((data || []) as MatchRow[]);
      // Record when this was last ranked, so the requests list can say so.
      void adminDb()
        .from("matchmaker_opportunities")
        .update({ last_matched_at: new Date().toISOString(), last_match_count: (data || []).length })
        .eq("id", id);

      const tally = new Map<string, number>();
      let people = 0;
      for (const row of (all || []) as MatchRow[]) {
        if (!row.blockers?.length) continue;
        people += 1;
        for (const b of row.blockers) {
          // Collapse the wordy ones so the strip stays readable.
          const key = b.replace(/ between .*$/, "").replace(/, below the required.*$/, " below the floor");
          tally.set(key, (tally.get(key) || 0) + 1);
        }
      }
      setExcluded({
        people,
        reasons: [...tally.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      });
    },
    [id, includeBlocked, toast],
  );


  useEffect(() => {
    if (!loading && op) runMatch(includeBlocked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, includeBlocked]);

  // Ask the candidate pool who is free in this window, then keep only the answers that
  // belong to people already on this ranked list.
  const runCoverage = useCallback(async () => {
    setCovLoading(true);
    const { data, error } = await adminDb().rpc("mu_available_people", {
      _from: covFrom,
      _to: covTo,
      _blocks: COVERAGE_BLOCKS.find((b) => b.value === covBlock)?.blocks ?? null,
      _profession: null,
      _state: null,
      _lga: null,
      _limit: 500,
    } as any);
    setCovLoading(false);
    if (error) {
      toast({ title: "Could not check availability", description: error.message, variant: "destructive" });
      return;
    }
    const map: Record<string, "available" | "unavailable" | "unknown"> = {};
    for (const r of ((data as any) || []) as { person_id: string; availability: any }[]) {
      map[r.person_id] = r.availability;
    }
    setCoverage(map);
    setCovOn(true);
  }, [covFrom, covTo, covBlock, toast]);

  const coverageTally = useMemo(() => {
    const t = { available: 0, unavailable: 0, unknown: 0 };
    for (const m of matches) {
      const s = coverage[m.person_id] || "unknown";
      t[s] += 1;
    }
    return t;
  }, [matches, coverage]);


  const extract = async () => {
    if (!id) return;
    setExtracting(true);
    const { data, error } = await supabase.functions.invoke("parse-opportunity", {
      body: { opportunity_id: id },
    });
    setExtracting(false);
    if (error || data?.error) {
      toast({
        title: "Extraction failed",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    const p = data.proposal;
    setOp((prev) =>
      prev
        ? {
            ...prev,
            match_professions: p.professions,
            match_min_years: p.min_years,
            match_states: p.states,
            match_lgas: p.lgas,
            match_requires_licence: p.requires_licence,
            match_requires_right_to_work: p.requires_right_to_work,
            // A brief can say a licence is needed; it can never say what evidence
            // we hold. Parsing therefore proposes the lowest tier, not "verified".
            min_licence_evidence: p.requires_licence ? "self_declared" : "none",
            min_right_to_work_evidence: p.requires_right_to_work ? "self_declared" : "none",
            requirements_model: data.model,

          }
        : prev,
    );
    setFacets(
      p.facets.map((f: OpportunityFacet) => ({
        facet_type: f.facet_type,
        code: f.code,
        requirement: f.requirement,
      })),
    );
    toast({
      title: "Requirements extracted",
      description: p.notes ? `${p.notes} Review and save before matching.` : "Review and edit, then save before matching.",
    });
  };

  const save = async () => {
    if (!id || !op) return;
    setSaving(true);
    const { error } = await adminDb()
      .from("matchmaker_opportunities")
      .update({
        match_professions: op.match_professions,
        match_min_years: op.match_min_years,
        match_states: op.match_states,
        match_lgas: op.match_lgas,
        match_requires_licence: op.match_requires_licence,
        match_requires_right_to_work: op.match_requires_right_to_work,
        min_licence_evidence: op.min_licence_evidence ?? "none",
        min_right_to_work_evidence: op.min_right_to_work_evidence ?? "none",
        match_care_types: op.match_care_types ?? [],
        match_live_in: op.match_live_in ?? "any",
        match_shift_patterns: op.match_shift_patterns ?? [],
        requirements_parsed_at: new Date().toISOString(),
        requirements_model: op.requirements_model,

      })
      .eq("id", id);

    if (!error) {
      await adminDb().from("matchmaker_opportunity_facets").delete().eq("opportunity_id", id);
      if (facets.length) {
        await adminDb()
          .from("matchmaker_opportunity_facets")
          .insert(facets.map((f) => ({ opportunity_id: id, facet_type: f.facet_type, code: f.code, requirement: f.requirement })));
      }
    }
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Requirements saved" });
    onSaved?.();
    runMatch();
  };

  const addFacet = () => {
    if (!newCode) return;
    if (facets.some((f) => f.facet_type === newType && f.code === newCode)) return;
    setFacets([...facets, { facet_type: newType, code: newCode, requirement: newRequirement }]);
    setNewCode("");
  };

  const toggleShortlist = async (row: MatchRow) => {
    if (!id) return;
    if (shortlisted[row.person_id]) {
      await adminDb().from("mu_shortlists").delete().eq("opportunity_id", id).eq("person_id", row.person_id);
      setShortlisted((prev) => {
        const next = { ...prev };
        delete next[row.person_id];
        return next;
      });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { data: inserted, error } = await adminDb()
      .from("mu_shortlists")
      .insert({
        opportunity_id: id,
        person_id: row.person_id,
        actor_id: userData?.user?.id ?? null,
        actor_name: userData?.user?.email ?? null,
        score: row.score,
        breakdown: row.breakdown,
      })
      .select("id, status")
      .maybeSingle();
    if (error) {
      toast({ title: "Could not shortlist", description: error.message, variant: "destructive" });
      return;
    }
    setShortlisted((prev) => ({
      ...prev,
      [row.person_id]: { id: (inserted as { id: string })?.id, status: (inserted as { status: string })?.status || "shortlisted" },
    }));
    await adminDb().from("mu_activity").insert({
      person_id: row.person_id,
      action: "shortlisted",
      actor_id: userData?.user?.id ?? null,
      actor_name: userData?.user?.email ?? null,
      detail: { opportunity_id: id, score: row.score },
    });
  };

  // Where a shortlisted person actually is with the client. The stage is the
  // whole point of a shortlist: without it, putting someone forward and
  // placing them look identical.
  const setStage = async (personId: string, status: string) => {
    const entry = shortlisted[personId];
    if (!entry) return;
    const { error } = await (adminDb() as any).rpc("mu_shortlist_set_stage", {
      _id: entry.id,
      _status: status,
      _note: null,
    });
    if (error) {
      toast({ title: "Could not move the stage", description: error.message, variant: "destructive" });
      return;
    }
    setShortlisted((prev) => ({ ...prev, [personId]: { ...entry, status } }));
    toast({ title: `Moved to ${shortlistStageLabel(status)}` });
  };

  const explain = async (row: MatchRow, refresh = false) => {
    if (!id) return;
    setRationaleBusy(row.person_id);
    const { data, error } = await supabase.functions.invoke("match-rationale", {
      body: { opportunity_id: id, person_id: row.person_id, breakdown: row.breakdown, refresh },
    });
    setRationaleBusy(null);
    if (error || data?.error) {
      toast({
        title: "Could not write the fit note",
        description: data?.error || error?.message || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setRationales((prev) => ({ ...prev, [row.person_id]: data.rationale }));
  };

  const required = useMemo(() => facets.filter((f) => f.requirement === "required"), [facets]);
  const desirable = useMemo(() => facets.filter((f) => f.requirement === "desirable"), [facets]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!op)
    return (
      <div className="border border-line bg-card">
        <MuEmpty art={art.objMagnifier} title="Opportunity not found" description="It may have been deleted, or it could not be loaded." />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {(() => {
        const headerActions = (
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save requirements
            </Button>
            <Button variant="outline" onClick={extract} disabled={extracting}>
              {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Extract requirements
            </Button>
          </>
        );
        const intro = "Requirements are matched against the candidate pool. Matching uses the selected criteria.";
        // Embedded under the opportunity's own header, so the title is not repeated.
        return embedded ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">{intro}</p>
            <div className="flex flex-wrap gap-2">{headerActions}</div>
          </div>
        ) : (
          <MuPageHeader
            title={op.title}
            description={intro}
            backTo={`/admin/match-universe/opportunities/${op.id}`}
            backLabel="Back to opportunity"
            actions={headerActions}
          />
        );
      })()}


      {/* Requirements */}
      <MuSection title="Hard requirements">
        <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Professions accepted</Label>
            <div className="flex flex-wrap gap-1.5">
              {op.match_professions.map((p) => (
                <MuStatus
                  key={p}
                  tone="info"
                  label={
                    <>
                      {p}
                      <button
                        onClick={() => setOp({ ...op, match_professions: op.match_professions.filter((x) => x !== p) })}
                        aria-label={`Remove ${p}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
            <Select
              value=""
              onValueChange={(v) => !op.match_professions.includes(v) && setOp({ ...op, match_professions: [...op.match_professions, v] })}
            >
              <SelectTrigger><SelectValue placeholder="Add a profession" /></SelectTrigger>
              <SelectContent>
                {PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minyears">Minimum years of experience</Label>
            <Input
              id="minyears"
              type="number"
              min={0}
              value={op.match_min_years ?? ""}
              onChange={(e) => setOp({ ...op, match_min_years: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="No minimum"
            />
          </div>

          <div className="space-y-2">
            <Label>States</Label>
            <StateMultiSelect
              values={op.match_states}
              onChange={(states) =>
                setOp({
                  ...op,
                  match_states: states,
                  // Drop any LGA that no longer belongs to a chosen state, so
                  // the criteria can never describe a place that does not exist.
                  match_lgas: states.length
                    ? op.match_lgas.filter((l) => states.some((s) => getLGAsForState(s).includes(l)))
                    : op.match_lgas,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Local governments</Label>
            <LgaMultiSelect
              states={op.match_states}
              values={op.match_lgas}
              onChange={(match_lgas) => setOp({ ...op, match_lgas })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="licence">Licence evidence needed</Label>
            <Select
              value={op.min_licence_evidence ?? "none"}
              onValueChange={(v) =>
                setOp({ ...op, min_licence_evidence: v, match_requires_licence: v !== "none" })
              }
            >
              <SelectTrigger id="licence"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVIDENCE_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rtw">Right to work evidence needed</Label>
            <Select
              value={op.min_right_to_work_evidence ?? "none"}
              onValueChange={(v) =>
                setOp({ ...op, min_right_to_work_evidence: v, match_requires_right_to_work: v !== "none" })
              }
            >
              <SelectTrigger id="rtw"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVIDENCE_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A tier, not a tick. "Self declared or better" keeps everyone who said yes on a form. "Document on file"
          drops anyone with nothing uploaded. "Verified only" keeps those an admin has passed. Candidates below the
          tier are excluded and told why; unknown is never silently treated as a pass.
        </p>

        {/* What the role asks of a person's own stated preferences. */}
        <div className="space-y-4 pt-2 border-t border-border/60">
          <div>
            <h3 className="text-sm font-medium">The work itself</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Matched against what each person said they want. Someone who has said nothing still ranks, just lower.
              Someone who has said they do not take this work, or will not live in, is set aside with the reason shown.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Kind of care</Label>
            <div className="flex flex-wrap gap-1.5">
              {CARE_TYPES.map((c) => {
                const on = (op.match_care_types ?? []).includes(c.code);
                return (
                  <Button
                    key={c.code}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    className="h-8"
                    onClick={() =>
                      setOp({
                        ...op,
                        match_care_types: on
                          ? (op.match_care_types ?? []).filter((x) => x !== c.code)
                          : [...(op.match_care_types ?? []), c.code],
                      })
                    }
                  >
                    {c.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="livein">Living arrangement</Label>
              <Select
                value={op.match_live_in ?? "any"}
                onValueChange={(v) => setOp({ ...op, match_live_in: v })}
              >
                <SelectTrigger id="livein"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIVE_IN_REQUIREMENT.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shifts needed</Label>
              <div className="flex flex-wrap gap-1.5">
                {SHIFT_PATTERNS.map((s) => {
                  const on = (op.match_shift_patterns ?? []).includes(s.code);
                  return (
                    <Button
                      key={s.code}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      className="h-8"
                      onClick={() =>
                        setOp({
                          ...op,
                          match_shift_patterns: on
                            ? (op.match_shift_patterns ?? []).filter((x) => x !== s.code)
                            : [...(op.match_shift_patterns ?? []), s.code],
                        })
                      }
                    >
                      {s.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>


        </div>
      </MuSection>

      {/* Facets */}
      <MuSection
        title="Skills and experience"
        description="Required facets are weighted heavily. Desirable facets separate close candidates."
      >
        <div className="space-y-5">

        {(["required", "desirable"] as const).map((band) => (
          <div key={band} className="space-y-2">
            <Label className="capitalize">{band}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(band === "required" ? required : desirable).map((f) => (
                <MuStatus
                  key={`${f.facet_type}:${f.code}`}
                  tone={band === "required" ? "good" : "info"}
                  label={
                    <>
                      {facetLabel(f.code)}
                      <span className="opacity-60 text-[10px] uppercase">{f.facet_type}</span>
                      <button
                        onClick={() => setFacets(facets.filter((x) => !(x.facet_type === f.facet_type && x.code === f.code)))}
                        aria-label={`Remove ${f.code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  }
                />
              ))}
              {(band === "required" ? required : desirable).length === 0 && (
                <span className="text-sm text-muted-foreground">None set.</span>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-line-soft">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newType} onValueChange={(v) => { setNewType(v as FacetType); setNewCode(""); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FACET_TYPES.map((t) => <SelectItem key={t} value={t}>{FACET_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Facet</Label>
            <Select value={newCode} onValueChange={setNewCode}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>
                {FACET_VOCABULARY[newType].map((c) => <SelectItem key={c} value={c}>{facetLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Weighting</Label>
            <Select value={newRequirement} onValueChange={(v) => setNewRequirement(v as "required" | "desirable")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="required">Required</SelectItem>
                <SelectItem value="desirable">Desirable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={addFacet} disabled={!newCode}>
            <Plus className="mr-2 h-4 w-4" />Add
          </Button>
        </div>
        </div>
      </MuSection>

      {/* Matches */}
      <MuSection
        title="Ranked matches"
        description={`${matches.length} candidate${matches.length === 1 ? "" : "s"} from the candidate pool.`}
        actions={
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch id="blocked" checked={includeBlocked} onCheckedChange={setIncludeBlocked} />
              <Label htmlFor="blocked" className="text-sm">Show blocked</Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => runMatch()} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Run again
            </Button>
          </div>
        }
      >
        <div className="space-y-4">

        {/* Who did not make the list, and on what */}
        {excluded.people > 0 && (
          <div className="border border-line bg-muted/20 p-4">
            <p className="text-sm">
              <span className="font-medium">{excluded.people} excluded</span>
              <span className="text-muted-foreground"> from the ranked list.</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {excluded.reasons.map((r) => (
                <MuStatus key={r.reason} label={<><span className="tabular-nums">{r.count}</span><span className="font-medium">{r.reason}</span></>} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Location never excludes anyone. People outside the area still rank, marked as such.
            </p>
          </div>
        )}


        {/* Coverage: who on this list is actually free in a window */}
        <div className="border border-line bg-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="cov-from" className="text-xs">From</Label>
              <Input id="cov-from" type="date" value={covFrom} onChange={(e) => setCovFrom(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cov-to" className="text-xs">To</Label>
              <Input id="cov-to" type="date" value={covTo} onChange={(e) => setCovTo(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time of day</Label>
              <Select value={covBlock} onValueChange={setCovBlock}>
                <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COVERAGE_BLOCKS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={runCoverage} disabled={covLoading}>
              {covLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
              Check coverage
            </Button>
          </div>
          {covOn && (
            <p className="text-sm text-muted-foreground">
              Of the {matches.length} candidates ranked,{" "}
              <span className="font-medium text-foreground">{coverageTally.available} are free</span>,{" "}
              {coverageTally.unavailable} are busy and {coverageTally.unknown} have not told us yet. Silence is not a no,
              so those sort below.

            </p>
          )}
        </div>


        {matches.length === 0 && !running && (
          <MuEmpty
            art={art.objMagnifier}
            title="No candidates match yet"
            description="Loosen the hard requirements, or check that profiles have been parsed into facets."
          />
        )}

        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.person_id} className="border border-line p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Link to={`/admin/match-universe/${m.person_id}`} className="font-medium hover:underline">
                    {m.full_name || "Unnamed"}
                  </Link>
                  {(() => {
                    const parts = [m.profession, m.years_experience != null ? `${m.years_experience} yrs` : null, [m.lga, m.state].filter(Boolean).join(", ")].filter(Boolean);
                    return (
                      <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                        {parts.length ? parts.map((part, i) => <span key={i}>{part}</span>) : "No profile detail yet"}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {covOn && (
                    <MuStatus
                      tone={
                        (coverage[m.person_id] || "unknown") === "available"
                          ? "good"
                          : (coverage[m.person_id] || "unknown") === "unavailable"
                            ? "warning"
                            : "neutral"
                      }
                      label={COVERAGE_LABEL[coverage[m.person_id] || "unknown"]}
                    />
                  )}
                  <MuStatus className="tabular-nums" label={Number(m.score).toFixed(0)} />

                  {(
                    <ShortlistControl
                      stage={shortlisted[m.person_id]?.status ?? null}
                      onAdd={() => void toggleShortlist(m)}
                      onRemove={() => void toggleShortlist(m)}
                      onStage={(v) => void setStage(m.person_id, v)}
                    />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => explain(m, Boolean(rationales[m.person_id]))} disabled={rationaleBusy === m.person_id}>
                    {rationaleBusy === m.person_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
                    Why
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {m.matched_required.map((c) => (
                  <MuStatus key={`r-${c}`} tone="good" label={facetLabel(c)} />
                ))}
                {m.matched_desirable.map((c) => (
                  <MuStatus key={`d-${c}`} tone="info" label={facetLabel(c)} />
                ))}
                {m.missing_required.map((c) => (
                  <MuStatus key={`m-${c}`} tone="neutral" label={`Missing: ${facetLabel(c)}`} />
                ))}
              </div>

              {/* What they said they want, against what this role is. */}
              {(() => {
                const wp = (m.breakdown as any)?.work_preferences;
                if (!wp) return null;
                const bits: string[] = [];
                if (wp.care_fit === "wanted") {
                  const wanted = (wp.care_types ?? []).filter((c: string) => (op?.match_care_types ?? []).includes(c));
                  bits.push(`Wants ${wanted.map((c: string) => CARE_TYPE_LABEL[c] ?? c).join(", ").toLowerCase()}`);
                } else if (wp.care_fit === "unknown") bits.push("They have not told us what care they want");
                if (wp.live_in_fit === "wanted") bits.push(wp.live_in === "either" ? "Live-in or live-out" : `Wants ${wp.live_in.replace("_", "-")}`);
                else if (wp.live_in_fit === "unknown") bits.push("They have not told us their living arrangement");
                if (wp.shift_fit === "wanted") bits.push("Shifts suit them");
                else if (wp.shift_fit === "unknown") bits.push("They have not told us which shifts suit them");

                if (bits.length === 0) return null;
                return (
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {bits.map((b, i) => <span key={i}>{b}</span>)}
                  </p>
                );
              })()}

              {/* Location is a flag, not a gate. */}
              {(() => {
                const loc = (m.breakdown as any)?.location;
                if (!loc) return null;
                if (loc.outside_area) {
                  return (
                    <p className="text-xs text-amber-700">
                      Outside the area asked for{m.state ? `, listed as ${m.state}${m.lga ? `, ${m.lga}` : ""}` : ""}. Still ranked on everything else.
                    </p>
                  );
                }
                if (loc.unknown) return <p className="text-xs text-muted-foreground">No location on file.</p>;
                return null;
              })()}


              {m.blockers.length > 0 && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{m.blockers.join(". ")}</span>
                </div>
              )}

              {rationales[m.person_id] && (
                <p className="text-sm bg-muted/50 p-3 whitespace-pre-line">{rationales[m.person_id]}</p>
              )}
            </div>
          ))}
        </div>
        </div>
      </MuSection>
    </div>
  );
}
