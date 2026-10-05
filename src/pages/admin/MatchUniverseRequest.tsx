import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import {
  Loader2, Save, CheckCircle2, CircleAlert, Stethoscope, MapPin, HeartPulse, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminDb } from "@/lib/admin-utils";
import { LocationField } from "@/components/LocationSelect";

import { MuEmpty, MuPageHeader, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import MatchmakerMatches from "./MatchmakerMatches";
import { REQUEST_STATUS } from "./MatchUniverseRequests";

interface RequestRecord {
  id: string;
  title: string;
  brief: string | null;
  client_notes: string | null;
  location: string | null;
  request_status: string;
  start_date: string | null;
  start_asap: boolean;
  match_professions: string[] | null;
  match_states: string[] | null;
  match_lgas: string[] | null;
  match_care_types: string[] | null;
  match_shift_patterns: string[] | null;
  match_live_in: string | null;
  match_min_years: number | null;
  requirements_parsed_at: string | null;
}

export default function MatchUniverseRequest() {
  const { id } = useParams<{ id: string }>();
  const [rec, setRec] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matchesKey, setMatchesKey] = useState(0);
  const navigate = useNavigate();

  // Binning hides the request from every list; the row stays for history.
  const binRequest = async () => {
    if (!id) return;
    const { error } = await adminDb().from("matchmaker_opportunities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast({ title: "Could not remove the request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request removed" });
    navigate("/admin/match-universe/requests");
  };
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await adminDb()
      .from("matchmaker_opportunities")
      .select(
        "id, title, brief, client_notes, location, request_status, start_date, start_asap, match_professions, match_states, match_lgas, match_care_types, match_shift_patterns, match_live_in, match_min_years, requirements_parsed_at",
      )
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast({ title: "Could not load the request", description: error?.message, variant: "destructive" });
      return;
    }
    setRec(data as any);
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!rec || !id) return;
    setSaving(true);
    const { error } = await adminDb()
      .from("matchmaker_opportunities")
      .update({
        title: rec.title,
        brief: rec.brief,
        client_notes: rec.client_notes,
        location: rec.location,
        // The picked place is also the matching criterion, so it is stored on the
        // structured columns the shortlist filters on. Every other requirement
        // belongs to the requirements editor below, which saves its own columns.
        match_states: rec.match_states ?? [],
        match_lgas: rec.match_lgas ?? [],

        request_status: rec.request_status,
        start_date: rec.start_asap ? null : rec.start_date,
        start_asap: rec.start_asap,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Request saved" });
    // The requirements editor reloads, so it never saves a stale location.
    setMatchesKey((k) => k + 1);
  };

  // After the requirements editor saves, pull its columns into the checklist
  // without touching unsaved edits to the brief.
  const refreshRequirements = useCallback(async () => {
    if (!id) return;
    const { data } = await adminDb()
      .from("matchmaker_opportunities")
      .select("match_professions, match_states, match_lgas, match_care_types, match_shift_patterns, match_live_in, match_min_years, requirements_parsed_at")
      .eq("id", id)
      .maybeSingle();
    if (data) setRec((prev) => (prev ? { ...prev, ...(data as Partial<RequestRecord>) } : prev));
  }, [id]);

  // The checklist is the honest answer to "can this be matched yet". Each line
  // maps to a hard filter or a scoring input in mu_match_candidates, so a
  // missing line is a real reason the shortlist would come back thin.
  const checklist = useMemo(() => {
    if (!rec) return [];
    return [
      {
        label: "Profession",
        icon: Stethoscope,
        ok: (rec.match_professions?.length ?? 0) > 0,
        help: "Read from the brief. Without it every profession is in scope and the ranking is noise.",
      },
      {
        label: "Location",
        icon: MapPin,
        ok: (rec.match_states?.length ?? 0) > 0 || (rec.match_lgas?.length ?? 0) > 0,
        help: "A state or local government. Travel willingness is scored against it.",
      },
      {
        label: "Type of care",
        icon: HeartPulse,
        ok: (rec.match_care_types?.length ?? 0) > 0,
        help: "Geriatric, childcare, learning disability and so on. Matched against candidate work preferences.",
      },
      {
        label: "Start date",
        icon: CalendarDays,
        ok: rec.start_asap || !!rec.start_date,
        help: "Used to check who is actually free, not just who fits on paper.",
      },
    ];
  }, [rec]);

  const ready = checklist.every((c) => c.ok);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!rec)
    return (
      <div className="border border-line bg-card">
        <MuEmpty
          art={art.objMagnifier}
          title="Request not found"
          description="It may have been removed, or it could not be loaded."
          action={<Button variant="outline" asChild><Link to="/admin/match-universe/requests">Back to staffing requests</Link></Button>}
        />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <MuPageHeader
        backTo="/admin/match-universe/requests"
        backLabel="Staffing requests"
        title={rec.title}
        description="The client's brief and its shortlist."
        actions={
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save request
            </Button>
            <ConfirmAction
              title="Remove this request?"
              description={<p>"{rec.title}" leaves the requests list. Shortlists and history made from it are kept.</p>}
              confirmLabel="Remove request"
              destructive
              onConfirm={binRequest}
              trigger={<Button variant="outline">Remove</Button>}
            />
          </>
        }
      />

      <MuSection title="The client's brief">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Reference</label>
              <Input value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Location</label>
              <LocationField
                value={rec.location}
                onChange={(v, parts) =>
                  setRec({
                    ...rec,
                    location: v,
                    match_states: parts.state ? [parts.state] : [],
                    match_lgas: parts.lga ? [parts.lga] : [],
                  })
                }
              />
            </div>

          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Anything else the client said (optional)</label>
            <Textarea rows={10} value={rec.brief ?? ""} onChange={(e) => setRec({ ...rec, brief: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Internal notes</label>
            <Textarea
              rows={3}
              value={rec.client_notes ?? ""}
              onChange={(e) => setRec({ ...rec, client_notes: e.target.value })}
              placeholder="Budget, decision maker, anything the client would not want on a job advert."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Stage</label>
              <Select value={rec.request_status} onValueChange={(v) => setRec({ ...rec, request_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">Start date</label>
              <Input
                type="date"
                disabled={rec.start_asap}
                value={rec.start_date ?? ""}
                onChange={(e) => setRec({ ...rec, start_date: e.target.value || null })}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="asap"
                checked={rec.start_asap}
                onCheckedChange={(v) => setRec({ ...rec, start_asap: !!v })}
              />
              <label htmlFor="asap" className="text-sm">Start as soon as possible</label>
            </div>
          </div>
        </div>
      </MuSection>

      <MuSection
        title="Matching checklist"
        actions={<MuStatus tone={ready ? "good" : "warning"} label={ready ? "Complete" : "Shortlist will be rough"} />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {checklist.map((c) => (
            <div key={c.label} title={c.help} className="flex items-center justify-between gap-2.5 border border-line px-3 py-2.5">
              <span className="flex items-center gap-2.5 text-sm font-medium">
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-navy" />
                ) : (
                  <CircleAlert className="h-4 w-4 shrink-0 text-warn-ink" />
                )}
                {c.label}
              </span>
              <MuStatus tone={c.ok ? "good" : "warning"} label={c.ok ? "Set" : "Missing"} />
            </div>
          ))}
        </div>
      </MuSection>

      <MuSection
        title="Requirements and recommendations"
        description="Extract from the brief, correct, save, then run the match."
      >
        <MatchmakerMatches key={matchesKey} embedded onSaved={refreshRequirements} />
      </MuSection>
    </div>
  );
}
