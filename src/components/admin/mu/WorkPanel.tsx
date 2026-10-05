// One person's working life: offers out, what they said, the engagement they
// are on, and their leave. Admin can offer a run of shifts or an ongoing role
// from here, and everything leaves a trail on the activity stream.
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminDb } from "@/lib/admin-utils";
import { supabase } from "@/integrations/supabase/client";
import { humaniseTerm } from "@/lib/readable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MuEmpty, MuSection, MuStatus } from "@/components/admin/mu/MuShell";
import { art } from "@/components/mc/art";
import { LocationField } from "@/components/LocationSelect";
import {
  Banknote, BriefcaseBusiness, CalendarDays, Clock, FileSignature, Loader2, Mail, MapPin, Plus,
  RotateCcw, Send,
  StickyNote, Trash2, UserCheck, X,
} from "lucide-react";
import {
  type Engagement, type LeaveRequest, type Offer, type OfferShift, type OfferTerms,
  LEAVE_STATUS_LABEL, OFFER_STATUS_ADMIN_LABEL, SHIFT_PRESETS, dateLabel, payLine, shiftLabel,
} from "@/lib/offers";
import {
  ENGAGEMENT_TYPES, WORK_TYPES, isEngagementOffer, isLiveEngagement, isWorkOffer,
  offerType, offerTypeSpec, paperLine, type OfferLayerType,
} from "@/lib/engagements";
import OfferTermsView from "@/components/offers/OfferTermsView";
import { loadPreferences } from "@/lib/work-preferences";
import AvailabilityDetail from "@/components/admin/mu/AvailabilityDetail";



export type WorkSection = "offers" | "engagements" | "leave";

interface Props {
  personId: string;
  personName: string;
  onChanged?: () => void;
  /** Which parts of the working life to show. Defaults to all three. */
  include?: WorkSection[];
}

const WorkPanel = ({ personId, personName, onChanged, include }: Props) => {
  const shows = (s: WorkSection) => !include || include.includes(s);

  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [leave, setLeave] = useState<LeaveRequest[]>([]);
  const [opportunities, setOpportunities] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Compose
  const [open, setOpen] = useState(false);
  const [etype, setEtype] = useState<OfferLayerType>("placement");
  const [parentId, setParentId] = useState<string>("");
  const [showBin, setShowBin] = useState(false);

  const [title, setTitle] = useState("");
  const [oppId, setOppId] = useState<string>("none");
  const [location, setLocation] = useState("");
  const [rate, setRate] = useState("");
  const [terms, setTerms] = useState<OfferTerms>({ pay_currency: "NGN" });
  const setTerm = (k: keyof OfferTerms, v: string) => setTerms((p) => ({ ...p, [k]: v }));
  const [message, setMessage] = useState("");
  const [pattern, setPattern] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expires, setExpires] = useState("");
  const [shifts, setShifts] = useState<OfferShift[]>([]);
  const [shiftDate, setShiftDate] = useState("");
  const [preset, setPreset] = useState(SHIFT_PRESETS[0].label);
  const [sending, setSending] = useState(false);
  const [prefillHints, setPrefillHints] = useState<string[]>([]);

  // The type decides everything else: whether this establishes a relationship
  // or hands out work under one, and therefore what the form even asks for.
  const spec = offerTypeSpec(etype);
  const kind: "shift" | "role" = spec.usesShifts ? "shift" : "role";




  const load = useCallback(async () => {
    const [{ data: o }, { data: e }, { data: l }, { data: opp }] = await Promise.all([
      adminDb().from("mu_offers").select("*").eq("person_id", personId).order("created_at", { ascending: false }),
      adminDb().from("mu_engagements").select("*").eq("person_id", personId).order("start_date", { ascending: false }),
      adminDb().from("mu_leave_requests").select("*").eq("person_id", personId).order("from_date", { ascending: false }),
      adminDb().from("matchmaker_opportunities").select("id, title").eq("status", "open").order("created_at", { ascending: false }),
    ]);
    const rows = ((o as any) || []) as Offer[];
    const ids = rows.map((r) => r.id);
    let byOffer: Record<string, OfferShift[]> = {};
    if (ids.length) {
      const { data: s } = await adminDb()
        .from("mu_offer_shifts")
        .select("offer_id, slot_date, start_hour, end_hour, location")
        .in("offer_id", ids)
        .order("slot_date");
      for (const row of ((s as any) || []) as (OfferShift & { offer_id: string })[]) {
        byOffer[row.offer_id] = [...(byOffer[row.offer_id] || []), row];
      }
    }
    setOffers(rows.map((r) => ({ ...r, shifts: byOffer[r.id] || [] })));
    setEngagements(((e as any) || []) as Engagement[]);
    setLeave(((l as any) || []) as LeaveRequest[]);
    setOpportunities(((opp as any) || []) as { id: string; title: string }[]);
    setLoading(false);
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  // Opening the composer from inside the candidate's own profile: everything we
  // already hold about them is carried in, so nobody retypes what the record says.
  const openComposer = async () => {
    setOpen(true);
    setPrefillHints([]);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: p }, prefs, { data: days }] = await Promise.all([
        adminDb().from("mu_people").select("*").eq("id", personId).maybeSingle(),
        loadPreferences(personId),
        adminDb()
          .from("mu_availability_days" as any)
          .select("slot_date")
          .eq("person_id", personId)
          .gte("slot_date", today)
          .order("slot_date")
          .limit(3),
      ]);
      const person: any = p || {};
      const hints: string[] = [];

      const profession = person.profession || person.current_position || "";
      if (profession && !title.trim()) {
        setTitle(profession);
        hints.push(`Role taken from their profile: ${profession}`);
      }
      if (person.licence_number || person.license_number) {
        hints.push(`Licence on file: ${person.licence_number || person.license_number}`);
      }

      const where =
        (prefs.travel_lgas?.[0] && prefs.travel_states?.[0]
          ? `${prefs.travel_lgas[0]}, ${prefs.travel_states[0]}`
          : prefs.travel_states?.[0]) ||
        [person.lga, person.state].filter(Boolean).join(", ");
      if (where && !location.trim()) {
        setLocation(where);
        hints.push(`Where they work: ${where}`);
      }

      const patternBits = [
        prefs.live_in === "live_in" ? "Live-in" : prefs.live_in === "live_out" ? "Live-out" : "",
        ...(prefs.shift_patterns || []),
      ].filter(Boolean);
      if (patternBits.length && !pattern.trim()) {
        setPattern(patternBits.join(", "));
        hints.push(`Pattern they asked for: ${patternBits.join(", ")}`);
      }

      const firstFree = (days as any)?.[0]?.slot_date as string | undefined;
      if (firstFree && !startDate) {
        setStartDate(firstFree);
        hints.push(`First day they are free: ${firstFree}`);
      }

      // The terms start from what they themselves asked for, so we are
      // answering their expectations rather than guessing at them.
      const basis =
        prefs.live_in === "live_in"
          ? "Live-in"
          : prefs.engagement_types?.[0]
            ? humaniseTerm(prefs.engagement_types[0])
            : "";
      setTerms((p) => ({
        ...p,
        pay_currency: p.pay_currency || "NGN",
        basis: p.basis || basis,
        notice_period: p.notice_period || prefs.notice_period || "",
      }));
      if (basis) hints.push(`Basis they asked for: ${basis}`);
      if (prefs.notice_period) hints.push(`Notice period they gave: ${prefs.notice_period}`);
      if (!hints.length) hints.push("Their record holds nothing to carry in yet, so fill this in by hand.");
      setPrefillHints(hints);
    } catch {
      setPrefillHints(["Could not read their record just now, so fill this in by hand."]);
    }
  };



  const addShift = () => {
    if (!shiftDate) {
      toast({ title: "Pick a date first", variant: "destructive" });
      return;
    }
    const p = SHIFT_PRESETS.find((x) => x.label === preset)!;
    setShifts((prev) =>
      prev.some((s) => s.slot_date === shiftDate && s.start_hour === p.start)
        ? prev
        : [...prev, { slot_date: shiftDate, start_hour: p.start, end_hour: p.end }].sort((a, b) =>
            a.slot_date.localeCompare(b.slot_date),
          ),
    );
    setShiftDate("");
  };

  // Email the candidate that an offer is waiting. Sending the offer already
  // puts it in their portal, so a failed email never undoes the offer.
  const notify = async (offerId: string, quiet = false) => {
    if (!quiet) setBusy(offerId);
    const { data, error } = await supabase.functions.invoke("notify-candidate-offer", {
      body: { offer_id: offerId },
    });
    if (!quiet) setBusy(null);
    if (error || (data as any)?.error) {
      toast({
        title: "Offer saved, but the email did not go",
        description: (data as any)?.error || error?.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Email sent", description: `${personName} has been told.` });
  };

  // Offers that establish a relationship must answer the questions a person
  // will ask before they can sign. Work under a live engagement asks less,
  // because the engagement already settled the basis.
  const liveEngagements = useMemo(() => offers.filter(isLiveEngagement), [offers]);

  const missingTerms = [
    !title.trim() ? "a title" : "",
    !(terms.pay_amount || "").trim() && !rate.trim() ? "what it pays" : "",
    spec.layer === "engagement" && !(terms.basis || "").trim() ? "the basis of the work" : "",
    spec.layer === "work" && !parentId ? "the engagement it sits under" : "",
    kind === "shift" && shifts.length === 0 ? "at least one shift" : "",
    kind === "role" && !startDate ? "a start date" : "",
  ].filter(Boolean);


  const send = async () => {
    if (missingTerms.length) {
      toast({
        title: "The offer is not complete yet",
        description: `Still to write: ${missingTerms.join(", ")}.`,
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    const cleanTerms = Object.fromEntries(
      Object.entries(terms).filter(([, v]) => String(v ?? "").trim() !== ""),
    );
    const { data, error } = await adminDb().rpc("mu_send_offer", {
      _payload: {
        person_id: personId,
        opportunity_id: oppId === "none" ? null : oppId,
        kind,
        engagement_type: etype,
        parent_offer_id: spec.layer === "work" ? parentId : null,

        title: title.trim(),
        location: location.trim(),
        rate_note: payLine(terms as any, rate.trim()) || rate.trim(),
        message: message.trim(),
        pattern: pattern.trim(),
        start_date: startDate || null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
        terms: cleanTerms,
      },
      _shifts: kind === "shift" ? shifts : [],
    } as any);
    setSending(false);
    const res = data as any;
    if (error || res?.ok === false) {
      toast({ title: "Could not send", description: res?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Offer sent", description: `${personName} can see it in their portal now.` });
    if (res?.offer_id) notify(res.offer_id, true);

    setOpen(false);
    setTitle(""); setLocation(""); setRate(""); setMessage(""); setPattern("");
    setStartDate(""); setExpires(""); setShifts([]); setOppId("none"); setParentId("");
    setTerms({ pay_currency: "NGN" });

    load();
    onChanged?.();
  };


  const withdraw = async (id: string) => {
    setBusy(id);
    const { data, error } = await adminDb().rpc("mu_withdraw_offer", { _offer_id: id, _reason: null } as any);
    setBusy(null);
    const res = data as any;
    if (error || res?.ok === false) {
      toast({ title: "Could not withdraw", description: res?.error || error?.message, variant: "destructive" });
      return;
    }
    load();
  };

  // Abandoned drafts and dead offers go to the bin rather than being destroyed:
  // what was once proposed is still part of the story of this hire.
  const setBinned = async (id: string, binned: boolean) => {
    setBusy(id);
    const { data, error } = await adminDb().rpc("mu_bin_offer", { _offer_id: id, _bin: binned } as any);
    setBusy(null);
    const res = data as any;
    if (error || res?.ok === false) {
      toast({
        title: binned ? "It cannot go to the bin" : "Could not restore it",
        description: res?.error || error?.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: binned ? "Moved to the bin" : "Restored" });
    load();
    onChanged?.();
  };


  const decideLeave = async (id: string, action: "approve" | "decline") => {
    setBusy(id);
    const { data, error } = await adminDb().rpc("mu_decide_leave", { _id: id, _action: action, _note: null } as any);
    setBusy(null);
    const res = data as any;
    if (error || res?.ok === false) {
      toast({ title: "Could not save", description: res?.error || error?.message, variant: "destructive" });
      return;
    }
    load();
    onChanged?.();
  };

  const endEngagement = async (id: string) => {
    setBusy(id);
    await adminDb().rpc("mu_end_engagement", { _id: id, _end: new Date().toISOString().slice(0, 10) } as any);
    setBusy(null);
    load();
    onChanged?.();
  };

  const pendingLeave = useMemo(() => leave.filter((l) => l.status === "requested"), [leave]);

  const liveOffers = useMemo(() => offers.filter((o) => !o.deleted_at), [offers]);
  const binnedOffers = useMemo(() => offers.filter((o) => !!o.deleted_at), [offers]);
  const engagementOffers = useMemo(() => liveOffers.filter(isEngagementOffer), [liveOffers]);
  const workOffers = useMemo(() => liveOffers.filter(isWorkOffer), [liveOffers]);


  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  // One offer, read the same way in either layer.
  const offerRow = (o: Offer) => {
    const s = offerTypeSpec(offerType(o));
    const under = o.parent_offer_id
      ? offers.find((x) => x.id === o.parent_offer_id)
      : undefined;
    return (
      <li key={o.id} className="space-y-2 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{o.title}</p>
            {/* Each fact carries its own icon so the line reads at a
                glance rather than as one run-on sentence. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5" />{s.label}
              </span>
              {under && (
                <span className="inline-flex items-center gap-1.5">
                  <FileSignature className="h-3.5 w-3.5" />Under {under.title}
                </span>
              )}
              {o.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />{o.location}
                </span>
              )}
              {o.rate_note && (
                <span className="inline-flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" />{o.rate_note}
                </span>
              )}
              {o.pattern && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />{o.pattern}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MuStatus
              tone={o.status === "accepted" ? "good" : o.status === "declined" ? "neutral" : "info"}
              label={OFFER_STATUS_ADMIN_LABEL[o.status]}
            />
            {["sent", "viewed"].includes(o.status) && (
              <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => notify(o.id)}>
                <Mail className="mr-1 h-3.5 w-3.5" />Remind
              </Button>
            )}
            {["sent", "viewed", "draft"].includes(o.status) && (
              <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => withdraw(o.id)}>
                <X className="mr-1 h-3.5 w-3.5" />Withdraw
              </Button>
            )}
            {o.deleted_at ? (
              <Button size="sm" variant="ghost" disabled={busy === o.id} onClick={() => setBinned(o.id, false)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />Restore
              </Button>
            ) : !["sent", "viewed", "accepted"].includes(o.status) ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={busy === o.id}
                onClick={() => setBinned(o.id, true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />Bin
              </Button>
            ) : null}
          </div>
        </div>

        {!!o.shifts?.length && (
          <ul className="flex flex-wrap gap-1.5">
            {o.shifts.map((sh, i) => (
              <li key={i} className="border border-line bg-muted/40 px-2 py-0.5 text-[11px]">
                {shiftLabel(sh)}
              </li>
            ))}
          </ul>
        )}
        <OfferTermsView offer={o} compact={s.layer === "work"} />
        {o.decline_reason && <p className="text-xs text-muted-foreground">Reason given: {o.decline_reason}</p>}
      </li>
    );
  };

  const compose = (t: OfferLayerType) => {
    setEtype(t);
    if (t === "shift" || t === "assignment") {
      setParentId((p) => p || liveEngagements[0]?.id || "");
    }
    openComposer();
  };

  return (
    <div className="space-y-6">
      <MuSection
        title="Their availability, exactly as given"
        description="What they have told us, day by day, with the hours they named. A blank day is silence, not a no."
      >
        <AvailabilityDetail personId={personId} />
      </MuSection>

      {shows("offers") && (

      <>
      <MuSection
        title="Engagements"
        description="The relationship itself, established once and papered once. Employment, a fixed term placement, or a bank and locum agreement covering a scope of work."
        actions={
          <Button size="sm" onClick={() => compose("placement")}>
            <Send className="mr-1.5 h-4 w-4" />Establish an engagement
          </Button>
        }
        padded={false}
      >
        {engagementOffers.length === 0 ? (
          <MuEmpty
            art={art.objSignedContract}
            title="No engagement yet"
            description="Nothing has been proposed to this candidate. Work can only be offered once an engagement is running."
          />
        ) : (
          <ul className="divide-y divide-line-soft">{engagementOffers.map(offerRow)}</ul>
        )}
      </MuSection>

      <MuSection
        title="Work under the engagement"
        description="Shifts and assignments handed out under a live engagement. No new paper: the engagement already covers them."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={liveEngagements.length === 0}
            onClick={() => compose("shift")}
          >
            <Send className="mr-1.5 h-4 w-4" />Offer work
          </Button>
        }
        padded={false}
      >
        {liveEngagements.length === 0 ? (
          <MuEmpty
            art={art.objCalendar}
            title="Nothing to offer work under"
            description="They hold no running engagement, so there is nothing for a shift to sit under yet."
          />
        ) : workOffers.length === 0 ? (
          <MuEmpty art={art.objCalendar} title="No work offered yet" description="Their engagement is running and shifts can be offered against it." />
        ) : (
          <ul className="divide-y divide-line-soft">{workOffers.map(offerRow)}</ul>
        )}
      </MuSection>

      {binnedOffers.length > 0 && (
        <MuSection
          title="Bin"
          description="Offers moved out of the way. They are kept, not destroyed, and can be restored."
          actions={
            <Button size="sm" variant="ghost" onClick={() => setShowBin((v) => !v)}>
              {showBin ? "Hide" : `Show ${binnedOffers.length}`}
            </Button>
          }
          padded={false}
        >
          {showBin ? (
            <ul className="divide-y divide-border/60 opacity-80">{binnedOffers.map(offerRow)}</ul>
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              {binnedOffers.length === 1
                ? "One offer is in the bin."
                : `${binnedOffers.length} offers are in the bin.`}
            </p>
          )}
        </MuSection>
      )}
      </>

      )}

      {shows("engagements") && (
      <MuSection title="Placements running" description="Roles they are working right now." padded={false}>


        {engagements.length === 0 ? (
          <MuEmpty art={art.objHandshake} title="Not placed" description="They have not accepted an ongoing role." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {engagements.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {e.pattern && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />{e.pattern}
                      </span>
                    )}
                    {e.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />{e.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {e.end_date
                        ? `${dateLabel(e.start_date)} to ${dateLabel(e.end_date)}`
                        : `From ${dateLabel(e.start_date)}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MuStatus tone={e.status === "active" ? "good" : "neutral"} label={e.status === "active" ? "Running" : "Ended"} />
                  {e.status === "active" && (
                    <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => endEngagement(e.id)}>
                      End
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </MuSection>
      )}

      {shows("leave") && (
      <MuSection

        title="Leave"
        description="Approved leave blocks the calendar so those days are excluded from matching."
        actions={pendingLeave.length > 0 ? <MuStatus tone="warning" label={`${pendingLeave.length} waiting`} /> : undefined}
        padded={false}
      >
        {leave.length === 0 ? (
          <MuEmpty art={art.objCalendar} title="No leave requested" description="Leave they ask for appears here for a decision." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {leave.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{dateLabel(l.from_date)} to {dateLabel(l.to_date)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {l.reason && (
                      <span className="inline-flex items-center gap-1.5">
                        <StickyNote className="h-3.5 w-3.5" />{l.reason}
                      </span>
                    )}
                    {l.decided_by_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />Decided by {l.decided_by_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MuStatus
                    tone={l.status === "approved" ? "good" : l.status === "requested" ? "warning" : "neutral"}
                    label={LEAVE_STATUS_LABEL[l.status]}
                  />
                  {l.status === "requested" && (
                    <>
                      <Button size="sm" disabled={busy === l.id} onClick={() => decideLeave(l.id, "approve")}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => decideLeave(l.id, "decline")}>
                        Decline
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </MuSection>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {spec.layer === "engagement" ? `Engage ${personName}` : `Offer work to ${personName}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {prefillHints.length > 0 && (
              <div className="border border-line bg-muted/40 p-3">
                <p className="text-xs font-medium">Carried in from their record</p>
                <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  {prefillHints.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
            )}

            {/* 1. What the work is */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">The work</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">What kind</Label>
                  <Select value={etype} onValueChange={(v) => setEtype(v as OfferLayerType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENGAGEMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                      {WORK_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} disabled={liveEngagements.length === 0}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{spec.description}</p>
                  <p className="text-xs text-muted-foreground">{paperLine(etype)}</p>
                </div>
                {spec.layer === "work" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Under which engagement</Label>
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger><SelectValue placeholder="Pick the engagement" /></SelectTrigger>
                      <SelectContent>
                        {liveEngagements.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title}, {offerTypeSpec(offerType(e)).label.toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Work rests on the engagement they already signed, so nothing new is issued.
                    </p>
                  </div>
                ) : (
                <div className="space-y-1.5">

                  <Label className="text-xs">Against an opportunity</Label>
                  <Select value={oppId} onValueChange={setOppId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {opportunities.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}

              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Title of the role</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Night nurse, Lekki Phase 1" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Where</Label>
                  <LocationField value={location} onChange={(v) => setLocation(v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Household, clinic or ward</Label>
                  <Input
                    value={terms.site || ""}
                    onChange={(e) => setTerm("site", e.target.value)}
                    placeholder="A family home in Ikoyi"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Basis of the work</Label>
                  <Input
                    value={terms.basis || ""}
                    onChange={(e) => setTerm("basis", e.target.value)}
                    placeholder="Full time, part time, locum, live-in"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Who they report to</Label>
                  <Input
                    value={terms.reports_to || ""}
                    onChange={(e) => setTerm("reports_to", e.target.value)}
                    placeholder="Care manager"
                  />
                </div>
              </div>
            </section>

            {/* 2. What it pays */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">What it pays</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={terms.pay_currency || "NGN"} onValueChange={(v) => setTerm("pay_currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Figure</Label>
                  <Input
                    value={terms.pay_amount || ""}
                    onChange={(e) => setTerm("pay_amount", e.target.value)}
                    placeholder="450,000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">How often</Label>
                  <Select value={terms.pay_frequency || ""} onValueChange={(v) => setTerm("pay_frequency", v)}>
                    <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="an hour">An hour</SelectItem>
                      <SelectItem value="a shift">A shift</SelectItem>
                      <SelectItem value="a day">A day</SelectItem>
                      <SelectItem value="a week">A week</SelectItem>
                      <SelectItem value="a month">A month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">On top of pay</Label>
                  <Input
                    value={terms.pay_extras || ""}
                    onChange={(e) => setTerm("pay_extras", e.target.value)}
                    placeholder="Transport and feeding covered"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anything else about pay</Label>
                  <Input
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="Reviewed after three months"
                  />
                </div>
              </div>
            </section>

            {/* 3. When */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">When</p>
              {kind === "role" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pattern</Label>
                    <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Live-in, 5 days on" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hours a week</Label>
                    <Input
                      value={terms.weekly_hours || ""}
                      onChange={(e) => setTerm("weekly_hours", e.target.value)}
                      placeholder="40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Runs until (optional)</Label>
                    <Input
                      type="date"
                      value={terms.end_date || ""}
                      onChange={(e) => setTerm("end_date", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 border border-line p-3">
                  <Label className="text-xs">Shifts</Label>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      type="date"
                      className="w-auto"
                      value={shiftDate}
                      onChange={(e) => setShiftDate(e.target.value)}
                    />
                    <Select value={preset} onValueChange={setPreset}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIFT_PRESETS.map((p) => <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={addShift}>
                      <Plus className="mr-1 h-3.5 w-3.5" />Add
                    </Button>
                  </div>
                  {shifts.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {shifts.map((s, i) => (
                        <li key={i} className="flex items-center gap-1 border border-line bg-muted/40 px-2 py-0.5 text-[11px]">
                          {shiftLabel(s)}
                          <button type="button" onClick={() => setShifts((p) => p.filter((_, x) => x !== i))}>
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Probation</Label>
                  <Input
                    value={terms.probation || ""}
                    onChange={(e) => setTerm("probation", e.target.value)}
                    placeholder="Three months"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notice either way</Label>
                  <Input
                    value={terms.notice_period || ""}
                    onChange={(e) => setTerm("notice_period", e.target.value)}
                    placeholder="One month"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Answer by</Label>
                  <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                </div>
              </div>
            </section>

            {/* 4. In their own words */}
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">What we are asking of them</p>
              <div className="space-y-1.5">
                <Label className="text-xs">What the work involves</Label>
                <Textarea
                  rows={3}
                  value={terms.duties || ""}
                  onChange={(e) => setTerm("duties", e.target.value)}
                  placeholder="Overnight nursing care for one elderly gentleman, medication rounds, mobility support and a written handover each morning."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">What we provide</Label>
                <Textarea
                  rows={2}
                  value={terms.provided || ""}
                  onChange={(e) => setTerm("provided", e.target.value)}
                  placeholder="Uniform, consumables, indemnity cover and a named supervisor."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">What happens next</Label>
                <Textarea
                  rows={2}
                  value={terms.next_steps || ""}
                  onChange={(e) => setTerm("next_steps", e.target.value)}
                  placeholder="Accept here and we will send a contract to sign, then arrange the handover visit."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">A note to them</Label>
                <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
            </section>

            {/* 5. Read it back before it goes */}
            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-label">
                How it will read to them
              </p>
              <OfferTermsView
                offer={{
                  id: "preview",
                  kind,
                  title: title || "Untitled offer",
                  location,
                  rate_note: rate,
                  message,
                  pattern,
                  start_date: startDate || null,
                  status: "draft",
                  expires_at: null,
                  created_at: new Date().toISOString(),
                  responded_at: null,
                  decline_reason: null,
                  terms,
                }}
              />
              {missingTerms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Still to write: {missingTerms.join(", ")}.
                </p>
              )}
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={sending || missingTerms.length > 0} onClick={send}>
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Send offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default WorkPanel;
